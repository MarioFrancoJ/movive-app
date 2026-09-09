#!/usr/bin/env node
/**
 * Backfill recipes.recommended_meal_type (migration 00015).
 *
 * Rule (approved):
 *   1. If recipes.meal_type is set → map it (Snack → Snack PM).
 *   2. Else infer with the SAME logic as lib/nutrition.ts suggestSlotForRecipe
 *      (recipe name + ingredient names, keyword match).
 *   3. If nothing infers a slot → "Lunch" (never leave NULL).
 *
 * Idempotent: only fills rows where recommended_meal_type IS NULL.
 * Non-destructive: never touches meal_type or any other column.
 *
 * Usage:
 *   node scripts/backfill-recommended-meal-type.mjs            # dry-run
 *   node scripts/backfill-recommended-meal-type.mjs --apply    # write
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const env = {};
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ── Mirror of lib/nutrition.ts SLOT_KEYWORDS + suggestSlotForRecipe ──────────
const SLOT_KEYWORDS = {
  Breakfast: ["egg","huevo","oat","avena","oatmeal","pancake","panqueque","toast","tostada","pan","bread","yogur","yogurt","yoghurt","granola","cereal","smoothie","batido","waffle","bagel","muffin","fruit","fruta","breakfast","desayuno","coffee","cafe","café"],
  Lunch: ["rice","arroz","chicken","pollo","beef","carne","steak","fish","pescado","salmon","salmón","tuna","atun","atún","pasta","noodle","fideos","burrito","taco","bowl","sandwich","sándwich","wrap","lunch","almuerzo","quinoa","lentil","lenteja","bean","frijol","potato","papa","patata"],
  Dinner: ["dinner","cena","soup","sopa","stew","guiso","roast","asado","grilled","asada","vegetable","verdura","vegetables","veggie","salad","ensalada"],
};
const normalize = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Returns a 5-slot value. Fallback to Lunch when no keyword matches (approved),
// instead of the app's neutral "Snack PM" (which is only for live UI suggestion).
function inferRecommended(mealType, name, ingredients) {
  if (mealType === "Snack") return "Snack PM";
  if (["Breakfast", "Lunch", "Dinner"].includes(mealType)) return mealType;
  // (meal_type has no AM/PM, so no direct Snack AM/PM here.)
  const haystack = normalize([name ?? "", ...(ingredients ?? []).map((i) => i?.name ?? "")].join(" "));
  const matches = (kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(haystack);
  for (const slot of ["Breakfast", "Lunch", "Dinner"]) {
    if (SLOT_KEYWORDS[slot].some(matches)) return slot;
  }
  return "Lunch"; // approved final default (no signal)
}

async function main() {
  console.log(`Backfill mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);

  const { data: recipes, error } = await sb
    .from("recipes")
    .select("id, name, meal_type, recommended_meal_type, recipe_ingredients(name)");
  if (error) { console.error("Read failed (is column present?):", error); process.exit(1); }

  let filled = 0, already = 0;
  for (const r of recipes || []) {
    if (r.recommended_meal_type) { already++; continue; }
    const value = inferRecommended(r.meal_type, r.name, r.recipe_ingredients || []);
    console.log(`  ${r.name}: meal_type=${r.meal_type ?? "null"} → recommended=${value}`);
    filled++;
    if (APPLY) {
      const { error: uErr } = await sb.from("recipes").update({ recommended_meal_type: value }).eq("id", r.id);
      if (uErr) { console.error(`   update failed for ${r.id}:`, uErr); process.exit(1); }
    }
  }

  console.log(`\nSummary: total=${recipes?.length ?? 0} filled=${filled} alreadySet=${already}`);
  console.log(APPLY ? "Done (applied)." : "Dry-run only. Re-run with --apply to write.");
  process.exit(0);
}
main();
