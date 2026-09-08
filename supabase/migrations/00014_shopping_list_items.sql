-- ============================================================================
-- Movive — Shopping List: row-per-item model
-- Version: 00014
-- Purpose: Replace the JSON-blob shopping list (shopping_lists.items) with a
--          proper row-per-item table. This is the DATA foundation only — the
--          frontend keeps using the old blob until Phase 2. The old table is
--          NOT modified or dropped; it stays as a rollback/backup mechanism.
--
--          Structured quantity (qty numeric + unit), fixed categories, and a
--          source_recipe_id for traceability. user_id is kept (RLS = own); a
--          household_id can be ADDED later (00015+) without re-migrating data.
--
-- Backward compatible / non-destructive: only creates NEW objects (type, table,
-- indexes, trigger, policies). No change to any existing table or data.
-- Idempotent where possible (IF NOT EXISTS).
-- ============================================================================

-- ── Category enum (7 values, per approval) ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shopping_item_category') THEN
    CREATE TYPE shopping_item_category AS ENUM (
      'Produce',    -- vegetables & fruit
      'Protein',    -- meat, egg, fish
      'Dairy',      -- dairy
      'Grains',     -- cereals, bread, pasta, rice
      'Pantry',     -- staples / condiments
      'Beverages',  -- drinks
      'Other'       -- unclassified
    );
  END IF;
END$$;

-- ── Row-per-item table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             VARCHAR(255) NOT NULL,
  qty              DECIMAL(10,2),                     -- nullable: items with no amount ("—")
  unit             VARCHAR(20)  NOT NULL DEFAULT '',
  category         shopping_item_category NOT NULL DEFAULT 'Other',
  checked          BOOLEAN NOT NULL DEFAULT FALSE,
  source_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_items_user
  ON shopping_list_items(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_user_cat
  ON shopping_list_items(user_id, category);
-- checked is a primary filter for the shopping list UI (bought vs pending).
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_user_checked
  ON shopping_list_items(user_id, checked);

-- updated_at auto-touch (reuses the project's shared trigger function).
DROP TRIGGER IF EXISTS shopping_list_items_updated_at ON shopping_list_items;
CREATE TRIGGER shopping_list_items_updated_at
  BEFORE UPDATE ON shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS (own — per user; mirrors current shopping_lists policies) ────────────
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopping_list_items_select_own" ON shopping_list_items;
CREATE POLICY "shopping_list_items_select_own"
  ON shopping_list_items FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopping_list_items_insert_own" ON shopping_list_items;
CREATE POLICY "shopping_list_items_insert_own"
  ON shopping_list_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopping_list_items_update_own" ON shopping_list_items;
CREATE POLICY "shopping_list_items_update_own"
  ON shopping_list_items FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopping_list_items_delete_own" ON shopping_list_items;
CREATE POLICY "shopping_list_items_delete_own"
  ON shopping_list_items FOR DELETE
  USING (auth.uid() = user_id);

-- NOTE: shopping_lists (JSON blob) is intentionally left untouched as a backup /
-- rollback mechanism. It will be retired in a later migration (00016+) only
-- after several weeks of verified production use.

-- ============================================================================
-- END OF MIGRATION 00014
-- ============================================================================
