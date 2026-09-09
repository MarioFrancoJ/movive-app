# Análisis — "Recommended Meal Type" en recetas

> Análisis técnico previo a implementar. **No se implementa nada aún.**
> Requerimiento: campo administrable en recetas con el momento del día
> recomendado (Breakfast / Snack AM / Lunch / Snack PM / Dinner), como
> **sugerencia** que preselecciona el slot al añadir al meal plan.
> Fecha: 2026-08-25

---

## 0. Hallazgo clave: ya existe `recipes.meal_type` (pero con 4 valores)

La tabla `recipes` **ya tiene** una columna `meal_type` (migración 00010),
del tipo enum `meal_type` con **4 valores**: `Breakfast | Lunch | Dinner | Snack`.
Hoy se usa para:
- Agrupar/filtrar recetas en la UI (`recipes/page.tsx`, `RecipesView`).
- **Preseleccionar el slot** al añadir al plan, vía `suggestSlotForRecipe` /
  `defaultSlotForRecipe` en `lib/nutrition.ts` (el `meal_type` "gana" sobre la
  inferencia por keywords; `"Snack"` legacy → `"Snack PM"`).

El requerimiento pide **5 valores** (con `Snack AM` y `Snack PM` separados) — los
mismos `MEAL_SLOTS` que usa el meal planner. Es decir, **el requerimiento es una
evolución del campo existente, no un campo nuevo desde cero.**

### El acoplamiento crítico
El enum `meal_type` **NO es exclusivo de recetas**: también lo usa
`meal_logs.meal_type` con `NOT NULL` (registro de comidas). El dominio de
`meal_logs` es intencionalmente de 4 valores (sin split AM/PM): ver
`MealLogType` en `lib/nutrition.ts` y el comentario "Snack AM/Snack PM → Snack".
**Por eso NO se debe simplemente añadir valores al enum `meal_type` compartido.**

---

## 1. Dónde almacenar el campo (enum recomendado)

**Recomendación: crear un enum nuevo y dedicado + una columna nueva, sin tocar
el enum compartido `meal_type`.**

- Nuevo enum: `recommended_meal_type` con los **5** valores exactos del planner:
  `'Breakfast' | 'Snack AM' | 'Lunch' | 'Snack PM' | 'Dinner'`.
- Nueva columna: `recipes.recommended_meal_type recommended_meal_type` (nullable).

**Por qué un enum nuevo y no ampliar `meal_type`:**
- `meal_type` está atado a `meal_logs` (NOT NULL, dominio de 4). Añadirle
  `Snack AM`/`Snack PM` contaminaría el registro de comidas y rompería el mapeo
  `MealLogType`.
- Un enum dedicado alinea el valor **exactamente** con `MEAL_SLOTS`, que es lo
  que consume el modal "Add to Meal Plan" → preselección directa, sin traducción.

**Alternativa (descartada):** reutilizar `recipes.meal_type` y ampliar el enum
compartido. Menos tablas, pero acopla recetas y logs y arrastra el split AM/PM a
un dominio que no lo quiere. No recomendada.

**Sobre la columna vieja `recipes.meal_type`:** se conserva por compatibilidad
(agrupación/filtros actuales) — **no se elimina en esta fase**. Opcionalmente, a
futuro, `recommended_meal_type` puede volverse la fuente de verdad y `meal_type`
derivarse (Snack AM/PM → Snack) para los filtros. Fuera de alcance ahora.

---

## 2. Estrategia de migración para recetas existentes

Migración `00015_recipes_recommended_meal_type.sql` (aditiva, requiere tu
aprobación al ser DB):

1. `CREATE TYPE recommended_meal_type AS ENUM ('Breakfast','Snack AM','Lunch','Snack PM','Dinner');`
2. `ALTER TABLE recipes ADD COLUMN IF NOT EXISTS recommended_meal_type recommended_meal_type;` (nullable)
3. **Backfill de un valor por defecto razonable** para las existentes, derivado
   de datos ya presentes (sin inventar):
   - Si `recipes.meal_type` existe → mapear: `Breakfast→Breakfast`,
     `Lunch→Lunch`, `Dinner→Dinner`, `Snack→Snack PM` (coherente con el mapeo
     legacy actual).
   - Si `meal_type` es NULL → usar la **misma inferencia por keywords** que
     `suggestSlotForRecipe` (nombre + ingredientes). Para no duplicar lógica SQL,
     el backfill se hace en **Node reutilizando `suggestSlotForRecipe`** (mismo
     criterio que ya ve el usuario hoy en el modal).
   - Último recurso si nada aplica → `Lunch` (el momento más neutro/común para
     una comida principal) **o** dejar NULL. Recomiendo `Lunch` como default
     visible para que el punto 4 ("valor por defecto razonable") se cumpla.
4. Índice opcional `idx_recipes_recommended_meal_type` (para filtros/recomendaciones futuras).
5. `deployment.sql` y `src/types/database.ts` reflejan el enum + columna.

**Datos reales:** hay muy pocas recetas y 1 usuario (según auditorías previas),
así que el backfill es de bajo riesgo y ejecución en segundos. Se entregará el
SQL + script de backfill Node + validación, como en 00014.

---

## 3. Cambios necesarios por módulo

### A) Admin — formulario de receta (`app/(admin)/admin/recipes/page.tsx`)
- Añadir un **selector** "Recommended Meal Type" (5 chips o `<select>`), editable
  al crear y editar. Estado `recommendedMealType` en el `RecipeForm`, prellenado
  en edición, persistido en insert/update (`recipes.recommended_meal_type`).
- Bajo riesgo: el form ya se refactorizó a `RecipeForm` (Fase reciente).

### B) Recipe Detail (`RecipeDetailView.tsx` + `[id]/page.tsx`)
- El `select` de recetas ya trae `meal_type`; añadir `recommended_meal_type` al
  select y al tipo `Recipe`.
- **Mostrar** el valor recomendado (un chip/etiqueta, junto a goal/prep/servings).
- Usarlo como **preselección** del slot: hoy el estado inicial usa
  `suggestSlotForRecipe({ mealType: recipe.mealType, ... })`. Pasar a priorizar
  `recipe.recommendedMealType` cuando exista (es ya un `MEAL_SLOT` exacto).

### C) Add to Meal Plan (`components/nutrition/MealPlanModal.tsx`)
- El modal recibe `recipe.mealType` como `defaultSlot`. Cambiar el origen del
  `defaultSlot` a `recommended_meal_type` (con fallback a la lógica actual).
- Comportamiento pedido: la 1ª asignación **preselecciona** el recomendado; el
  usuario lo cambia libremente (ya soportado por los chips de slot). Sugerencia,
  no restricción. ✔ encaja sin cambios estructurales.

### D) AI Recipe Generation
- **Hallazgo:** hoy NO existe un flujo que la IA use para **crear/insertar
  recetas** (el módulo AI es chat/coach + configuración de proveedor; no hay
  `recipes.insert` desde IA). Por tanto, "las recetas generadas por IA guardan
  este campo" se traduce en **dejar preparado**: cuando se construya ese flujo,
  su esquema de salida debe incluir `recommendedMealType ∈ MEAL_SLOTS` y
  persistirlo. Se documentará el contrato; no hay UI que tocar aún.
- Si más adelante se agrega, la validación debe caer a un default (p. ej.
  inferencia) si la IA omite o devuelve un valor inválido — nunca bloquear.

### E) `lib/nutrition.ts`
- `suggestSlotForRecipe` / `defaultSlotForRecipe`: aceptar y **priorizar**
  `recommendedMealType` por encima de `meal_type` y de la inferencia por
  keywords. Fuente única de verdad para la preselección.

### F) i18n (`messages/en.json` / `es.json`)
- Etiqueta del campo "Recommended Meal Type" y, si se muestran labels, los 5
  slots (ya existen como `mealPlanner.slot*`, reutilizables).

---

## 4. Impacto en recomendaciones futuras

- **Meal planner inteligente**: con `recommended_meal_type` por receta, el
  planner puede sugerir/autollenar cada slot del día con recetas cuyo recomendado
  coincida (Breakfast en desayuno, etc.). Base directa para "autogenerar semana".
- **Filtros**: permite filtrar recetas por momento del día en el selector del
  planner y en el catálogo, más preciso que el `meal_type` de 4 valores.
- **IA**: un contrato de salida alineado con `MEAL_SLOTS` hace que las recetas
  generadas encajen sin traducción en el planner.
- **No afecta** `meal_logs` ni el registro de comidas (dominio separado
  intacto), evitando regresiones.

---

## 5. Resumen de decisiones propuestas (para aprobar)

| Decisión | Propuesta |
|---|---|
| Almacenamiento | Nuevo enum `recommended_meal_type` (5 valores) + columna `recipes.recommended_meal_type` (nullable). NO ampliar el enum compartido `meal_type`. |
| Recetas existentes | Backfill: derivar de `meal_type` (Snack→Snack PM) o inferir con `suggestSlotForRecipe`; default final `Lunch`. Node + `suggestSlotForRecipe`. |
| Admin | Selector editable en `RecipeForm`. |
| Recipe Detail | Mostrar el valor + usarlo como preselección de slot. |
| Add to Meal Plan | `defaultSlot` = recomendado (fallback a lógica actual). |
| IA | Dejar preparado el contrato (no hay flujo de inserción por IA hoy). |
| `meal_type` viejo | Se conserva (filtros/agrupación); no se elimina ahora. |

**Punto que requiere tu aprobación explícita:** la **migración 00015** (nuevo
enum + columna + backfill). El resto (Admin/Detail/Modal/lib/i18n) es UI/código
de bajo riesgo.

### Decisiones abiertas
1. Default final para recetas sin señal: **`Lunch`** (sugerido) o dejar NULL.
2. ¿Mostrar el recomendado en el catálogo (cards) además del detalle, o solo en
   detalle? (Sugiero: solo detalle por ahora, para no recargar la card.)
3. ¿Reemplazar el filtro de `meal_type` (4) por `recommended_meal_type` (5) en el
   catálogo, o mantener ambos? (Sugiero mantener el actual y evaluar después.)
