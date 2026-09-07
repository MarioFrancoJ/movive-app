"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useToast } from "@/components/ui/Toast";
import {
  addRecipeIngredientsToShoppingList,
  logMealFromRecipe,
  suggestSlotForRecipe,
  MEAL_SLOTS,
  type MealSlot,
} from "@/lib/nutrition";
import MealPlanModal, { type MealPlanModalRecipe } from "@/components/nutrition/MealPlanModal";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type RecipeGoal = "Fat Loss" | "Muscle Gain" | "Maintenance";
type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

type NutritionDict = ReturnType<typeof useDictionary>["dict"]["nutrition"];

// Localized label for a goal badge (recipeDetail namespace has no goal keys,
// so we reuse the shared nutrition.recipes.goal* labels).
function goalLabel(goal: string, nt: NutritionDict): string {
  switch (goal) {
    case "Fat Loss":    return nt.recipes.goalFatLoss;
    case "Muscle Gain": return nt.recipes.goalMuscleGain;
    case "Maintenance": return nt.recipes.goalMaintenance;
    default:            return goal;
  }
}

// Localized label for a meal type / slot value.
function mealTypeLabel(type: string, nt: NutritionDict): string {
  switch (type) {
    case "Breakfast": return nt.mealTypeBreakfast;
    case "Lunch":     return nt.mealTypeLunch;
    case "Dinner":    return nt.mealTypeDinner;
    case "Snack":     return nt.mealTypeSnack;
    default:          return type;
  }
}

interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  goal: RecipeGoal;
  mealType: MealType | null;
  imageUrl: string | null;
  ingredients: RecipeIngredient[];
  servings: number;
  instructions: string[];
  prepTime: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function goalColor(goal: string) {
  switch (goal) {
    case "Fat Loss":    return "bg-success-light text-success";
    case "Muscle Gain": return "bg-blue-50 text-blue-700";
    case "Maintenance": return "bg-amber-50 text-amber-700";
    default:            return "bg-zinc-100 text-zinc-700";
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RecipeDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { dict } = useDictionary();
  const t = dict.nutrition.recipeDetail;
  const nt = dict.nutrition;
  const { success, error: toastError } = useToast();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Action controls (for logging + shopping; meal-plan uses the modal)
  const [slot, setSlot] = useState<MealSlot>("Snack");
  const [servings, setServings] = useState(1);
  const [busy, setBusy] = useState<null | "shop" | "log">(null);
  const [planModalRecipe, setPlanModalRecipe] = useState<MealPlanModalRecipe | null>(null);

  useEffect(() => {
    async function loadRecipe() {
      if (!id) { setLoading(false); setNotFound(true); return; }

      const supabase = createClient();

      const { data, error } = await supabase
        .from("recipes")
        .select(`
          id,
          name,
          description,
          goal,
          meal_type,
          image_url,
          servings,
          prep_time,
          calories,
          protein,
          carbs,
          fat,
          recipe_ingredients (
            id,
            name,
            quantity,
            unit
          ),
          recipe_instructions (
            id,
            step_number,
            instruction
          )
        `)
        .eq("id", id)
        .single();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const loaded: Recipe = {
        id: data.id,
        name: data.name,
        description: data.description || "",
        goal: (data.goal || "Maintenance") as RecipeGoal,
        mealType: (data.meal_type || null) as MealType | null,
        imageUrl: data.image_url || null,
        servings: data.servings || 1,
        prepTime: data.prep_time || 0,
        calories: data.calories || 0,
        protein: data.protein || 0,
        carbs: data.carbs || 0,
        fat: data.fat || 0,
        ingredients: (data.recipe_ingredients || []).map((ing: any) => ({
          id: ing.id,
          name: ing.name,
          quantity: ing.quantity || 0,
          unit: ing.unit || "",
        })),
        instructions: (data.recipe_instructions || [])
          .sort((a: any, b: any) => (a.step_number || 0) - (b.step_number || 0))
          .map((inst: any) => inst.instruction),
      };

      setRecipe(loaded);
      // Recommend an initial meal slot from the recipe's own meal_type, or infer
      // it from the name + ingredients. Only a default — the user can change it.
      setSlot(suggestSlotForRecipe({
        mealType: loaded.mealType,
        name: loaded.name,
        ingredients: loaded.ingredients,
      }));
      setLoading(false);
    }
    loadRecipe();
  }, [id]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  function handleAddToPlan() {
    if (!recipe) return;
    // Open the assignment-based modal (multi-day / multi-slot / servings).
    setPlanModalRecipe({
      id: recipe.id,
      name: recipe.name,
      mealType: recipe.mealType as MealSlot | null,
      calories: recipe.calories,
      goal: recipe.goal,
    });
  }

  async function handleAddToShopping() {
    if (!recipe || busy) return;
    setBusy("shop");
    const res = await addRecipeIngredientsToShoppingList(recipe.ingredients, { multiplier: servings });
    setBusy(null);
    if (res.ok) success(nt.recipes.toastAddedIngredients.replace("{n}", String(res.addedCount)));
    else toastError(res.error || nt.recipes.toastAddError);
  }

  async function handleLogMeal() {
    if (!recipe || busy) return;
    setBusy("log");
    const res = await logMealFromRecipe(recipe, { servings, slot });
    setBusy(null);
    if (res.ok) {
      success(
        t.toastLogged
          .replace("{n}", String(servings))
          .replace("{name}", recipe.name)
          .replace("{cal}", String(Math.round(recipe.calories * servings))),
      );
    } else {
      toastError(res.error || t.toastLogError);
    }
  }

  if (loading) {
    return <PageLoader text={t.loading} />;
  }

  if (notFound || !recipe) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="mb-2 text-lg font-semibold text-zinc-900">{t.notFoundTitle}</p>
        <p className="mb-6 text-golden-sm text-zinc-500">{t.notFoundDescription}</p>
        <Link
          href="/nutrition/recipes"
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-golden-sm font-semibold text-white hover:bg-primary-hover"
        >
          {t.backToRecipes}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        href="/nutrition/recipes"
        className="inline-flex items-center gap-1 text-golden-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
      >
        {t.backToRecipes}
      </Link>

      {/* Header — title, description, info chips in one line */}
      <div>
        <h1 className="text-golden-xl font-bold tracking-tight text-zinc-900">{recipe.name}</h1>
        {recipe.description && (
          <p className="mt-1 text-golden-sm text-zinc-500">{recipe.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-golden-xs font-semibold ${goalColor(recipe.goal)}`}>
            {goalLabel(recipe.goal, nt)}
          </span>
          {recipe.prepTime > 0 && (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-golden-xs font-medium text-zinc-600">
              {t.prepSuffix.replace("{n}", String(recipe.prepTime))}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-golden-xs font-medium text-zinc-600">
            {t.servings.replace("{n}", String(recipe.servings))}
          </span>
          {recipe.mealType && (
            <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-golden-xs font-medium text-zinc-600">
              {mealTypeLabel(recipe.mealType, nt)}
            </span>
          )}
        </div>
      </div>

      {/* Hero + body in one dense grid so the whole recipe fits a laptop's first
          viewport. Photo is a supporting element (~33%); the info column (~67%)
          carries a one-line nutrition summary, compact ingredients + instructions,
          and the actions. On mobile everything stacks (photo first). */}
      <div className="grid gap-5 xl:grid-cols-[7fr_13fr] xl:items-start">
        {/* Photo — ~33% (col-span-4). Fills the info column's height on desktop.
            On mobile/tablet the box is full-width with a fixed height (object-cover
            handles the crop) so it never shrinks narrower than the info cards.
            Using aspect-ratio + max-height would force the box to shrink its WIDTH
            to preserve the ratio once the capped height is hit — that was the bug. */}
        <div className="w-full overflow-hidden rounded-2xl bg-zinc-100 h-64 xl:h-full xl:max-h-none xl:self-stretch xl:min-h-[320px]">
          {recipe.imageUrl ? (
            // object-cover fills the column edge-to-edge (no empty box), centered.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={recipe.imageUrl} alt={recipe.name} className="h-full w-full object-cover object-center" />
          ) : (
            <div className="flex h-full min-h-[180px] w-full items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-zinc-400">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8" strokeWidth="1.5" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-golden-xs font-medium">{t.recipePhoto}</span>
              </div>
            </div>
          )}
        </div>

        {/* Info column — ~67% (col-span-8) */}
        <div className="flex flex-col gap-4">
          {/* Nutrition — single horizontal line: calories | protein | carbs | fat.
              Macro dots use the Movive green family (no generic blue/orange). */}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            {/* Calories lead the hierarchy: larger + heavier. Macros stay inline. */}
            <span className="flex items-baseline gap-1">
              <span className="text-golden-xl font-bold leading-none text-zinc-900">{recipe.calories}</span>
              <span className="text-golden-xs font-semibold uppercase tracking-wide text-zinc-500">{t.macroKcal}</span>
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-golden-sm">
              {[
                { label: t.protein, grams: recipe.protein, dot: "bg-movive-600" },
                { label: t.carbs, grams: recipe.carbs, dot: "bg-movive-800" },
                { label: t.fat, grams: recipe.fat, dot: "bg-movive-500" },
              ].map((m) => (
                <span key={m.label} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                  <span className="font-semibold text-zinc-900">{m.grams} g</span>
                  <span className="text-zinc-500">{m.label.toLowerCase()}</span>
                </span>
              ))}
            </span>
          </div>

          {/* Ingredients — dense list with dotted leaders (name … amount) */}
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
            <h2 className="mb-1 text-golden-xs font-semibold uppercase tracking-widest text-zinc-400">
              {t.ingredients}
            </h2>
            {recipe.ingredients.length === 0 ? (
              <p className="text-golden-sm text-zinc-400">{t.noIngredients}</p>
            ) : (
              <ul className="flex max-h-40 flex-col overflow-y-auto pr-1">
                {recipe.ingredients.map((item) => (
                  <li key={item.id} className="flex items-baseline gap-2 py-[3px] text-golden-sm text-zinc-700">
                    <span>{item.name}</span>
                    <span className="min-w-0 flex-1 translate-y-[-0.2em] border-b border-dotted border-zinc-200" aria-hidden="true" />
                    <span className="shrink-0 font-medium text-zinc-500">{item.quantity} {item.unit}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Instructions — compact numbered steps */}
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
            <h2 className="mb-1 text-golden-xs font-semibold uppercase tracking-widest text-zinc-400">
              {t.instructions}
            </h2>
            {recipe.instructions.length === 0 ? (
              <p className="text-golden-sm text-zinc-400">{t.noInstructions}</p>
            ) : (
              <ol className="flex max-h-44 flex-col gap-1 overflow-y-auto pr-1">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-2 text-golden-sm text-zinc-700">
                    <span className="shrink-0 font-bold text-primary-fg">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Actions — Meal + Servings + short buttons with icons */}
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            {/* Meal + servings — meal select narrowed (~30%) since options are
                short; frees width and keeps the row tidy. */}
            <div className="flex items-end gap-3">
              <div className="w-40">
                <label htmlFor="meal-slot" className="mb-1 block text-golden-xs font-medium text-zinc-600">{t.mealLabel}</label>
                <select
                  id="meal-slot"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value as MealSlot)}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-golden-sm text-zinc-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {MEAL_SLOTS.map((m) => (
                    <option key={m} value={m}>{mealTypeLabel(m, nt)}</option>
                  ))}
                </select>
              </div>
              <div className="w-20">
                <label htmlFor="servings" className="mb-1 block text-golden-xs font-medium text-zinc-600">{t.servingsLabel}</label>
                <input
                  id="servings"
                  type="number"
                  min={1}
                  step={1}
                  value={servings}
                  onChange={(e) => setServings(Math.max(1, Math.round(Number(e.target.value) || 1)))}
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-golden-sm text-zinc-700 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Per-serving nutrition summary — Movive macro naming + colors,
                mirroring the top nutrition line for visual continuity. Extra top
                spacing separates it from the selectors. */}
            <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-golden-sm">
              <span className="font-semibold text-zinc-900">{Math.round(recipe.calories * servings)} {t.macroKcal}</span>
              <span className="text-zinc-300">·</span>
              <span className="font-semibold text-success">{Math.round(recipe.protein * servings)} {t.macroProtein}</span>
              <span className="text-zinc-300">·</span>
              <span className="font-semibold text-movive-900">{Math.round(recipe.carbs * servings)} {t.macroCarbs}</span>
              <span className="text-zinc-300">·</span>
              <span className="font-semibold text-movive-800">{Math.round(recipe.fat * servings)} {t.macroFat}</span>
            </p>

            {/* Three-tier action hierarchy:
                1) Primary  — solid brand, full width (most prominent).
                2) Secondary — outlined, medium contrast.
                3) Tertiary — ghost/text, lowest weight.
                Hover states are discreet (primary → darker brand, others → soft
                grey). */}
            <div className="mt-4 flex flex-col gap-2">
              {/* Primary CTA — Movive brand, full width */}
              <button
                type="button"
                onClick={handleAddToPlan}
                disabled={busy !== null}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-golden-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <span aria-hidden="true">+</span> {t.addToMealPlan}
              </button>
              {/* Two equal 50/50 columns. On mobile/tablet both buttons share the
                  same outline style + 12px gap for a balanced row; desktop (lg:)
                  keeps the original secondary(outline)/tertiary(ghost) hierarchy. */}
              <div className="flex gap-3 lg:gap-2">
                {/* Secondary — outlined */}
                <button
                  type="button"
                  onClick={handleLogMeal}
                  disabled={busy !== null}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-golden-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                >
                  {busy === "log" ? t.logging : t.logAsMealToday}
                </button>
                {/* Shopping — outline on mobile/tablet (balanced 50/50); reverts to
                    ghost/text on desktop to preserve the original hierarchy. */}
                <button
                  type="button"
                  onClick={handleAddToShopping}
                  disabled={busy !== null || recipe.ingredients.length === 0}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-golden-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 lg:border-transparent lg:bg-transparent lg:font-medium lg:text-zinc-500 lg:hover:bg-zinc-100 lg:hover:text-zinc-700"
                >
                  {busy === "shop" ? t.adding : t.addIngredientsToShopping}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <MealPlanModal
        isOpen={planModalRecipe !== null}
        onClose={() => setPlanModalRecipe(null)}
        recipe={planModalRecipe}
        onSuccess={(msg) => success(msg)}
        onError={(msg) => toastError(msg)}
      />
    </div>
  );
}
