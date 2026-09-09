# Decisión de modelo: `meal_type` vs `recommended_meal_type`

> Análisis arquitectónico previo a ejecutar la migración 00015. **No se
> implementa nada.** Pregunta: ¿mantener dos campos o unificar?
> Fecha: 2026-08-25

---

## TL;DR — Recomendación

**Opción C (variante de A): un solo enum nuevo de 5 valores como fuente de
verdad, y `recipes.meal_type` (4 valores) DEPRECADO pero conservado
temporalmente para el filtro del catálogo.** No se elimina en 00015; se retira
en una migración posterior una vez el filtro se migre. Concretamente:

- `recipes.recommended_meal_type` (5 valores) = **la recomendación principal**
  (Admin edita, Detail muestra, modal preselecciona, IA la genera).
- `recipes.meal_type` (4 valores) = **congelado/legacy**, solo lo lee el filtro
  del catálogo hasta migrarlo; deja de editarse.
- No hay duplicación real de responsabilidad: uno es la verdad, el otro es un
  índice legacy en retirada.

Esto respeta tu preocupación (evitar dos campos "vivos" y parecidos) sin cargar
el riesgo de tocar el enum compartido con `meal_logs`.

---

## Uso real hoy (evidencia)

`recipes.meal_type` (enum `meal_type`, 4 valores, añadido en 00010) se usa en:
- **Catálogo** (`RecipesView`): filtro "meal type" de 4 valores (`mealTypeFilter`).
- **Detalle / modal**: **preselección** del slot vía `suggestSlotForRecipe`.
- **Admin**: NO se edita hoy (no está en `RecipeForm`) — solo se muestra/lee.

El enum `meal_type` **es compartido** con `meal_logs.meal_type` (`NOT NULL`),
cuyo dominio es intencionalmente de 4 valores (sin AM/PM). Ver `MealLogType`.

Lo que quieres funcionalmente (5 valores, recomendación principal, preselección,
editable) recae **enteramente** sobre el rol de "recomendación" — que hoy hace a
medias `meal_type` con solo 4 valores.

---

## Evaluación de las tres opciones

### Opción A — Mantener `meal_type` + añadir `recommended_meal_type`
- **Recetas existentes**: backfill de `recommended_meal_type` (bajo riesgo).
- **meal_logs**: intacto. ✅
- **Filtros catálogo**: siguen con `meal_type` (4). ✅ sin trabajo.
- **Admin**: nuevo selector de 5 valores. Pero quedan **dos campos parecidos
  editables/visibles** → justo lo que te preocupa. ⚠️
- **IA**: genera `recommended_meal_type`. ✅
- **Deuda**: media — dos campos que "significan casi lo mismo" conviviendo sin un
  plan de convergencia. Riesgo de confusión a futuro.

### Opción B — Migrar `meal_type` a 5 valores y usar un solo campo
- **Recetas existentes**: `Snack` → habría que decidir `Snack AM`/`PM`.
- **meal_logs**: **PROBLEMA GRAVE.** El enum `meal_type` es compartido. Añadirle
  `Snack AM`/`Snack PM` mete esos valores en el dominio de `meal_logs`, que
  espera 4 y mapea `Snack AM/PM → Snack` (`MealLogType`). Habría que: separar
  primero el enum de `meal_logs` en su propio tipo, migrar su columna, y recién
  ampliar el de recetas. Es una migración **grande, acoplada y arriesgada** sobre
  una tabla de datos de usuario. ❌
- **Filtros catálogo**: pasan a 5 valores (cambio menor).
- **Deuda**: alta al ejecutarla (tocar `meal_logs`), aunque el resultado final
  sea "un solo campo". El costo/riesgo no compensa.
- **Veredicto**: conceptualmente atractiva ("un campo"), pero el enum compartido
  la vuelve cara y peligrosa. **Descartada.**

### Opción C (recomendada) — Enum nuevo de 5 = verdad; `meal_type` legacy en retirada
- **Recetas existentes**: backfill de `recommended_meal_type` (igual que A).
- **meal_logs**: intacto (nunca se toca el enum compartido). ✅
- **Filtros catálogo**: **de momento** siguen con `meal_type` (4) — cero trabajo
  ahora; se migran a `recommended_meal_type` (5) en un paso posterior y entonces
  se retira `meal_type` de recetas. Un solo campo "vivo" desde el día 1.
- **Admin**: un único selector (5 valores) sobre `recommended_meal_type`; se deja
  de tocar `meal_type`. ✅ Sin dos campos editables.
- **IA**: genera `recommended_meal_type`. ✅
- **Deuda**: la más baja con visión de futuro — hay UN campo de verdad y un plan
  explícito de retiro del legacy, en vez de dos campos ambiguos (A) o una
  migración peligrosa (B).

---

## Comparativa de impacto

| Dimensión | A (dos campos) | B (unificar meal_type→5) | **C (nuevo=verdad, legacy en retirada)** |
|---|---|---|---|
| Recetas existentes | backfill | backfill + decidir Snack | backfill |
| meal_logs | intacto | **tocar enum compartido (riesgo alto)** | intacto |
| Filtros catálogo | sin cambio | migrar a 5 | sin cambio ahora, migrar luego |
| Admin | 2 campos ⚠️ | 1 campo | **1 campo de verdad** |
| IA | ok | ok | ok |
| Complejidad ahora | baja | **alta** | baja |
| Deuda futura | media (ambigüedad) | alta al ejecutar | **baja (plan de retiro)** |

---

## Recomendación final y secuencia

**Adoptar Opción C.** En la práctica, la **migración 00015 no cambia** respecto a
lo ya propuesto (crea `recommended_meal_type` + backfill). Lo que cambia es la
**intención declarada** y los pasos siguientes:

1. **00015 (ahora, a aprobar)**: crear `recommended_meal_type` (5) + backfill.
   `meal_type` queda **congelado** (no se edita más; el catálogo lo sigue leyendo).
2. **UI (tras aplicar)**: Admin edita SOLO `recommended_meal_type`; Detail lo
   muestra; el modal preselecciona con él; `suggestSlotForRecipe` lo prioriza.
3. **Convergencia del catálogo (paso futuro, sin urgencia)**: cambiar el filtro
   del catálogo de `meal_type` (4) a `recommended_meal_type` (5), mapeando
   Snack AM/PM en la UI del filtro si se quiere agrupar.
4. **Retiro de `meal_type` de recetas (00016+)**: una vez el filtro no lo use,
   `DROP COLUMN recipes.meal_type`. El enum `meal_type` **permanece** (lo usa
   `meal_logs`). Así se elimina el campo duplicado definitivamente.

**Resultado**: acabas con **un solo campo de recomendación** (5 valores), sin
haber tocado nunca el registro de comidas, y sin la migración peligrosa de la
Opción B. La única "convivencia" es temporal y acotada al filtro del catálogo,
con un plan de retiro claro.

### Diferencia vs. la propuesta original (Opción A)
La propuesta 00015 ya creaba `recommended_meal_type`. La decisión C **añade el
compromiso** de: (a) NO añadir `meal_type` al formulario Admin (se congela), y
(b) planificar el retiro de `recipes.meal_type`. Con eso desaparece tu
preocupación de "dos campos parecidos vivos".

---

## ¿Cambia la migración 00015 ya preparada?

**No es necesario cambiar el SQL de 00015** (sigue creando el enum + columna +
backfill). Solo confirma la política de uso:
- Admin editará únicamente `recommended_meal_type`.
- `recipes.meal_type` no se vuelve a escribir desde la app.
- Se agenda el retiro de `recipes.meal_type` para 00016+.

Si prefieres, puedo añadir a 00015 un `COMMENT ON COLUMN recipes.meal_type IS
'DEPRECATED: replaced by recommended_meal_type; read-only until catalog filter
migrates (see 00016).'` para dejar la deprecación explícita en el esquema.

---

## Decisión que necesito de ti
1. ¿Confirmas **Opción C** (crear el nuevo campo como verdad, congelar
   `meal_type`, retirarlo en 00016+)?
2. ¿Añado el `COMMENT` de deprecación a `recipes.meal_type` en 00015?
3. ¿Migramos el filtro del catálogo a 5 valores **en esta tanda** o lo dejamos
   para el paso de convergencia posterior? (Sugiero: posterior, para no ampliar
   el alcance ahora.)
