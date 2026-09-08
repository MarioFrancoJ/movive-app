# Bug: pérdida de macros al editar recetas (Admin) — causa raíz, fix y recetas afectadas

## Causa raíz

En `app/(admin)/admin/recipes/page.tsx`, `handleSubmit` escribía en la DB
`...calculateNutrition(recipeIngredients)` tanto en UPDATE como en INSERT.

`calculateNutrition` recalcula los macros **desde cero** buscando cada
ingrediente de la receta por **nombre exacto** en el catálogo `ingredients`
(`i.name === ri.name`). Cuando un nombre no coincide (ingrediente renombrado o
eliminado del catálogo, variantes de mayúsculas/espacios, o catálogo no cargado
por RLS), ese ingrediente aporta 0. Si ninguno coincide, el objeto devuelto es
`{ calories: 0, protein: 0, carbs: 0, fat: 0 }` y el UPDATE **sobrescribe los
macros correctos con 0**.

Por qué se veía al **editar** y no al **crear**: al crear, los ingredientes se
eligen del propio catálogo (los nombres coinciden), así que el recálculo da
valores correctos. Al editar, los ingredientes vienen de la DB y sus nombres
pueden no coincidir con el catálogo actual → 0.

Agravante: no existían inputs ni estado para los macros, así que el usuario no
podía ver ni corregir los valores; se perdían de forma silenciosa.

## Fix aplicado (persistencia protegida)

1. **Macros editables y siempre visibles**: nuevos campos `calories`,
   `protein`, `carbs`, `fat` como estado del formulario, con inputs dedicados.
2. **Prellenado**: `handleEdit` carga los macros actuales de la receta, de modo
   que editar cualquier otro campo nunca los blanquea.
3. **La persistencia usa el estado, no un recálculo forzado**: `handleSubmit`
   guarda exactamente los valores del formulario. Si el usuario no toca los
   macros, se conservan tal cual.
4. **Recálculo asistido y no destructivo**: botón "Auto-calculate from
   ingredients" que escribe el recálculo en los campos **solo si no es
   all-zero**; si el catálogo no permite calcular, avisa en vez de pisar.
5. **Validación pre-guardado**: si los 4 macros quedan en 0, se muestra una
   advertencia y se exige un segundo click en Guardar para confirmar
   (guardado intencional posible, accidental bloqueado).

Con esto, un UPDATE ya **no puede** sobrescribir macros existentes con 0 por un
desajuste de nombres de ingredientes.

## Parte 2 — Recetas afectadas: estado y restauración

Estado real en producción (consultado con service role, solo lectura):

| Receta | ID | calories | protein | carbs | fat |
|---|---|---|---|---|---|
| Salteado Asiático | `d1000000-0000-0000-0000-000000000014` | 1 | 0 | 0 | 0 |
| Omelette Espinaca + Queso | `d1000000-0000-0000-0000-000000000009` | 0 | 0 | 0 | 0 |

**No se restauraron valores porque NO existe una fuente previa fiable** (la
instrucción era explícita: no inventar datos si existe fuente previa; aquí no
existe):

- **No están en los seeds** (`supabase/seed.sql` / `deployment.sql` contienen
  12 recetas fijas; estas dos fueron creadas por el usuario en producción).
- **`audit_log` está vacía** → no hay historial de los valores previos.
- **No hay tablas de backup** (`recipes_backup`, `recipes_history`, etc. no
  existen).
- **Recalcular desde `recipe_ingredients` no sirve**: sus ingredientes están
  guardados con `quantity = 1` (placeholder, no gramaje real) y varios no
  existen en el catálogo `ingredients` (p. ej. "Carne molida magra", "Salsa
  Soya", "Huevos", "Queso light"), por lo que el recálculo da ~0 — el mismo dato
  corrupto.

### Cómo restaurarlas (acción del usuario, sin inventar)

Con el fix ya se pueden corregir manualmente sin riesgo:

1. Admin → Recipes → Edit sobre cada receta.
2. Corregir los gramajes reales de los ingredientes (hoy están en `1`).
3. Pulsar **"Auto-calculate from ingredients"** (si los ingredientes existen en
   el catálogo) **o** escribir los macros correctos a mano en los campos.
4. Guardar. Los valores ya no se sobrescriben con 0.

Si se dispone de los valores originales (ficha de la receta, fuente externa),
introducirlos directamente en los 4 campos es la vía correcta.
