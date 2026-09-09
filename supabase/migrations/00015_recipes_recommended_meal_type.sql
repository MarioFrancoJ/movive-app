-- ============================================================================
-- Movive — recipes.recommended_meal_type (planner preselection)
-- Version: 00015
-- Purpose: Add an administrable "recommended meal type" to recipes — the moment
--          of the day a recipe fits best. It is a SUGGESTION used to preselect
--          the slot when adding a recipe to the meal plan (the user can change
--          it freely). Values match the planner's 5 slots exactly.
--
--          A NEW dedicated enum is used (NOT the shared `meal_type` enum, which
--          has 4 values and is also used by meal_logs NOT NULL). This keeps
--          recipe recommendations aligned 1:1 with MEAL_SLOTS without polluting
--          the meal-logging domain.
--
-- Backfill (data migration) is done by a Node script that reuses the app's
-- suggestSlotForRecipe (see scripts/backfill-recommended-meal-type.mjs) so the
-- default matches exactly what users already see in the modal. This migration
-- only creates the enum + column + index. Column starts NULLABLE; the app will
-- require it for NEW recipes at the form level (Admin). Existing rows are filled
-- by the backfill.
-- ============================================================================

-- ── New dedicated enum: the 5 planner slots ─────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recommended_meal_type') THEN
    CREATE TYPE recommended_meal_type AS ENUM (
      'Breakfast', 'Snack AM', 'Lunch', 'Snack PM', 'Dinner'
    );
  END IF;
END$$;

-- ── Column (nullable for now; backfilled below, required at form level) ──────
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS recommended_meal_type recommended_meal_type;

CREATE INDEX IF NOT EXISTS idx_recipes_recommended_meal_type
  ON recipes(recommended_meal_type);

COMMENT ON COLUMN recipes.recommended_meal_type IS
  'Business field (Opcion C): the recipe creator''s recommended time of day (Breakfast/Snack AM/Lunch/Snack PM/Dinner). A suggestion only — it preselects the meal-plan slot and feeds future automation; the user can assign the recipe to any slot. Distinct from meal_type (4-value, shared with meal_logs).';

-- meal_type on recipes is DEPRECATED as of 00015 (superseded by
-- recommended_meal_type). It is kept temporarily only because the catalog
-- filter still reads it; it is no longer written from the app and will be
-- dropped in a later migration (00016+) once that filter migrates.
COMMENT ON COLUMN recipes.meal_type IS
  'DEPRECATED (00015): superseded by recipes.recommended_meal_type, which is the live business field. Kept temporarily, read-only, for the catalog filter; scheduled for removal in 00016+. Do NOT write this from the app.';

-- NOTE: the backfill for existing recipes runs as a Node script (reuses
-- suggestSlotForRecipe). A pure-SQL fallback is provided below and is safe to
-- run too: it derives from the existing meal_type where possible, else Lunch.
-- The Node backfill (preferred) will overwrite NULLs with the keyword-inferred
-- value before this ever matters, but this guarantees no row stays NULL.
UPDATE recipes SET recommended_meal_type =
  CASE meal_type
    WHEN 'Breakfast' THEN 'Breakfast'::recommended_meal_type
    WHEN 'Lunch'     THEN 'Lunch'::recommended_meal_type
    WHEN 'Dinner'    THEN 'Dinner'::recommended_meal_type
    WHEN 'Snack'     THEN 'Snack PM'::recommended_meal_type
    ELSE 'Lunch'::recommended_meal_type
  END
WHERE recommended_meal_type IS NULL;

-- ============================================================================
-- END OF MIGRATION 00015
-- ============================================================================
