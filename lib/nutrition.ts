/**
 * Nutrition flow helpers — the connective tissue that turns a Recipe into a
 * Meal, a Meal Plan entry, and Shopping List items.
 *
 * Recipe = source of truth. These helpers read a recipe's stored macros /
 * ingredients and write into the user-owned tables (meal_plans, meal_logs,
 * shopping_lists), so pages never re-implement this logic.
 *
 * All writes set user_id (RLS-required). Every function returns a small result
 * object { ok, error?, ... } so callers can surface success/failure in the UI.
 */

import { createClient } from "@/lib/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

// Canonical meal slots — the SAME set the Meal Planner uses, in chronological
// order. This is the single source of truth for slots across the app (modal,
// recipe detail, assignment save). Legacy plan_data may still contain a bare
// "Snack" key from older versions; readers normalize it to "Snack PM" (see the
// Meal Planner's normalizeDaySlots), and no migration is required because
// plan_data is schemaless JSONB.
export const MEAL_SLOTS = ["Breakfast", "Snack AM", "Lunch", "Snack PM", "Dinner"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

// The meal_logs.meal_type column uses a 4-value domain (no AM/PM split). Plan
// slots map to it when logging a meal: "Snack AM"/"Snack PM" → "Snack".
export type MealLogType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export const PLAN_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type PlanDay = (typeof PLAN_DAYS)[number];

/**
 * A slot in plan_data can hold either:
 *  - legacy: a bare recipe-id string (older data / other writers)
 *  - structured: { recipeId, servings } (assignment-based planning)
 *  - null (empty)
 * `readSlot()` normalizes both forms so every reader is agnostic to shape.
 * This keeps the model backward-compatible while adding per-slot servings,
 * and leaves room to grow (e.g. drag-and-drop ordering) without a migration.
 */
export interface PlanSlotEntry {
  recipeId: string;
  servings: number;
  // Adherence: whether the user actually ate this planned meal. Optional so
  // legacy/plain entries default to "pending" (false). Stored in the schemaless
  // plan_data JSONB — no migration needed.
  consumed?: boolean;
}
export type PlanSlotValue = string | PlanSlotEntry | null;
type PlanData = Record<string, Record<string, PlanSlotValue>>;

/** Normalize any slot value into { recipeId, servings, consumed } | null. */
export function readSlot(value: PlanSlotValue | undefined): PlanSlotEntry | null {
  if (!value) return null;
  if (typeof value === "string") return { recipeId: value, servings: 1, consumed: false };
  if (typeof value === "object" && typeof value.recipeId === "string") {
    return { recipeId: value.recipeId, servings: value.servings > 0 ? value.servings : 1, consumed: value.consumed === true };
  }
  return null;
}

// ── Assignment-based planning ────────────────────────────────────────────────

export interface MealPlanAssignment {
  day: PlanDay;
  slot: MealSlot;
  servings: number;
}

export interface RecipeIngredientInput {
  name: string;
  quantity: number;
  unit: string;
}

export interface RecipeMacros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
}

export interface MutationResult {
  ok: boolean;
  error?: string;
}

// ── Date helpers ────────────────────────────────────────────────────────────

/** Monday-based ISO week bounds for the week containing `ref` (default: today). */
export function getWeekBounds(ref: Date = new Date()): { start: string; end: string } {
  const dayOfWeek = ref.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(ref);
  monday.setDate(ref.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

/** The PlanDay name (Monday…Sunday) for a given date (default: today). */
export function getPlanDayForDate(ref: Date = new Date()): PlanDay {
  const dayOfWeek = ref.getDay(); // 0=Sun … 6=Sat
  const index = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday-first
  return PLAN_DAYS[index];
}

/**
 * Map a plan (week_start_date, PlanDay) pair to the concrete calendar date
 * string (YYYY-MM-DD). `weekStart` is the Monday; PLAN_DAYS[0] === Monday,
 * so the offset is the day's index in PLAN_DAYS. Parses in UTC to avoid TZ
 * drift (week_start_date is a bare date).
 */
export function planEntryDate(weekStart: string, day: string): string | null {
  const idx = (PLAN_DAYS as readonly string[]).indexOf(day);
  if (idx < 0) return null;
  const d = new Date(`${weekStart}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + idx);
  return d.toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyPlan(): PlanData {
  const plan: PlanData = {};
  for (const day of PLAN_DAYS) {
    plan[day] = { "Breakfast": null, "Snack AM": null, "Lunch": null, "Snack PM": null, "Dinner": null };
  }
  return plan;
}

/**
 * Pick a sensible default meal slot for a recipe. Uses the recipe's own
 * meal_type when present; otherwise falls back to "Snack" (the neutral slot).
 */
export function defaultSlotForRecipe(mealType?: string | null): MealSlot {
  // Legacy value "Snack" (from older data / recipe meal_type) maps to "Snack PM".
  if (mealType === "Snack") return "Snack PM";
  if (mealType && (MEAL_SLOTS as readonly string[]).includes(mealType)) {
    return mealType as MealSlot;
  }
  return "Snack PM";
}

// Keyword hints for slot inference. Matched (accent-insensitive, lowercased)
// against the recipe name + ingredient names. Order of checks below decides
// precedence when a recipe matches more than one group.
const SLOT_KEYWORDS: Record<"Breakfast" | "Lunch" | "Dinner", string[]> = {
  Breakfast: [
    "egg", "huevo", "oat", "avena", "oatmeal", "pancake", "panqueque", "toast",
    "tostada", "pan", "bread", "yogur", "yogurt", "yoghurt", "granola",
    "cereal", "smoothie", "batido", "waffle", "bagel", "muffin", "fruit", "fruta",
    "breakfast", "desayuno", "coffee", "cafe", "café",
  ],
  Lunch: [
    "rice", "arroz", "chicken", "pollo", "beef", "carne", "steak", "fish",
    "pescado", "salmon", "salmón", "tuna", "atun", "atún", "pasta", "noodle",
    "fideos", "burrito", "taco", "bowl", "sandwich", "sándwich", "wrap",
    "lunch", "almuerzo", "quinoa", "lentil", "lenteja", "bean", "frijol",
    "potato", "papa", "patata",
  ],
  Dinner: [
    "dinner", "cena", "soup", "sopa", "stew", "guiso", "roast", "asado",
    "grilled", "asada", "vegetable", "verdura", "vegetables", "veggie",
    "salad", "ensalada",
  ],
};

/**
 * Suggest an initial meal slot for a recipe (a recommendation only — the user
 * can always change it, and nothing is persisted). Precedence:
 *   1. The recipe's own meal_type when it is a valid slot.
 *   2. Keyword inference from the recipe name + ingredient names.
 *   3. Fallback to "Snack".
 * Uses only data already present on the recipe; adds no fields.
 */
export function suggestSlotForRecipe(input: {
  recommendedMealType?: string | null;
  mealType?: string | null;
  name?: string | null;
  ingredients?: { name?: string | null }[] | null;
}): MealSlot {
  // 0. The recipe creator's recommendation wins — it's already a 5-slot value.
  if (input.recommendedMealType && (MEAL_SLOTS as readonly string[]).includes(input.recommendedMealType)) {
    return input.recommendedMealType as MealSlot;
  }
  // 1. Legacy meal_type (4-value) as fallback ("Snack" maps to "Snack PM").
  if (input.mealType === "Snack") return "Snack PM";
  if (input.mealType && (MEAL_SLOTS as readonly string[]).includes(input.mealType)) {
    return input.mealType as MealSlot;
  }

  // Build a normalized haystack from name + ingredient names.
  const normalize = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const haystack = normalize(
    [input.name ?? "", ...(input.ingredients ?? []).map((i) => i?.name ?? "")].join(" "),
  );

  // 2. Keyword inference. Word-boundary match to avoid partial hits.
  const matches = (kw: string) =>
    new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(haystack);

  // Check in a sensible precedence order (Breakfast → Lunch → Dinner).
  const order: ("Breakfast" | "Lunch" | "Dinner")[] = ["Breakfast", "Lunch", "Dinner"];
  for (const slot of order) {
    if (SLOT_KEYWORDS[slot].some(matches)) return slot;
  }

  // 3. Neutral fallback.
  return "Snack PM";
}

// ── 1. Recipe → Meal Plan ─────────────────────────────────────────────────────

/**
 * Assign a recipe to a slot in the current week's meal plan.
 * Loads (or creates) the week's meal_plans row and sets plan_data[day][slot].
 */
export async function addRecipeToMealPlan(
  recipeId: string,
  opts: { day?: PlanDay; slot: MealSlot }
): Promise<MutationResult & { day?: PlanDay; slot?: MealSlot; weekStart?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const day = opts.day ?? getPlanDayForDate();
  const { start, end } = getWeekBounds();

  const { data: existing, error: loadErr } = await supabase
    .from("meal_plans")
    .select("id, plan_data")
    .eq("user_id", user.id)
    .eq("week_start_date", start)
    .eq("week_end_date", end)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const plan: PlanData = (existing?.plan_data as PlanData) ?? emptyPlan();
  if (!plan[day]) plan[day] = { "Breakfast": null, "Snack AM": null, "Lunch": null, "Snack PM": null, "Dinner": null };
  plan[day][opts.slot] = recipeId;

  if (existing?.id) {
    const { error } = await supabase
      .from("meal_plans")
      .update({ plan_data: plan as never })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("meal_plans")
      .insert({
        user_id: user.id,
        week_start_date: start,
        week_end_date: end,
        plan_data: plan as never,
        is_saved: true,
      });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, day, slot: opts.slot, weekStart: start };
}

/**
 * Assignment-based meal planning: write MANY (day, slot, servings) entries for
 * a single recipe in ONE save. This is the long-term planning API.
 *
 * Behavior:
 *  - Loads (or creates) the current week's meal_plans row.
 *  - Writes each assignment as a structured { recipeId, servings } slot value.
 *  - Deduplicates: if the SAME recipe is already in a day/slot, it is skipped
 *    (reported in `skipped`) rather than duplicated. If a DIFFERENT recipe
 *    occupies the slot, it is overwritten (reported in `replaced`).
 *  - Supports different servings per assignment.
 *
 * Returns counts so the UI can show "Recipe added to N meal plan slots" and
 * warn about skipped duplicates.
 */
export async function saveMealPlanAssignments(
  recipeId: string,
  assignments: MealPlanAssignment[]
): Promise<
  MutationResult & {
    added?: number;
    skipped?: { day: PlanDay; slot: MealSlot }[];
    replaced?: number;
    weekStart?: string;
  }
> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  if (!assignments || assignments.length === 0) {
    return { ok: false, error: "Add at least one assignment." };
  }

  const { start, end } = getWeekBounds();

  const { data: existing, error: loadErr } = await supabase
    .from("meal_plans")
    .select("id, plan_data")
    .eq("user_id", user.id)
    .eq("week_start_date", start)
    .eq("week_end_date", end)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const plan: PlanData = (existing?.plan_data as PlanData) ?? emptyPlan();

  // Collapse duplicate assignments in the SAME request (same day+slot); keep
  // the last servings value the user set for that cell.
  const requested = new Map<string, MealPlanAssignment>();
  for (const a of assignments) {
    requested.set(`${a.day}|${a.slot}`, {
      day: a.day,
      slot: a.slot,
      servings: a.servings > 0 ? a.servings : 1,
    });
  }

  let added = 0;
  let replaced = 0;
  const skipped: { day: PlanDay; slot: MealSlot }[] = [];

  for (const a of requested.values()) {
    if (!plan[a.day]) {
      plan[a.day] = { "Breakfast": null, "Snack AM": null, "Lunch": null, "Snack PM": null, "Dinner": null };
    }
    const current = readSlot(plan[a.day][a.slot]);
    if (current?.recipeId === recipeId) {
      // Same recipe already scheduled here — do not duplicate.
      skipped.push({ day: a.day, slot: a.slot });
      continue;
    }
    if (current) replaced++;
    plan[a.day][a.slot] = { recipeId, servings: a.servings };
    added++;
  }

  if (added === 0) {
    // Nothing new to write (all duplicates) — surface as a soft warning.
    return { ok: true, added: 0, skipped, replaced, weekStart: start };
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("meal_plans")
      .update({ plan_data: plan as never })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("meal_plans")
      .insert({
        user_id: user.id,
        week_start_date: start,
        week_end_date: end,
        plan_data: plan as never,
        is_saved: true,
      });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, added, skipped, replaced, weekStart: start };
}

// ── 2. Recipe → Meal log ──────────────────────────────────────────────────────

/**
 * Log a meal directly from a recipe. Macros are taken from the recipe and
 * multiplied by `servings`, so the user never types nutrition manually.
 * Stores recipe_id for provenance.
 */
export async function logMealFromRecipe(
  recipe: { id: string; name: string; meal_type?: string | null } & RecipeMacros,
  opts: { servings?: number; slot?: MealSlot; date?: string } = {}
): Promise<MutationResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const servings = opts.servings && opts.servings > 0 ? opts.servings : 1;
  const slot = opts.slot ?? defaultSlotForRecipe(recipe.meal_type);
  // meal_logs.meal_type uses the 4-value domain (Breakfast/Lunch/Dinner/Snack).
  // Collapse the plan's AM/PM snack slots to "Snack" for that column — no schema
  // change; meal-plan slots remain 5 in plan_data.
  const mealLogType: MealLogType =
    slot === "Snack AM" || slot === "Snack PM" ? "Snack" : slot;

  const { error } = await supabase.from("meal_logs").insert({
    user_id: user.id,
    recipe_id: recipe.id,
    meal_type: mealLogType,
    name: recipe.name,
    calories: Math.round((recipe.calories || 0) * servings),
    protein: Math.round((recipe.protein || 0) * servings),
    carbs: Math.round((recipe.carbs || 0) * servings),
    fat: Math.round((recipe.fat || 0) * servings),
    servings,
    date: opts.date ?? todayKey(),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── 3. Recipe → Shopping List ─────────────────────────────────────────────────

/**
 * Normalize an ingredient name for de-duplication (case/space-insensitive).
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// ── Shopping list: row model + single merge engine ───────────────────────────
// Phase 2: the shopping list is now row-per-item in `shopping_list_items`
// (migration 00014). These helpers are the SINGLE source of truth for combining
// ingredients; the page, "add from recipe" and "generate from meal plan" all go
// through mergeRows. The legacy `shopping_lists` JSON blob is kept only as a
// backup and is no longer read/written by the app.

// The 7 fixed categories (mirror of the shopping_item_category enum).
export const SHOPPING_CATEGORIES = [
  "Produce", "Protein", "Dairy", "Grains", "Pantry", "Beverages", "Other",
] as const;
export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

/**
 * Map an ingredient's catalog category (ingredient_category) to a shopping
 * category. Anything unknown/missing falls back to "Other" — never blocks the
 * flow (per approved criteria).
 */
export function mapIngredientCategory(cat?: string | null): ShoppingCategory {
  switch (cat) {
    case "Vegetable":
    case "Fruit":        return "Produce";
    case "Protein":      return "Protein";
    case "Dairy":        return "Dairy";
    case "Carbohydrate": return "Grains";
    case "Beverage":     return "Beverages";
    case "Fat":          return "Pantry";
    default:             return "Other";
  }
}

// A structured shopping-list row (matches shopping_list_items).
export interface ShoppingListItemRow {
  id: string;
  name: string;
  qty: number | null;
  unit: string;
  category: ShoppingCategory;
  checked: boolean;
  source_recipe_id?: string | null;
  // All recipes that contributed to this item (provenance / "from N recipes").
  source_recipe_ids?: string[] | null;
  sort_order?: number;
}

// An ingredient to merge in. Optional category/sourceRecipeId enable
// autocategorization + traceability when coming from a recipe.
export interface MergeIngredientInput {
  name: string;
  quantity: number;
  unit: string;
  category?: ShoppingCategory;
  sourceRecipeId?: string | null;
}

/**
 * SINGLE MERGE ENGINE (pure). Combine `incoming` ingredients into `rows`,
 * deduping by (normalized name + unit): same key → sum qty; different unit or
 * NULL qty → separate qualified line. Preserves `checked` (an incoming item is
 * "pending", so a merge with a checked row flips it back to pending — anything
 * still needed shows as pending). Returns the new row set (no I/O).
 */
export function mergeRows(
  rows: ShoppingListItemRow[],
  incoming: MergeIngredientInput[],
  multiplier = 1
): ShoppingListItemRow[] {
  const out = rows.map((r) => ({ ...r }));
  const indexByKey = new Map<string, number>();
  out.forEach((r, i) => indexByKey.set(`${normalizeName(r.name)}|${r.unit}`, i));

  for (const ing of incoming) {
    if (!ing.name?.trim()) continue;
    const unit = ing.unit || "";
    const addQty = (ing.quantity || 0) * multiplier;
    const key = `${normalizeName(ing.name)}|${unit}`;
    const idx = indexByKey.get(key);

    if (idx === undefined) {
      out.push({
        id: crypto.randomUUID(),
        name: ing.name.trim(),
        qty: Math.round(addQty * 100) / 100,
        unit,
        category: ing.category ?? "Other",
        checked: false,
        source_recipe_id: ing.sourceRecipeId ?? null,
        source_recipe_ids: ing.sourceRecipeId ? [ing.sourceRecipeId] : [],
        sort_order: out.length,
      });
      indexByKey.set(key, out.length - 1);
      continue;
    }

    const cur = out[idx];
    // Accumulate provenance recipe ids (unique).
    const ids = new Set(cur.source_recipe_ids ?? (cur.source_recipe_id ? [cur.source_recipe_id] : []));
    if (ing.sourceRecipeId) ids.add(ing.sourceRecipeId);
    out[idx] = {
      ...cur,
      qty: cur.qty == null ? Math.round(addQty * 100) / 100 : Math.round((cur.qty + addQty) * 100) / 100,
      // If either side is pending, the merged item is pending (still needed).
      checked: cur.checked && false,
      source_recipe_ids: Array.from(ids),
    };
  }
  return out;
}

/**
 * Merge two existing rows (used when an inline edit makes row A collide with an
 * existing row B: same normalized name + unit). Sums qty, keeps pending if
 * either was pending. Pure.
 */
export function mergeTwoRows(a: ShoppingListItemRow, b: ShoppingListItemRow): ShoppingListItemRow {
  const qa = a.qty ?? 0;
  const qb = b.qty ?? 0;
  const bothNull = a.qty == null && b.qty == null;
  return {
    ...a,
    qty: bothNull ? null : Math.round((qa + qb) * 100) / 100,
    checked: a.checked && b.checked, // pending if either is pending
  };
}

/** Load the current user's shopping list rows (ordered for display). */
export async function loadShoppingListItems(): Promise<ShoppingListItemRow[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("shopping_list_items")
    .select("id, name, qty, unit, category, checked, source_recipe_id, source_recipe_ids, sort_order")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });
  return (data as ShoppingListItemRow[] | null) ?? [];
}

/**
 * Add a recipe's ingredients to the user's shopping list (row model). Loads the
 * user's rows, merges via the single engine (autocategorizing from the catalog
 * by name), and upserts the affected rows into `shopping_list_items`. Signature
 * is unchanged for callers (recipe detail / grid).
 */
export async function addRecipeIngredientsToShoppingList(
  ingredients: RecipeIngredientInput[],
  opts: { multiplier?: number; sourceRecipeId?: string | null } = {}
): Promise<MutationResult & { addedCount?: number }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  if (!ingredients || ingredients.length === 0) {
    return { ok: false, error: "This recipe has no ingredients to add." };
  }

  // Resolve categories from the catalog by name (case-insensitive). Missing →
  // Other (never blocks).
  const names = ingredients.map((i) => i.name);
  const { data: catRows } = await supabase
    .from("ingredients")
    .select("name, category")
    .in("name", names);
  const catByName = new Map<string, string>();
  for (const c of (catRows as { name: string; category: string }[] | null) ?? []) {
    catByName.set(normalizeName(c.name), c.category);
  }

  const existing = await loadShoppingListItems();
  const incoming: MergeIngredientInput[] = ingredients.map((ing) => ({
    name: ing.name,
    quantity: ing.quantity,
    unit: ing.unit,
    category: mapIngredientCategory(catByName.get(normalizeName(ing.name))),
    sourceRecipeId: opts.sourceRecipeId ?? null,
  }));

  const merged = mergeRows(existing, incoming, opts.multiplier ?? 1);

  const result = await persistMergedRows(user.id, existing, merged);
  if (!result.ok) return result;
  return { ok: true, addedCount: ingredients.length };
}

/**
 * Persist the difference between `before` and `after` row sets: insert new
 * rows, update changed ones. (Deletions aren't produced by merges.) Keeps
 * writes granular — no full-list rewrite.
 */
export async function persistMergedRows(
  userId: string,
  before: ShoppingListItemRow[],
  after: ShoppingListItemRow[]
): Promise<MutationResult & { inserted?: number; updated?: number }> {
  const supabase = createClient();
  const beforeById = new Map(before.map((r) => [r.id, r]));

  const toInsert: ShoppingListItemRow[] = [];
  const toUpdate: ShoppingListItemRow[] = [];
  for (const r of after) {
    const prev = beforeById.get(r.id);
    if (!prev) { toInsert.push(r); continue; }
    const idsChanged = (prev.source_recipe_ids ?? []).length !== (r.source_recipe_ids ?? []).length;
    if (prev.qty !== r.qty || prev.checked !== r.checked || prev.category !== r.category || prev.name !== r.name || prev.unit !== r.unit || idsChanged) {
      toUpdate.push(r);
    }
  }

  if (toInsert.length > 0) {
    const { error } = await supabase.from("shopping_list_items").insert(
      toInsert.map((r) => ({
        user_id: userId, name: r.name, qty: r.qty, unit: r.unit,
        category: r.category, checked: r.checked,
        source_recipe_id: r.source_recipe_id ?? null,
        source_recipe_ids: r.source_recipe_ids && r.source_recipe_ids.length ? r.source_recipe_ids : null,
        sort_order: r.sort_order ?? 0,
      })) as never
    );
    if (error) return { ok: false, error: error.message };
  }
  for (const r of toUpdate) {
    const { error } = await supabase.from("shopping_list_items")
      .update({ name: r.name, qty: r.qty, unit: r.unit, category: r.category, checked: r.checked,
        source_recipe_ids: r.source_recipe_ids && r.source_recipe_ids.length ? r.source_recipe_ids : null } as never)
      .eq("id", r.id);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, inserted: toInsert.length, updated: toUpdate.length };
}


/**
 * Generate/update the shopping list from a week's meal plan. Consolidates the
 * ingredients of every planned recipe (servings-weighted) through the SINGLE
 * merge engine (mergeRows), so it never duplicates and combines quantities
 * (e.g. Pollo 200g + Pollo 300g = Pollo 500g). Idempotent: re-running merges
 * instead of duplicating. Reused by both the Meal Planner and the Shopping List
 * page — one source of truth.
 */
export async function generateShoppingListFromWeek(
  weekStart: string
): Promise<MutationResult & { recipeCount?: number; added?: number; consolidated?: number }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const { data: planData } = await supabase
    .from("meal_plans")
    .select("plan_data")
    .eq("user_id", user.id)
    .eq("week_start_date", weekStart)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!planData || !planData.plan_data) return { ok: false, error: "NO_PLAN" };

  const plan = planData.plan_data as PlanData;
  const recipeIds = new Set<string>();
  const recipeServings: Record<string, number> = {};
  for (const day of Object.values(plan)) {
    for (const rawSlot of Object.values(day)) {
      const entry = readSlot(rawSlot);
      if (entry) {
        recipeIds.add(entry.recipeId);
        recipeServings[entry.recipeId] = (recipeServings[entry.recipeId] || 0) + entry.servings;
      }
    }
  }
  if (recipeIds.size === 0) return { ok: false, error: "PLAN_EMPTY" };

  const { data: recipesData } = await supabase
    .from("recipes")
    .select("id, recipe_ingredients ( name, quantity, unit )")
    .in("id", Array.from(recipeIds));
  if (!recipesData || recipesData.length === 0) return { ok: false, error: "LOAD_INGREDIENTS" };

  // Resolve categories from the catalog by name (fallback Other; never blocks).
  const allNames = new Set<string>();
  for (const r of recipesData) for (const ing of ((r.recipe_ingredients as { name: string }[]) || [])) allNames.add(ing.name);
  const { data: catRows } = await supabase.from("ingredients").select("name, category").in("name", Array.from(allNames));
  const catByName = new Map<string, string>();
  for (const c of (catRows as { name: string; category: string }[] | null) ?? []) {
    catByName.set(normalizeName(c.name), c.category);
  }

  const incoming: MergeIngredientInput[] = [];
  for (const recipe of recipesData) {
    const mult = recipeServings[recipe.id] || 1;
    for (const ing of ((recipe.recipe_ingredients as { name: string; quantity: number | null; unit: string | null }[]) || [])) {
      incoming.push({
        name: ing.name,
        quantity: (ing.quantity || 0) * mult,
        unit: ing.unit || "",
        category: mapIngredientCategory(catByName.get(normalizeName(ing.name))),
        sourceRecipeId: recipe.id,
      });
    }
  }

  const existing = await loadShoppingListItems();
  const merged = mergeRows(existing, incoming);
  const res = await persistMergedRows(user.id, existing, merged);
  if (!res.ok) return res;
  // added = brand-new rows; consolidated = existing rows whose qty was combined.
  return {
    ok: true,
    recipeCount: recipeIds.size,
    added: res.inserted ?? 0,
    consolidated: res.updated ?? 0,
  };
}

/** Resolve recipe ids → names for provenance display. Returns a name map. */
export async function getRecipeNames(ids: string[]): Promise<Record<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return {};
  const supabase = createClient();
  const { data } = await supabase.from("recipes").select("id, name").in("id", unique);
  const map: Record<string, string> = {};
  for (const r of (data as { id: string; name: string }[] | null) ?? []) map[r.id] = r.name;
  return map;
}
