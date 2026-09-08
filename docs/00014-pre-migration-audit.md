# Auditoría pre-migración — 00014 `shopping_lists` → `shopping_list_items`

> Auditoría final antes de aprobar e implementar la Fase 1. Basada en datos
> **reales de producción** (consultados con service role, solo lectura).
> Fecha: 2026-08-25 · Proyecto Supabase: `tdgussivhzliuatcrndy`

---

## 1. Cantidad estimada de registros a migrar (datos reales)

Consulta directa a producción:

| Métrica | Valor real |
|---|---|
| Filas en `shopping_lists` | **1** |
| — con ítems | 0 |
| — vacías (0 ítems) | 1 |
| Usuarios distintos con lista | 1 |
| Usuarios con >1 lista | 0 |
| **Ítems totales a migrar** | **0** |
| Total de usuarios en el sistema | 1 |

La única fila existente:
```
id=e787329d-… user_id=7792972c-… items=[]  name=null  meal_plan_id=null
```

**Implicación:** el backfill **no tiene datos que mover** (0 ítems). El sistema
está en etapa muy temprana (1 usuario, lista vacía). Esto reduce el riesgo de la
migración de "alto" (por el backfill) a **muy bajo** en la práctica — pero el
backfill se implementa igualmente robusto e idempotente porque debe funcionar
correctamente cuando SÍ haya datos (y por si se ejecuta tras haber capturado
ítems entre la aprobación y la ejecución).

---

## 2. Riesgos de la migración (revaluados con datos reales)

| Riesgo | Prob. real | Impacto | Mitigación |
|---|---|---|---|
| Pérdida de datos en backfill | **Muy baja** (0 ítems hoy) | Alto | Backfill idempotente; **`shopping_lists` NO se borra** (respaldo intacto); verificación por conteo antes de dar por buena. |
| Parser de cantidad divergente (SQL vs JS) | Baja | Medio | Backfill en **Node reutilizando `parseQuantity`** real (decisión aprobada). Además, 0 cantidades que parsear hoy. |
| RLS mal configurada (expone/oculta) | Baja | Alto | Políticas `own` idénticas en forma a las actuales de `shopping_lists`; probar SELECT/INSERT/UPDATE/DELETE con el usuario real antes de tocar frontend. |
| `ALTER`/creación de tabla falla o bloquea | Muy baja | Bajo | Solo `CREATE TABLE/TYPE/INDEX/POLICY` (objetos nuevos) + backfill sobre 0 filas → sin locks relevantes; `CREATE ... IF NOT EXISTS` idempotente. |
| Ítems capturados entre aprobación y ejecución | Baja | Bajo | El backfill lee el estado en el momento de ejecutar; idempotente (no duplica si se reejecuta). |
| Doble fuente temporal (JSON + filas) | N/A en Fase 1 | Medio | En Fase 1 el frontend **sigue usando el JSON**; las filas se crean pero no se leen aún. El cambio de lectura ocurre en Fase 2, en un único paso. |

**Conclusión de riesgo:** con 0 ítems reales, la Fase 1 es esencialmente
**creación de estructura** (tabla, enum, índices, RLS) + un backfill que hoy
copia 0 filas. Riesgo operativo **muy bajo**.

---

## 3. Estrategia de rollback

Rollback por capas, de menor a mayor:

1. **Durante Fase 1 (datos):**
   - `shopping_lists` permanece **intacta y en uso por el frontend** → si algo
     falla, no hay impacto para el usuario (la app sigue leyendo el JSON).
   - Revertir estructura (si fuera necesario): `DROP TABLE shopping_list_items;`
     `DROP TYPE shopping_item_category;` — son objetos nuevos, sin dependencias
     externas. No afecta ningún dato existente.
2. **Backfill:** al ser idempotente y no destructivo (solo INSERT en la tabla
   nueva), revertir = `TRUNCATE shopping_list_items` (o `DROP TABLE`). El origen
   (`shopping_lists.items`) nunca se modifica ni se borra en 00014.
3. **Fase 2 (frontend):** si el código nuevo por filas fallara, se revierte el
   PR de código (git revert) y la app vuelve a leer el JSON, que sigue existiendo
   y actualizado hasta el momento del corte. (Nota: cambios hechos sobre filas
   tras el corte no estarían en el JSON; por eso el corte se hace con la lista
   prácticamente vacía y se comunica.)
4. **Retiro definitivo de `shopping_lists`:** NO ocurre en 00014 ni 00015. Se
   pospone a una migración posterior (00016+) y solo tras semanas de verificación
   en producción. Hasta entonces, rollback siempre disponible.

---

## 4. Cómo validar que ningún usuario pierda información

Procedimiento de verificación (ejecutable como script Node de solo lectura tras
el backfill):

1. **Conteo global:** `SUM(items del JSON tras dedupe)` por usuario ==
   `COUNT(shopping_list_items)` por usuario. Hoy: 0 == 0. ✔ trivial, pero el
   script queda para cuando haya datos.
2. **Comparación por usuario e ítem:** para cada usuario, cada `{name, qty,
   unit, checked}` del JSON tiene su fila equivalente (nombre normalizado,
   cantidad parseada correctamente, checked preservado).
3. **Casos límite:** verificar que `"—"`/vacío → `qty NULL`; cantidades no
   parseables → fila con `qty NULL` + `unit` = texto original (nunca se descarta
   el ítem). Hoy: 0 casos, pero cubierto.
4. **RLS funcional:** con el usuario real (no service role), confirmar que
   SELECT devuelve solo sus filas y que INSERT/UPDATE/DELETE respetan `own`.
5. **Gate de avance:** la Fase 2 (frontend) **no se activa** hasta que 1–4 pasen.
6. **Origen preservado:** confirmar que `shopping_lists` sigue con sus filas y
   `items` sin modificar (checksum/conteo antes y después del backfill).

**Criterio de éxito:** 0 discrepancias en (1)-(3), RLS correcta en (4),
`shopping_lists` intacta en (6).

---

## 5. Tiempo estimado real de ejecución en producción

| Paso | Tiempo real estimado |
|---|---|
| Aplicar migración 00014 (CREATE TYPE/TABLE/INDEX/POLICY) | **< 1 s** (objetos nuevos, sin locks sobre datos) |
| Backfill (0 ítems hoy) | **< 1 s** (copia 0 filas) |
| Script de verificación | ~1–2 s |
| **Ventana total de ejecución en prod** | **≈ segundos, sin downtime** |

No hay tabla grande que reescribir ni índice que reconstruir sobre volumen. La
app no requiere mantenimiento: en Fase 1 sigue usando el JSON, así que la
ejecución es transparente para el usuario.

> Nota: el "esfuerzo de desarrollo" de la Fase 1 (~4-6 h: migración + tipos +
> script de backfill/verificación) es distinto del "tiempo de ejecución en
> producción" (segundos). Lo que se aprueba aquí es la ejecución.

---

## 6. Alcance exacto de la Fase 1 (lo que se implementa al aprobar)

1. **Migración `00014_shopping_list_items.sql`**: `CREATE TYPE
   shopping_item_category` (7 valores aprobados), `CREATE TABLE
   shopping_list_items` (con `source_recipe_id`, aprobado), índices, trigger
   `updated_at`, `ENABLE RLS` + 4 policies `own`. Espejo en `deployment.sql`.
2. **Tipos** en `src/types/database.ts`: `shopping_list_items` (Row/Insert/
   Update) + enum.
3. **Script de backfill en Node** (idempotente, reutiliza `parseQuantity`) +
   **script de verificación** (§4).
4. **NO se toca el frontend** en Fase 1 (sigue leyendo el JSON). `shopping_lists`
   permanece intacta.

Fase 2 (posterior, PR aparte): motor de merge único, operaciones por fila,
categorías, edición inline, limpieza del código viejo, corte de lectura al nuevo
modelo.

---

## 7. Recomendación

**Aprobar y ejecutar 00014 ahora.** Con 1 usuario y 0 ítems, es el **momento
ideal** para hacer el cambio estructural: riesgo de datos prácticamente nulo,
ejecución en segundos, sin downtime, y deja la base correcta (filas + cantidad
estructurada + categorías + `source_recipe_id`) para household, meal plans
familiares, despensa y presupuesto. Posponerlo solo haría crecer el costo (más
usuarios, más ítems en el blob).

**Al aprobar**, implemento la Fase 1 completa, te entrego la migración para
aplicar en la DB (flujo `unit_weight`), y ejecuto la verificación antes de dar
por cerrada la fase.
