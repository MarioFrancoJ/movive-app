# Shopping List — Análisis y propuesta de alcance (Alpha)

> Documento de análisis. **No se implementa nada todavía.** Objetivo: evolucionar
> la Shopping List existente hacia una lista de compras funcional para una
> familia, reutilizando al máximo la estructura actual.
> Fecha: 2026-08-25

---

## 1. Estado actual (qué existe hoy)

### 1.1 UI — `app/(app)/nutrition/shopping-list/page.tsx`
Client Component (`"use client"`). Renderiza:
- **Header**: título, contador de ítems, indicador "guardando".
- **Acciones globales**: "Generate from Meal Plan" y "Clear All".
- **Formulario Add Ingredient**: dos inputs de texto — nombre y cantidad (texto libre).
- **Lista plana de ítems**: por cada ítem, checkbox (toggle comprado), nombre
  (tachado si comprado), cantidad, y botón eliminar.
- Estados de loading y empty.

Acciones del usuario: **añadir** manual, **marcar/desmarcar** comprado, **eliminar**
un ítem, **limpiar todo**, **generar** desde el meal plan de la semana actual.
No hay: editar un ítem existente, ordenar, ni agrupar.

### 1.2 Estado y lógica
- Client Component con `useState`: `items`, `listId`, `name`, `quantity`,
  `error`, `loading`, `saving`, `generated`.
- Tipo del ítem: `{ id, name, quantity: string, checked: boolean }`.
  **La cantidad es texto libre** ("500 g", "—"), no un valor numérico + unidad.
- **Sin agrupación** (lista plana, sin categorías ni por receta).
- Cada acción **reescribe el array `items` completo** (no hay operaciones por ítem).

### 1.3 Persistencia — tabla `shopping_lists`
```sql
CREATE TABLE shopping_lists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
  name         VARCHAR(255),
  items        JSONB NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```
- Índice `idx_shopping_lists_user (user_id)`; trigger de `updated_at`.
- **RLS**: políticas `select/insert/update/delete _own` basadas en
  `auth.uid() = user_id` → **cada lista es privada del usuario**.
- **Modelo**: una lista por usuario = **un array JSON de ítems**. Se lee "la más
  reciente" del usuario (`order by created_at desc limit 1`).
- **Columnas `meal_plan_id` y `name` existen pero el código NO las usa.**

### 1.4 Integración con recetas / meal plan — `lib/nutrition.ts`
- `addRecipeIngredientsToShoppingList(ingredients, { multiplier })` — invocada
  desde **recipe detail** (con `multiplier = servings`) y **recipe grid** (=1).
- `mergeIngredientsIntoItems(existing, ingredients, multiplier)` (pura):
  deduplica por **nombre normalizado** (trim+lowercase), suma cantidades **solo
  cuando la unidad coincide**, y si no, añade una línea separada.
- **Dos rutas de agregación NO idénticas**: la página (`handleGenerate`) hace su
  propia agregación inline (match por **nombre exacto sin normalizar**, y
  **concatena** al final → generar dos veces **duplica**), mientras que el botón
  "Add to shopping list" de recetas usa `mergeIngredientsIntoItems` (normalizado,
  con chequeo de unidad). Misma tabla, lógica de merge distinta.

### 1.5 i18n
Namespace `nutrition.shoppingList` en `messages/en.json` y `es.json` (título,
contador, generate, clearAll, add, placeholders, errores…). Label del sidebar en
`nutrition.sections.shoppingList`.

---

## 2. Limitaciones (qué falta para uso familiar)

1. **No es compartida.** RLS es estrictamente `own`: cada miembro de la familia
   tiene su propia lista aislada. **Este es el bloqueante #1 para "familia".**
2. **Cantidad como texto libre.** No hay `{ qty:number, unit:string }`
   estructurado en la fila, lo que hace frágil sumar/editar/normalizar.
3. **Sin categorías / agrupación** (por pasillo o tipo de alimento) → poco
   práctico al comprar.
4. **Sin edición** de un ítem existente (solo toggle o borrar).
5. **`handleGenerate` duplica** y usa un merge distinto al del resto (dos fuentes
   de verdad para la agregación).
6. **Reescritura del array completo** en cada cambio → con varios usuarios
   editando a la vez habría **condiciones de carrera** (last-write-wins pisa
   cambios). Incompatible con edición concurrente familiar.
7. **Sin "quién añadió / quién compró"**, sin timestamps por ítem, sin histórico.
8. **`meal_plan_id` / `name` sin usar** → no hay soporte real de múltiples listas
   ni de vincular una lista a un plan.

---

## 3. Propuesta de alcance para Alpha

Objetivo Alpha: **una lista de compras compartida por la familia**, práctica de
usar en el súper, alimentada desde recetas y meal plan. Evolución, no e-commerce.

### Incluir en Alpha (must-have)
- **A. Lista compartida a nivel de "hogar/familia"**: todos los miembros ven y
  editan la misma lista. (Requiere modelo de grupo — ver §4/§5.)
- **B. Ítems como filas reales** (no un blob JSON) con cantidad estructurada
  (`qty` numérica + `unit`), para poder editar, sumar y ordenar de forma fiable
  y permitir edición concurrente sin pisarse.
- **C. Categorías** simples (Verduras, Lácteos, Carnes, Despensa, Otros) para
  agrupar en la UI; autocategorizar desde el catálogo `ingredients` cuando el
  ítem provenga de una receta.
- **D. Editar ítem** (nombre, cantidad, categoría) + toggle comprado + eliminar.
- **E. Unificar la agregación**: una sola función de merge (la de
  `lib/nutrition`) usada tanto por "Add from recipe" como por "Generate from meal
  plan"; **fusionar** en vez de concatenar (idempotente).
- **F. Atribución básica**: `added_by`, `checked_by` (útil en familia).

### Dejar fuera de Alpha (nice-to-have / v2)
- Precios, tiendas, checkout, integración con proveedores (explícitamente fuera).
- Roles/permisos finos por miembro; invitaciones por email.
- Sincronización en tiempo real (Realtime) — Alpha puede recargar/pull manual.
- Sugerencias inteligentes, histórico de compras, "volver a comprar".
- Múltiples listas por hogar (Alpha = una lista activa por hogar).

---

## 4. Arquitectura recomendada

### Opción elegida: fila-por-ítem + hogar compartido
Migrar del blob JSON (`shopping_lists.items`) a **filas por ítem** y compartir por
un identificador de **hogar (household)**.

**Modelo propuesto (conceptual):**
- `households` (id, name, created_by) — el grupo familiar.
- `household_members` (household_id, user_id, role) — pertenencia.
- `shopping_list_items` (id, household_id, name, qty, unit, category, checked,
  added_by, checked_by, source_recipe_id?, created_at, updated_at).
- (Opcional) conservar `shopping_lists` como "cabecera" por hogar, o retirarla.

**RLS**: las políticas pasan de `auth.uid() = user_id` a "el usuario pertenece al
household" (`EXISTS (select 1 from household_members ...)`). Este es el cambio de
seguridad central para compartir.

**Ventajas**: edición concurrente sin pisarse (update por fila), categorías y
edición naturales, atribución, y merge idempotente server-side.

### Alternativa mínima (si se quiere reducir alcance)
Mantener el blob JSON pero compartirlo por `household_id` y enriquecer cada ítem
del JSON con `{ qty, unit, category, checkedBy }`. **Menos migración**, pero
mantiene el problema de reescritura completa (condiciones de carrera con varios
editores) — aceptable solo si la familia rara vez edita simultáneamente. No
recomendada como base sólida para crecer.

### Reutilización de lo existente
- **UI**: se reutiliza toda la estructura de la página (form add, lista, toggle,
  empty/loading) y el patrón de componentes/estilos (chips, botones del design
  system).
- **Merge**: `mergeIngredientsIntoItems` y `parseQuantity`/`formatQuantity` se
  reutilizan; se elimina la agregación duplicada de `handleGenerate`.
- **Generación desde meal plan**: se conserva la lógica de `readSlot` +
  `recipeCounts` (multiplicador por suma de servings).
- **Autocategorización**: aprovechar `ingredients.category` (ya existe en el
  catálogo) para asignar categoría al generar desde recetas.
- **i18n**: extender el namespace `nutrition.shoppingList` existente.

---

## 5. Qué requiere migración de DB vs. qué se reutiliza

### Requiere migración de base de datos (aprobación del usuario)
1. **`households` + `household_members`** (tablas nuevas) — para compartir.
2. **`shopping_list_items`** (tabla nueva) o, en la alternativa mínima, `ALTER`
   sobre el JSON (sin migración estructural, pero peor).
3. **RLS nuevas**: políticas basadas en pertenencia al household (reemplazan las
   `own`). Cambio de seguridad → revisión cuidadosa.
4. **Backfill/migración de datos**: crear un household por usuario actual y mover
   sus ítems del JSON `shopping_lists.items` a filas `shopping_list_items`.
5. (Opcional) columnas de atribución: `added_by`, `checked_by`.

> Todas las migraciones seguirían el patrón `00014_*.sql` con `ADD ... IF NOT
> EXISTS`, nullable donde aplique, y espejo en `deployment.sql`/`seed.sql`.

### Se puede hacer reutilizando la estructura actual (sin migración)
- **Unificar el merge** (usar `mergeIngredientsIntoItems` en `handleGenerate` y
  fusionar en vez de concatenar) → arregla la duplicación. **Sin DB.**
- **Editar ítem, ordenar y agrupar visualmente** con los datos actuales (aunque
  la cantidad siga como string) → mejora UX. **Sin DB** (pero limitado).
- **Autocategorización visual** leyendo `ingredients.category` en la generación.
  **Sin DB nueva** (usa catálogo existente); persistir la categoría sí requiere
  columna.
- **Cantidad estructurada en el JSON** (enriquecer cada ítem) → **sin migración
  estructural**, pero no resuelve concurrencia.

---

## 6. Estimación de complejidad

| Bloque | Complejidad | Riesgo | Requiere DB | Estimado |
|---|---|---|---|---|
| Unificar merge + fusionar en generate (quitar duplicación) | Baja | Bajo | No | ~1–2 h |
| Editar ítem / ordenar / agrupar visual (datos actuales) | Media | Bajo | No | ~2–3 h |
| Cantidad estructurada `{qty,unit}` (en JSON) | Media | Medio | No* | ~2–3 h |
| Categorías persistentes + autocategorizar desde catálogo | Media | Medio | Sí (columna) | ~3–4 h |
| **Compartir por household** (tablas + RLS + backfill) | **Alta** | **Alto** | **Sí** | **~8–12 h** |
| Migrar blob JSON → `shopping_list_items` (filas) | Alta | Alto | Sí | ~6–8 h |
| Atribución (added_by/checked_by) | Baja | Bajo | Sí (columnas) | ~1–2 h |

\* "No" estructural; sí cambia el shape del JSON almacenado (compatibilidad).

**Lectura de la estimación:**
- El **80% del valor de "familia"** está en *compartir* (household + RLS + filas),
  que es también el **80% del riesgo y del esfuerzo** (tablas nuevas, RLS,
  backfill de datos existentes).
- Las mejoras **sin DB** (unificar merge, editar/ordenar/agrupar visual) son
  quick-wins de bajo riesgo que se pueden entregar primero para validar UX antes
  de comprometer el rediseño de datos.

---

## 7. Recomendación de secuencia (para decidir, no para ejecutar aún)

1. **Fase 0 (sin DB, bajo riesgo):** unificar el merge y arreglar la duplicación
   de "Generate"; añadir editar/ordenar/agrupar visual. Valida UX ya.
2. **Fase 1 (con DB, aprobación):** modelo `households` + `household_members` +
   `shopping_list_items` + RLS por pertenencia + backfill. Es el corazón del
   caso "familia".
3. **Fase 2:** categorías persistentes + autocategorización + atribución.
4. **Fuera de Alpha:** precios, tiendas, realtime, histórico.

**Decisiones abiertas para el usuario** antes de implementar:
- ¿"Familia" = un único hogar por cuenta, o varios? (Alpha sugiere: uno.)
- ¿Migrar a filas (`shopping_list_items`) ahora, o quedarnos con JSON compartido
  para acelerar la Alpha asumiendo la limitación de concurrencia?
- ¿Realtime en Alpha o pull/refresh manual? (Alpha sugiere: manual.)
