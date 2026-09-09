"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/components/ui/Toast";
import {
  addRecipeIngredientsToShoppingList,
  logMealFromRecipe,
  suggestSlotForRecipe,
  MEAL_SLOTS,
  type MealSlot,
} from "@/lib/nutrition";
import MealPlanModal, { type MealPlanModalRecipe } from "@/components/nutrition/MealPlanModal";
import QuantityStepper from "@/components/ui/QuantityStepper";
import Chip from "@/components/ui/Chip";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecipeGoal = "Fat Loss" | "Muscle Gain" | "Maintenance";
export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

type NutritionDict = ReturnType<typeof useDictionary>["dict"]["nutrition"];

export interface RecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  description: string;
  goal: RecipeGoal;
  mealType: MealType | null;
  recommendedMealType: MealSlot | null;
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

// ── Label helpers ───────────────────────────────────────────────────────────

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
    case "Breakfast": return nt.mealPlanner.slotBreakfast;
    case "Snack AM":  return nt.mealPlanner.slotSnackAm;
    case "Lunch":     return nt.mealPlanner.slotLunch;
    case "Snack PM":  return nt.mealPlanner.slotSnackPm;
    case "Dinner":    return nt.mealPlanner.slotDinner;
    case "Snack":     return nt.mealPlanner.slotSnackPm; // legacy alias
    default:          return type;
  }
}

function goalColor(goal: string) {
  switch (goal) {
    case "Fat Loss":    return "bg-success-light text-success";
    case "Muscle Gain": return "bg-primary text-white";
    case "Maintenance": return "bg-amber-50 text-amber-700";
    default:            return "bg-zinc-100 text-zinc-700";
  }
}

// Format an ingredient amount for display. When there is no unit and the
// quantity is a bare "1" (the placeholder used for recipes imported without
// real grammage), we render nothing rather than a dangling "1". Once a real
// unit/quantity is provided (e.g. "200 g"), it renders normally.
function formatAmount(quantity: number, unit: string): string {
  const u = (unit || "").trim();
  if (!u && quantity === 1) return "";
  return u ? `${quantity} ${u}` : String(quantity);
}

// ── View (client) ──────────────────────────────────────────────────────────────

/**
 * Interactive recipe detail. The recipe is fetched on the server (see page.tsx)
 * and passed in as `recipe` — no client loading spinner / waterfall. The initial
 * meal slot is suggested from the recipe (meal_type → name/ingredients keywords);
 * the user can change it. All actions (add-to-plan modal, log meal, add to
 * shopping list) live here as a Client Component.
 */
export default function RecipeDetailView({ recipe }: { recipe: Recipe }) {
  const { dict } = useDictionary();
  const t = dict.nutrition.recipeDetail;
  const nt = dict.nutrition;
  const { success, error: toastError } = useToast();

  // Action controls (for logging + shopping; meal-plan uses the modal).
  const [slot, setSlot] = useState<MealSlot>(() =>
    suggestSlotForRecipe({ recommendedMealType: recipe.recommendedMealType, mealType: recipe.mealType, name: recipe.name, ingredients: recipe.ingredients })
  );
  const [servings, setServings] = useState(1);
  const [busy, setBusy] = useState<null | "shop" | "log">(null);
  const [planModalRecipe, setPlanModalRecipe] = useState<MealPlanModalRecipe | null>(null);

  // ── Actions ─────────────────────────────────────────────────────────────────

  function handleAddToPlan() {
    setPlanModalRecipe({
      id: recipe.id,
      name: recipe.name,
      mealType: (recipe.recommendedMealType ?? recipe.mealType) as MealSlot | null,
      calories: recipe.calories,
      goal: recipe.goal,
    });
  }

  async function handleAddToShopping() {
    if (busy) return;
    setBusy("shop");
    const res = await addRecipeIngredientsToShoppingList(recipe.ingredients, { multiplier: servings, sourceRecipeId: recipe.id });
    setBusy(null);
    if (res.ok) success(nt.recipes.toastAddedIngredients.replace("{n}", String(res.addedCount)));
    else toastError(res.error || nt.recipes.toastAddError);
  }

  async function handleLogMeal() {
    if (busy) return;
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
          {recipe.recommendedMealType && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-light px-2.5 py-1 text-golden-xs font-semibold text-primary-fg" title={t.recommendedFor}>
              {t.recommendedFor}: {mealTypeLabel(recipe.recommendedMealType, nt)}
            </span>
          )}
        </div>
      </div>

      {/* Hero + body in one dense grid so the whole recipe fits a laptop's first
          viewport. Photo is a supporting element (~33%); the info column (~67%)
          carries a one-line nutrition summary, compact ingredients + instructions,
          and the actions. On mobile everything stacks (photo first). */}
      <div className="grid gap-5 xl:grid-cols-[7fr_13fr] xl:items-start">
        {/* Photo — ~33%. Fills the info column's height on desktop. */}
        <div className="relative w-full overflow-hidden rounded-2xl bg-zinc-100 h-64 xl:h-full xl:max-h-none xl:self-stretch xl:min-h-[320px]">
          {recipe.imageUrl ? (
            <Image
              src={recipe.imageUrl}
              alt={recipe.name}
              fill
              priority
              sizes="(min-width: 1280px) 30vw, 100vw"
              className="object-cover object-center"
            />
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

        {/* Info column — ~67% */}
        <div className="flex flex-col gap-4">
          {/* Nutrition — single horizontal line: calories | protein | carbs | fat. */}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
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
                {recipe.ingredients.map((item) => {
                  const amount = formatAmount(item.quantity, item.unit);
                  return (
                    <li key={item.id} className="flex items-baseline gap-2 py-[3px] text-golden-sm text-zinc-700">
                      <span>{item.name}</span>
                      <span className="min-w-0 flex-1 translate-y-[-0.2em] border-b border-dotted border-zinc-200" aria-hidden="true" />
                      {amount && <span className="shrink-0 font-medium text-zinc-500">{amount}</span>}
                    </li>
                  );
                })}
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

          {/* Actions — Meal + Servings + short buttons */}
          <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <span id="meal-slot-label" className="mb-1 block text-golden-xs font-medium text-zinc-600">{t.mealLabel}</span>
                <div
                  role="radiogroup"
                  aria-labelledby="meal-slot-label"
                  className="grid grid-cols-2 gap-1 sm:grid-cols-5"
                >
                  {MEAL_SLOTS.map((m) => (
                    <Chip
                      key={m}
                      active={slot === m}
                      onClick={() => setSlot(m)}
                      selectionMode="single"
                    >
                      {mealTypeLabel(m, nt)}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="shrink-0">
                <span className="mb-1 block text-golden-xs font-medium text-zinc-600">{t.servingsLabel}</span>
                <QuantityStepper
                  value={servings}
                  onChange={setServings}
                  min={1}
                  ariaLabel={t.servingsLabel}
                  decrementLabel={t.decreaseServings}
                  incrementLabel={t.increaseServings}
                />
              </div>
            </div>

            {/* Per-serving nutrition summary — Movive macro naming + colors. */}
            <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-golden-sm">
              <span className="font-semibold text-zinc-900">{Math.round(recipe.calories * servings)} {t.macroKcal}</span>
              <span className="text-zinc-300">·</span>
              <span className="font-semibold text-success">{Math.round(recipe.protein * servings)} {t.macroProtein}</span>
              <span className="text-zinc-300">·</span>
              <span className="font-semibold text-movive-900">{Math.round(recipe.carbs * servings)} {t.macroCarbs}</span>
              <span className="text-zinc-300">·</span>
              <span className="font-semibold text-movive-800">{Math.round(recipe.fat * servings)} {t.macroFat}</span>
            </p>

            {/* Three-tier action hierarchy: primary (full width) + two outlined siblings. */}
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleAddToPlan}
                disabled={busy !== null}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-golden-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <span aria-hidden="true">+</span> {t.addToMealPlan}
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleLogMeal}
                  disabled={busy !== null}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-golden-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
                >
                  {busy === "log" ? t.logging : t.logAsMealToday}
                </button>
                <button
                  type="button"
                  onClick={handleAddToShopping}
                  disabled={busy !== null || recipe.ingredients.length === 0}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-zinc-300 bg-white px-3 py-2 text-golden-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
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
