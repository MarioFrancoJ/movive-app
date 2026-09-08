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
}
export type PlanSlotValue = string | PlanSlotEntry | null;
type PlanData = Record<string, Record<string, PlanSlotValue>>;

/** Normalize any slot value into { recipeId, servings } | null. */
export function readSlot(value: PlanSlotValue | undefined): PlanSlotEntry | null {
  if (!value) return null;
  if (typeof value === "string") return { recipeId: value, servings: 1 };
  if (typeof value === "object" && typeof value.recipeId === "string") {
    return { recipeId: value.recipeId, servings: value.servings > 0 ? value.servings : 1 };
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
  mealType?: string | null;
  name?: string | null;
  ingredients?: { name?: string | null }[] | null;
}): MealSlot {
  // 1. Explicit meal_type wins (legacy "Snack" maps to "Snack PM").
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

/** Parse a stringified quantity like "500 g" or "2" into { qty, unit }. */
function parseQuantity(raw: string): { qty: number; unit: string } {
  const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!match) return { qty: NaN, unit: raw.trim() };
  return { qty: parseFloat(match[1]), unit: match[2].trim() };
}

function formatQuantity(qty: number, unit: string): string {
  const rounded = Math.round(qty * 100) / 100;
  return `${rounded}${unit ? ` ${unit}` : ""}`.trim();
}

/**
 * Merge a set of recipe ingredients into an existing shopping-list item array,
 * combining duplicates by name and summing quantities when units match.
 * Pure function — exported for reuse/testing.
 */
export function mergeIngredientsIntoItems(
  existing: ShoppingItem[],
  ingredients: RecipeIngredientInput[],
  multiplier = 1
): ShoppingItem[] {
  const items = existing.map((i) => ({ ...i }));
  const indexByName = new Map<string, number>();
  items.forEach((item, i) => indexByName.set(normalizeName(item.name), i));

  for (const ing of ingredients) {
    if (!ing.name?.trim()) continue;
    const key = normalizeName(ing.name);
    const addQty = (ing.quantity || 0) * multiplier;
    const idx = indexByName.get(key);

    if (idx === undefined) {
      items.push({
        id: crypto.randomUUID(),
        name: ing.name.trim(),
        quantity: formatQuantity(addQty, ing.unit || ""),
        checked: false,
      });
      indexByName.set(key, items.length - 1);
      continue;
    }

    // Combine with an existing item when the units are compatible.
    const current = items[idx];
    const parsed = parseQuantity(current.quantity);
    const sameUnit = (parsed.unit || "") === (ing.unit || "");
    if (!Number.isNaN(parsed.qty) && sameUnit) {
      items[idx] = {
        ...current,
        quantity: formatQuantity(parsed.qty + addQty, ing.unit || ""),
      };
    } else {
      // Units differ or unparseable — append as a separate qualified line.
      items.push({
        id: crypto.randomUUID(),
        name: ing.name.trim(),
        quantity: formatQuantity(addQty, ing.unit || ""),
        checked: false,
      });
    }
  }

  return items;
}

/**
 * Add a recipe's ingredients to the user's shopping list. Loads (or creates)
 * the most recent shopping list, merges ingredients (combining duplicates),
 * and persists.
 */
export async function addRecipeIngredientsToShoppingList(
  ingredients: RecipeIngredientInput[],
  opts: { multiplier?: number } = {}
): Promise<MutationResult & { addedCount?: number }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  if (!ingredients || ingredients.length === 0) {
    return { ok: false, error: "This recipe has no ingredients to add." };
  }

  const { data: list, error: loadErr } = await supabase
    .from("shopping_lists")
    .select("id, items")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message };

  const existingItems: ShoppingItem[] = (((list?.items as unknown) as ShoppingItem[]) ?? []).map((i) => ({
    id: i.id || crypto.randomUUID(),
    name: i.name || "",
    quantity: i.quantity || "—",
    checked: i.checked || false,
  }));

  const merged = mergeIngredientsIntoItems(existingItems, ingredients, opts.multiplier ?? 1);

  if (list?.id) {
    const { error } = await supabase
      .from("shopping_lists")
      .update({ items: merged as never })
      .eq("id", list.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("shopping_lists")
      .insert({ user_id: user.id, items: merged as never });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, addedCount: ingredients.length };
}
