-- ============================================================================
-- Movive — Ingredient unit_weight (unit → grams conversion)
-- Version: 00013
-- Purpose: The nutrition auto-calculate treats an ingredient quantity as grams
--          and computes factor = quantity / 100. That is correct only for
--          gram-based ingredients. For ingredients measured in discrete units
--          (e.g. "Huevo Entero", unit = 'unit'; a bread 'slice'; a protein
--          'scoop') or in volume (unit = 'ml'), the quantity is NOT grams, so
--          2 eggs were read as 2 g → ~3 kcal instead of ~155.
--
--          unit_weight = how many real grams ONE unit of the ingredient weighs.
--          Auto-calculate converts before applying the per-100g macros:
--              effectiveGrams = (unit = 'g') ? quantity : quantity * unit_weight
--              factor         = effectiveGrams / 100
--
--          Examples: Huevo Entero (unit) → 50 · Banano (unit) → 120
--                    Pan Tajado (slice) → 30 · Scoop Proteína (scoop) → 35
--
-- Backward compatible: column is NULLABLE and unused for gram-based ingredients
-- (unit = 'g'). Existing rows keep working unchanged.
-- ============================================================================

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS unit_weight DECIMAL(7,2);

-- Seed unit_weight for the current non-gram ingredients.
-- Unit-based:
UPDATE ingredients SET unit_weight = 50   WHERE name = 'Huevo Entero'           AND unit_weight IS NULL;
-- Volume-based (density ≈ g/ml). Water-like liquids ≈ 1.0; olive oil ≈ 0.91.
UPDATE ingredients SET unit_weight = 0.91 WHERE name = 'Aceite de Oliva'         AND unit_weight IS NULL;
UPDATE ingredients SET unit_weight = 1.00 WHERE name = 'Agua de Panela'          AND unit_weight IS NULL;
UPDATE ingredients SET unit_weight = 1.00 WHERE name = 'Café Negro'              AND unit_weight IS NULL;
UPDATE ingredients SET unit_weight = 1.00 WHERE name = 'Jugo de Naranja Natural' AND unit_weight IS NULL;
UPDATE ingredients SET unit_weight = 1.00 WHERE name = 'Leche de Almendras'      AND unit_weight IS NULL;
UPDATE ingredients SET unit_weight = 1.03 WHERE name = 'Leche Entera'            AND unit_weight IS NULL;

-- ============================================================================
-- END OF MIGRATION 00013
-- ============================================================================
