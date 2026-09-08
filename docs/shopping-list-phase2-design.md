# Shopping List — Fase 2: diseño funcional (para aprobar)

> Auditoría funcional de la experiencia propuesta. **No se implementa nada.**
> Base: la tabla `shopping_list_items` de la migración 00014 (ya en producción).
> Restricciones: sin household, sin realtime, sin inventario/presupuesto.
> `shopping_lists` (blob) se conserva como respaldo. Todo sobre `main`.
> Fecha: 2026-08-25

---

## 1. Flujo UX completo

### Entrada
El usuario llega a `/nutrition/shopping-list`. La página **lee de
`shopping_list_items`** (ya no del blob). Los ítems se muestran **agrupados por
categoría** (como una lista de súper), con los **pendientes arriba** y los
**comprados abajo**.

### Formas de añadir ítems (todas pasan por el MOTOR ÚNICO de merge)
1. **Manual** (formulario en la página): nombre + cantidad + unidad + categoría.
2. **Desde una receta** ("Add to shopping list" en detalle/grid de recetas).
3. **Generar desde el meal plan** de la semana (botón en la página).

En los tres casos, el motor único decide: **sumar** a un ítem existente (mismo
nombre normalizado + misma unidad) o **crear** una fila nueva. Agregar la misma
receta dos veces **suma cantidades**, no duplica filas.

### Acciones sobre un ítem
- **Marcar/desmarcar comprado** → el ítem salta entre la zona "pendientes" y
  "comprados" de su categoría.
- **Editar inline** nombre / cantidad / unidad (sin modal).
- **Eliminar** un ítem.
- **Cambiar categoría** (selector inline en el ítem).
- **Limpiar todo** (global) — con confirmación.

### Salida / persistencia
Cada acción escribe **solo la fila afectada** (insert/update/delete granular),
no reescribe una lista completa → sin condiciones de carrera.

---

## 2. Mock de estructura visual

```
┌─ Lista de compras ───────────────────────────  (12 ítems · 4 comprados) ─┐
│  [ + Generar del plan ]   [ Limpiar todo ]                                │
│                                                                            │
│  ┌ Añadir ─────────────────────────────────────────────────────────────┐ │
│  │ [ Nombre.............. ] [ Cant ] [ Unidad ▾ ] [ Categoría ▾ ] [Add] │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  PRODUCE                                                          (3)       │
│    ☐  Tomate ................................ 500 g        ✎   🗑           │
│    ☐  Espinaca .............................. 200 g        ✎   🗑           │
│    ☐  Aguacate ............................... 2 unit      ✎   🗑           │
│                                                                            │
│  PROTEIN                                                         (2)       │
│    ☐  Pechuga de Pollo ...................... 600 g        ✎   🗑           │
│    ☐  Huevo Entero .......................... 12 unit      ✎   🗑           │
│                                                                            │
│  DAIRY                                                          (1)       │
│    ☐  Leche Entera .......................... 1000 ml      ✎   🗑           │
│                                                                            │
│  … (Grains · Pantry · Beverages · Other)                                   │
│                                                                            │
│  ─── Comprados (4) ──────────────────────────────────────────────────     │
│    ☑  Arroz Blanco  (tachado)                              🗑              │
│    ☑  Café Negro    (tachado)                              🗑              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Notas de diseño:**
- Encabezado de sección por **categoría** con contador de pendientes.
- Solo se muestran categorías que tienen ítems (no secciones vacías).
- Cantidad renderizada como `qty + unit` (ej. "500 g"); si `qty` es NULL → "—".
- **Comprados** agrupados al final (colapsables), tachados y atenuados; editar
  se deshabilita para comprados (solo desmarcar o borrar).
- Modo edición inline: al pulsar ✎, la fila muestra inputs
  `[nombre] [qty] [unidad ▾]` + botones Guardar/Cancelar, en su lugar.
- Reutiliza el design system existente (chips, `Button`, inputs, radios golden).

---

## 3. Comportamiento esperado de cada acción

| Acción | Comportamiento | Persistencia |
|---|---|---|
| **Añadir manual** | Pasa por el motor: si existe (nombre norm.+unidad) suma; si no, inserta. Categoría elegida por el usuario (default "Other"). | `insert` o `update` de 1 fila |
| **Añadir desde receta** | Motor único con `multiplier = servings`. Autocategoriza vía `ingredients.category` → `shopping_item_category`. Segunda vez = suma. | `insert`/`update` por ítem |
| **Generar del meal plan** | Reúne ingredientes de la semana (suma de servings), pasa por el **mismo** motor. **Idempotente**: regenerar no duplica (fusiona). | `insert`/`update` por ítem |
| **Marcar comprado** | `checked = true`; el ítem baja a "Comprados". | `update { checked }` de 1 fila |
| **Desmarcar** | `checked = false`; vuelve a su categoría, zona pendientes. | `update { checked }` |
| **Editar nombre** | Inline. Si el nuevo nombre colisiona con otro ítem (mismo nombre+unidad), se **fusiona** (suma) para evitar duplicado. | `update` (o merge) |
| **Editar cantidad** | Inline, numérica (`qty`). Vacío → NULL ("—"). | `update { qty }` |
| **Editar unidad** | Inline. Cambiar unidad puede habilitar/deshabilitar fusión con otro ítem del mismo nombre. | `update { unit }` |
| **Cambiar categoría** | Selector inline; mueve el ítem de sección. | `update { category }` |
| **Eliminar** | Quita la fila. | `delete` |
| **Limpiar todo** | Borra todas las filas del usuario (con confirmación). | `delete` por `user_id` |

**Regla del motor único (fuente de verdad):**
```
mergeIntoItems(rows, incoming):
  clave = (normalizeName(name), unit)
  si existe clave y qty ambos numéricos → qty += incoming.qty   (UPDATE)
  si existe pero unidad distinta / no numérica → fila nueva      (INSERT, línea calificada)
  si no existe → INSERT
```
Reutiliza `normalizeName`, `parseQuantity`, `formatQuantity` ya existentes,
adaptados a `qty:number` estructurado (no reparsea strings). **Elimina** la
agregación inline duplicada de `handleGenerate`.

---

## 4. Riesgos de migrar la UI al nuevo modelo

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Doble fuente temporal (blob vs filas)** | Medio | La UI pasa a leer/escribir SOLO `shopping_list_items` en el mismo PR. El blob queda como respaldo, sin lectura desde el código. Sin rutas mixtas. |
| **`addRecipeIngredientsToShoppingList` escribe al blob hoy** | Alto | Debe reescribirse a filas en el MISMO PR; si no, "Add from recipe" escribiría al modelo viejo mientras la lista lee del nuevo → ítems "perdidos". **Punto crítico de coordinación.** |
| **Concurrencia de edición inline** | Bajo | Update por fila (no reescribe todo); 1 usuario hoy. |
| **Fusión al editar nombre/unidad** puede sorprender | Bajo-Medio | Al fusionar por edición, mostrar toast "se combinó con X"; o preguntar. Decisión abierta (§6). |
| **Autocategorización imperfecta** (nombres que no matchean catálogo) | Bajo | Fallback a "Other"; el usuario recategoriza inline. |
| **Regenerar del meal plan** duplicando (bug actual) | Medio | Resuelto por el motor único idempotente. |
| **i18n incompleto** (categorías, editar, unidad) | Bajo | Añadir claves EN/ES en paridad; validación de build. |
| **Rollback** | Bajo | El blob sigue intacto; revertir el PR de código restaura la lectura del blob. Datos de filas no se pierden (quedan en la tabla). |

**Ítem crítico:** los **tres** puntos de escritura (página, `addRecipeIngredients…`,
generate) deben apuntar al nuevo modelo **a la vez**. No puede quedar uno
escribiendo al blob.

---

## 5. Plan de implementación paso a paso (Fase 2)

Un solo PR sobre `main` (o dos sub-pasos si prefieres validar a mitad):

1. **Motor único en `lib/nutrition.ts`**
   - Nuevo tipo de fila `ShoppingListItemRow` ({id,name,qty,unit,category,checked,…}).
   - `mergeIntoRows(rows, incoming)` (reemplaza `mergeIngredientsIntoItems`).
   - Reescribir `addRecipeIngredientsToShoppingList` para operar sobre
     `shopping_list_items` (insert/update por fila) usando el motor.
   - Helper de autocategoría: `ingredient_category → shopping_item_category`.

2. **Capa de datos de la página** (`shopping-list/page.tsx`)
   - `load` desde `shopping_list_items` (order by category, checked, sort_order).
   - Acciones granulares: add (merge), toggle, editField, changeCategory, remove,
     clearAll. Cada una escribe solo su fila.
   - Eliminar la agregación inline de `handleGenerate` → usa el motor.

3. **UI: agrupación por categoría + pendientes/comprados**
   - Agrupar en memoria por `category`; secciones con contador; comprados al final.
   - Orden: pendientes (por categoría) arriba, comprados abajo.

4. **UI: edición inline** (nombre/qty/unidad/categoría) sin modales.

5. **i18n** EN/ES: labels de las 7 categorías, editar, unidad, textos nuevos.

6. **Validación**: `type-check`, `lint`, `build`. Prueba funcional del flujo
   (add manual, add receta ×2 → suma, generar ×2 → no duplica, toggle, editar,
   borrar, limpiar).

7. **Cierre**: commit + push a `main`. El blob `shopping_lists` queda como
   respaldo (sin lectura). Retiro del blob → migración futura (00016+).

**Estimación:** ~8–11 h de desarrollo (motor ~2-3h, datos página ~2-3h, UI
categorías+comprados ~2-3h, edición inline ~2h, i18n+validación ~1h).

---

## 6. Decisiones abiertas antes de implementar

1. **Fusión al editar nombre/unidad**: si al renombrar un ítem coincide con otro,
   ¿**fusionar automáticamente** (con toast) o **avisar/preguntar**? (Sugiero
   fusionar + toast: consistente con el motor.)
2. **Autocategoría desde receta**: mapeo propuesto
   `Vegetable/Fruit → Produce`, `Protein → Protein`, `Dairy → Dairy`,
   `Carbohydrate → Grains`, `Beverage → Beverages`, `Fat/Other → Pantry`.
   ¿Lo apruebas o ajustas algún mapeo?
3. **"Comprados"**: ¿colapsables (sugerido) o siempre visibles?
4. **Un PR** o **dos** (motor+datos, luego UI)? (Sugiero uno; es cohesivo.)
