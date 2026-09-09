-- ============================================================================
-- Movive — Shopping list item: multi-recipe provenance
-- Version: 00016
-- Purpose: Track ALL recipes that contribute to a shopping-list item (not just
--          one), so the UI can show "from N recipes" / list them. Additive and
--          nullable; the existing source_recipe_id stays for backward-compat.
-- ============================================================================

ALTER TABLE shopping_list_items
  ADD COLUMN IF NOT EXISTS source_recipe_ids UUID[];

COMMENT ON COLUMN shopping_list_items.source_recipe_ids IS
  'Recipe ids that contributed to this item (provenance). NULL/empty for manually added items.';

-- ============================================================================
-- END OF MIGRATION 00016
-- ============================================================================
