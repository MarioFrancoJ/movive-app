# Propuesta técnica — Migración `shopping_lists` (JSON blob) → `shopping_list_items` (filas)

> **Migración 00014.** Propuesta para revisión. **No implementada.**
> Alcance: normalizar Shopping List a filas, con cantidades estructuradas,
> categorías y un único motor de merge. **RLS sigue `own` (por usuario)** — la
> capa household vendrá después (00015+), sobre esta base ya sólida.
> Reglas: trabajamos sobre `main`; user-first; sin Alpha/Beta.
> Fecha: 2026-08-25

---

## 1. Objetivo y principios

- Eliminar el **blob JSON** (`shopping_lists.items`) que causa: reescritura
  completa en cada cambio (last-write-wins → concurrencia frágil), cantidades
  como texto libre, sin categorías, y dos motores de merge distintos.
- Dejar una **base sólida** para household: filas con `user_id` hoy, listas para
  añadir `household_id` mañana **sin re-migrar datos**.
- **No romper** el flujo actual (añadir, marcar, borrar, limpiar, generar desde
  meal plan, añadir desde receta).

**Principio de diseño:** cambio aditivo y reversible. La tabla `shopping_lists`
**no se elimina** en 00014 (se conserva para backfill y rollback); se deja de
usar desde el código y se puede retirar en una migración posterior una vez
verificado en producción.

---

## 2. Esquema de tablas propuesto

### 2.1 Nueva tabla `shopping_list_items`

```sql
-- Enum de categorías (alineado con ingredient_category donde aplique).
CREATE TYPE shopping_item_category AS ENUM (
  'Produce',      -- Verduras y frutas
  'Protein',      -- Carnes, huevo, pescado
  'Dairy',        -- Lácteos
  'Grains',       -- Cereales, panes, pasta, arroz
  'Pantry',       -- Despensa / abarrotes / condimentos
  'Beverages',    -- Bebidas
  'Other'         -- Sin clasificar
);

CREATE TABLE shopping_list_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Datos del ítem (cantidad ESTRUCTURADA):
  name          VARCHAR(255) NOT NULL,
  qty           DECIMAL(10,2),                 -- nullable: ítems "a ojo" sin cantidad
  unit          VARCHAR(20)  NOT NULL DEFAULT '',
  category      shopping_item_category NOT NULL DEFAULT 'Other',
  checked       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Trazabilidad / futuro household:
  source_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL, -- de dónde vino
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shopping_list_items_user     ON shopping_list_items(user_id);
CREATE INDEX idx_shopping_list_items_user_cat ON shopping_list_items(user_id, category);

CREATE TRIGGER shopping_list_items_updated_at
  BEFORE UPDATE ON shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Decisiones de diseño:**
- `qty DECIMAL(10,2)` **nullable** + `unit` string → cantidad estructurada real,
  reemplaza el texto libre ("500 g"). `qty NULL` = ítem sin cantidad ("—").
- `category` como **enum** (no texto libre) → agrupación consistente en la UI.
- `user_id` **se mantiene** (RLS `own`); es el gancho para añadir `household_id`
  luego sin re-migrar.
- `source_recipe_id` nullable → atribución opcional (útil para "quitar lo de esta
  receta"); no imprescindible para Alpha, pero barato de incluir ahora.
- `sort_order` → orden estable dentro de la lista/categoría.
- **No** se usa una tabla "cabecera": una fila por ítem colgando de `user_id`
  basta. (`shopping_lists` queda obsoleta pero no se borra aún.)

### 2.2 RLS (por usuario — `own`)

```sql
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sli_select_own" ON shopping_list_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sli_insert_own" ON shopping_list_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sli_update_own" ON shopping_list_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sli_delete_own" ON shopping_list_items
  FOR DELETE USING (auth.uid() = user_id);
```

> En 00015 (household) estas 4 políticas se reescriben a pertenencia
> (`EXISTS (select 1 from household_members ...)`), y se añade `household_id`.
> Diseñar la política ahora en una sola tabla lo hace un cambio localizado.

### 2.3 Enum de categoría — nota sobre `ingredient_category`

`ingredients.category` ya existe (usado para clasificar). En el backfill y en la
generación desde recetas, mapeamos `ingredient_category` →
`shopping_item_category` con una tabla de correspondencia en código (p. ej.
`Vegetable/Fruit → Produce`, `Protein → Protein`, `Dairy → Dairy`, `Grain →
Grains`, resto → `Pantry`/`Other`). No se toca `ingredient_category`.

---

## 3. Estrategia de backfill

Objetivo: mover los ítems del JSON `shopping_lists.items` a filas
`shopping_list_items`, **sin pérdida y de forma idempotente**.

### 3.1 Reglas de conversión por ítem
Para cada `shopping_lists` (una por usuario, la vigente) y cada ítem del array:
- `name` → `name` (trim).
- `quantity` (texto libre, p. ej. "500 g") → parsear con la MISMA lógica que
  `parseQuantity` (`^(-?\d+(?:\.\d+)?)\s*(.*)$`): número → `qty`, resto → `unit`.
  - "—" o sin número → `qty = NULL`, `unit = ''`.
- `checked` → `checked`.
- `category` → `Other` (no hay categoría en el dato viejo; se puede reclasificar
  luego, o autocategorizar los que hagan match por nombre con el catálogo).
- `sort_order` → índice del ítem en el array.
- `user_id` → el de la lista.

### 3.2 Ejecución
- El backfill se hace en **SQL puro** dentro de la migración usando
  `jsonb_array_elements` + una expresión de parseo, **o** en un script Node de
  un solo uso (service role) si el parseo textual resulta más claro en JS
  (reutilizando `parseQuantity`). **Recomendación: script Node** para reutilizar
  exactamente el parser existente y evitar divergencias regex SQL/JS.
- **Idempotencia:** marcar las `shopping_lists` ya migradas (p. ej. añadir
  `migrated_at TIMESTAMPTZ` a `shopping_lists`, o insertar sólo si el usuario no
  tiene aún filas en `shopping_list_items`). Así re-ejecutar no duplica.
- **Dedupe durante backfill:** aplicar el motor de merge único (§4) al construir
  las filas, de modo que un JSON con duplicados quede consolidado.

### 3.3 Verificación post-backfill
- Conteo: `count(items del JSON)` (tras dedupe) == `count(shopping_list_items)`
  por usuario.
- Muestreo de 3–5 usuarios: cantidades y checked coinciden.
- La tabla `shopping_lists` **se conserva** intacta (rollback disponible).

---

## 4. Motor de merge único

Hoy hay **dos** rutas de agregación divergentes:
- `lib/nutrition.ts` → `mergeIngredientsIntoItems` (normaliza nombre, suma si
  unidad coincide) — usado por "Add from recipe".
- La página → agregación inline en `handleGenerate` (match por nombre exacto,
  **concatena** → duplica) — usado por "Generate from meal plan".

**Propuesta:** un solo motor, operando sobre el modelo de filas:

```
mergeIngredients(rows: ShoppingItemRow[], incoming: {name, qty, unit, category?}[])
  → upserts por (normalizeName(name), unit):
      - existe con misma unidad → qty += incoming.qty (UPDATE de esa fila)
      - existe con unidad distinta / no parseable → fila nueva (línea calificada)
      - no existe → INSERT
```

- **Ambos** flujos ("Add from recipe" y "Generate from meal plan") usan este
  motor → se elimina la duplicación y la divergencia.
- Reutiliza `normalizeName`, `parseQuantity`, `formatQuantity` existentes,
  adaptados a `qty:number`/`unit:string` (ya no reparsea strings).
- La categoría se completa al generar desde recetas (map `ingredient_category`).

---

## 5. Cambios de frontend

Archivo principal: `app/(app)/nutrition/shopping-list/page.tsx`
y helpers en `lib/nutrition.ts`.

### 5.1 Modelo y acceso a datos
- Reemplazar el estado "un array JSON reescrito entero" por **operaciones
  granulares por fila**:
  - `add` → `insert` una fila.
  - `toggle` → `update { checked }` de esa fila (no reescribe todo).
  - `edit` (NUEVO) → `update { name, qty, unit, category }` de esa fila.
  - `remove` → `delete` por id.
  - `clearAll` → `delete` por `user_id` (o filtrar por lista).
  - `generate` / `add from recipe` → merge (§4), insert/update por fila.
- Esto **elimina las condiciones de carrera** del blob (cada cambio afecta solo
  su fila) y prepara la edición concurrente futura del household.

### 5.2 UI
- **Agrupación por `category`** (secciones colapsables o encabezados por pasillo).
- **Cantidad estructurada**: input numérico `qty` + selector/campo `unit`
  (en vez de un solo texto libre).
- **Editar ítem in-place** (nombre/qty/unit/category) — hoy no existe.
- Mantener: añadir, toggle comprado, eliminar, limpiar, generar, y el patrón de
  componentes/estilos actuales (design system).
- `handleGenerate` deja de concatenar: usa el motor de merge (idempotente).

### 5.3 i18n
- Extender el namespace `nutrition.shoppingList` con claves para: categorías
  (labels del enum), editar ítem, unidad, y textos nuevos. EN + ES en paridad.

### 5.4 `lib/nutrition.ts`
- `addRecipeIngredientsToShoppingList` reescrita para operar sobre filas
  (`shopping_list_items`) usando el motor único, en vez del JSON.
- `mergeIngredientsIntoItems` se generaliza a `qty:number` estructurado.
- Se elimina la agregación inline duplicada de la página.

### 5.5 Tipos
- `src/types/database.ts`: añadir `shopping_list_items` (Row/Insert/Update) y el
  enum `shopping_item_category`. (`shopping_lists` se conserva por ahora.)

---

## 6. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Pérdida/corrupción de datos en backfill** | Alto | Conservar `shopping_lists` intacta (no borrar en 00014); backfill idempotente; verificación por conteo + muestreo antes de dar por buena. Rollback = volver a leer del JSON. |
| **Parser de cantidad divergente (SQL vs JS)** | Medio | Hacer el backfill en Node reutilizando `parseQuantity` (misma lógica que producción). |
| **RLS mal configurada expone/oculta datos** | Alto | Políticas `own` idénticas en forma a las actuales de `shopping_lists`; probar select/insert/update/delete con un usuario de prueba antes de migrar el frontend. |
| **Concurrencia durante la ventana de migración** | Bajo | Volumen pequeño; ejecutar backfill en momento de baja actividad; el código nuevo solo se activa tras backfill verificado. |
| **Enum de categoría rígido** | Bajo | Empezar con 7 valores; ampliar el enum es un `ALTER TYPE ADD VALUE` sencillo. |
| **Doble fuente temporal (JSON + filas)** | Medio | El frontend se cambia en el MISMO PR que activa las filas; no se deja código leyendo ambos. `shopping_lists` queda solo como respaldo. |
| **Reintroducir duplicados** | Medio | Un único motor de merge; backfill aplica dedupe; `generate` deja de concatenar. |

**Retiro de `shopping_lists`:** se pospone a una migración posterior (00016+)
tras confirmar en producción que las filas funcionan. No se borra en 00014.

---

## 7. Estimación de esfuerzo

| Bloque | Complejidad | Riesgo | Estimado |
|---|---|---|---|
| Migración 00014 (enum + tabla + índices + trigger + RLS) | Baja-Media | Medio | ~2 h |
| Tipos TS (`shopping_list_items` + enum) | Baja | Bajo | ~0.5 h |
| Script de backfill (Node, idempotente + verificación) | Media | **Alto** | ~2-3 h |
| Motor de merge único (refactor `lib/nutrition`) | Media | Medio | ~2-3 h |
| Frontend: operaciones por fila (add/toggle/edit/remove/clear) | Media | Medio | ~3-4 h |
| Frontend: agrupación por categoría + cantidad estructurada + editar | Media | Bajo | ~3-4 h |
| i18n EN/ES + validación type-check/lint/build | Baja | Bajo | ~1 h |
| **Total** | | | **~14-18 h** |

Sugerencia de división en 2 PRs sobre `main`:
- **PR 1 (datos):** migración 00014 + tipos + backfill + verificación (sin cambiar
  UI todavía; RLS lista). Se valida que las filas existen y cuadran.
- **PR 2 (código):** motor de merge único + frontend por filas + categorías +
  i18n; retira el uso del JSON. Al final, `shopping_lists` queda como respaldo.

> Todo se entregaría con el flujo habitual (type-check / lint / build) y la
> migración requeriría tu aprobación + aplicación en la DB (como `unit_weight`).

---

## 8. Qué NO incluye esta migración (por diseño)

- **household / compartir** → migración 00015+ sobre esta base (añadir
  `household_id` + reescribir RLS; sin re-migrar datos).
- Borrado de `shopping_lists` → migración 00016+ tras verificación.
- Realtime, precios, tiendas, despensa → fuera de alcance.

---

## 9. Decisiones abiertas antes de aprobar 00014

1. **Enum de categorías**: ¿los 7 valores propuestos, o prefieres otro set /
   nombres en español a nivel de dato? (Los labels visibles van por i18n igual.)
2. **`source_recipe_id`**: ¿lo incluimos ahora (barato, útil) o lo dejamos fuera?
3. **Backfill en Node vs SQL puro**: recomiendo Node (reutiliza `parseQuantity`).
   ¿De acuerdo?
4. **División en 2 PRs** (datos, luego código) vs. uno solo. Recomiendo 2.
