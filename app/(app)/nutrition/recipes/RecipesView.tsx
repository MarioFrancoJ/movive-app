"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import EmptyState from "@/components/ui/EmptyState";
import Chip from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { addRecipeIngredientsToShoppingList } from "@/lib/nutrition";
import MealPlanModal, { type MealPlanModalRecipe } from "@/components/nutrition/MealPlanModal";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// Dictionary slices used across this view's components.
type RecipesDict = ReturnType<typeof useDictionary>["dict"]["nutrition"]["recipes"];
type NutritionDict = ReturnType<typeof useDictionary>["dict"]["nutrition"];

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecipeGoal = "Fat Loss" | "Muscle Gain" | "Maintenance";
export type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

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
  imageUrl: string | null;
  ingredients: RecipeIngredient[];
  servings: number;
  prepTime: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const RECIPE_GOALS: RecipeGoal[] = ["Fat Loss", "Muscle Gain", "Maintenance"];
const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function goalColor(goal: RecipeGoal): string {
  switch (goal) {
    case "Fat Loss":    return "bg-success-light text-success";
    case "Muscle Gain": return "bg-primary text-white";
    case "Maintenance": return "bg-amber-50 text-amber-700";
  }
}

function goalLabel(goal: RecipeGoal, t: RecipesDict): string {
  switch (goal) {
    case "Fat Loss":    return t.goalFatLoss;
    case "Muscle Gain": return t.goalMuscleGain;
    case "Maintenance": return t.goalMaintenance;
  }
}

// Filter chip label for goals, including the "All" pseudo-value.
function goalFilterLabel(goal: "All" | RecipeGoal, t: RecipesDict): string {
  return goal === "All" ? t.goalAll : goalLabel(goal, t);
}

function mealTypeLabel(type: MealType, nt: NutritionDict): string {
  switch (type) {
    case "Breakfast": return nt.mealTypeBreakfast;
    case "Lunch":     return nt.mealTypeLunch;
    case "Dinner":    return nt.mealTypeDinner;
    case "Snack":     return nt.mealTypeSnack;
  }
}

// ── Recipe Card ───────────────────────────────────────────────────────────────

function RecipeCard({ recipe, onAddToPlan, t, nt }: { recipe: Recipe; onAddToPlan: (r: Recipe) => void; t: RecipesDict; nt: NutritionDict }) {
  const { success, error: toastError } = useToast();
  const [busy, setBusy] = useState<null | "shop">(null);

  function handleAddToPlan(e: React.MouseEvent) {
    e.preventDefault(); // don't navigate — the card is wrapped in a Link
    e.stopPropagation();
    onAddToPlan(recipe);
  }

  async function handleQuickShop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy("shop");
    const res = await addRecipeIngredientsToShoppingList(recipe.ingredients, { sourceRecipeId: recipe.id });
    setBusy(null);
    if (res.ok) success(t.toastAddedIngredients.replace("{n}", String(res.addedCount)));
    else toastError(res.error || t.toastAddError);
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Image — dominant element, 4:3, object-cover. Goal + meal-type badges
          sit over the photo for a cleaner, more visual card. */}
      <Link href={`/nutrition/recipes/${recipe.id}`} className="block">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100">
          {recipe.imageUrl ? (
            <Image
              src={recipe.imageUrl}
              alt={recipe.name}
              fill
              sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-50 to-zinc-100 text-zinc-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-10 w-10" strokeWidth="1.5" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}
          {/* Badges over the image */}
          <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
            <span className={`rounded-full px-2 py-0.5 text-golden-xs font-semibold shadow-sm ${goalColor(recipe.goal)}`}>
              {goalLabel(recipe.goal, t)}
            </span>
            {recipe.mealType && (
              <span className="rounded-full bg-white/90 px-2 py-0.5 text-golden-xs font-medium text-zinc-700 shadow-sm backdrop-blur-sm">
                {mealTypeLabel(recipe.mealType, nt)}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-golden-3">
        {/* Text block */}
        <Link href={`/nutrition/recipes/${recipe.id}`} className="block">
          {/* Title — second most important element after the photo */}
          <h3 className="line-clamp-2 text-golden-lg font-bold leading-snug text-zinc-900">
            {recipe.name}
          </h3>

          {/* Secondary meta — single line with dot separators */}
          <p className="mt-1 truncate text-golden-xs text-zinc-400">
            {[
              recipe.prepTime > 0 ? `${recipe.prepTime} ${t.unitMin}` : null,
              `${recipe.servings} ${t.unitServings}`,
              `${recipe.ingredients.length} ${t.unitIngredients}`,
            ]
              .filter(Boolean)
              .join(" • ")}
          </p>

          {/* Nutrition — calories are the primary datum, macros a quiet
              text-only line below (no icons). */}
          <div className="mt-golden-2 border-t border-zinc-100 pt-golden-2">
            <p className="text-golden-lg font-bold leading-none text-zinc-900">
              {recipe.calories}
              <span className="ml-1 text-golden-xs font-medium text-zinc-400">{t.unitKcal}</span>
            </p>
            <p className="mt-1.5 truncate text-golden-xs font-medium text-zinc-500">
              {recipe.protein}g Prot. <span className="text-zinc-300">•</span> {recipe.carbs}g Carb. <span className="text-zinc-300">•</span> {recipe.fat}g Fat
            </p>
          </div>
        </Link>

        {/* Actions */}
        <div className="mt-golden-3 flex items-center gap-2">
          <Link
            href={`/nutrition/recipes/${recipe.id}`}
            className="flex-1 rounded-golden-md border border-zinc-200 bg-white px-golden-2 py-golden-1 text-center text-golden-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            {t.view}
          </Link>
          <button
            type="button"
            onClick={handleAddToPlan}
            className="flex-1 rounded-golden-md bg-primary px-golden-2 py-golden-1 text-golden-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {t.addMealPlan}
          </button>
          <button
            type="button"
            onClick={handleQuickShop}
            disabled={busy !== null || recipe.ingredients.length === 0}
            title={`Add ${recipe.name} ingredients to shopping list`}
            aria-label={`Add ${recipe.name} ingredients to shopping list`}
            className="shrink-0 rounded-golden-md border border-zinc-200 bg-white p-golden-1 text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-40"
          >
            {busy === "shop" ? (
              <span className="text-golden-sm">…</span>
            ) : (
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="M1 1.75A.75.75 0 0 1 1.75 1h1.628a1.75 1.75 0 0 1 1.734 1.51L5.18 3a65.25 65.25 0 0 1 13.36 1.412.75.75 0 0 1 .58.875 48.6 48.6 0 0 1-1.618 6.2.75.75 0 0 1-.712.513H6.75a.75.75 0 0 0 0 1.5h9.5a.75.75 0 0 1 0 1.5H6.75a2.25 2.25 0 0 1-2.15-2.906l.44-1.435-1.35-8.11a.25.25 0 0 0-.247-.21H1.75A.75.75 0 0 1 1 1.75ZM6 17.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm9 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function RecipeSection({ title, recipes, onAddToPlan, t, nt }: { title: string; recipes: Recipe[]; onAddToPlan: (r: Recipe) => void; t: RecipesDict; nt: NutritionDict }) {
  if (recipes.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-golden-sm font-semibold text-zinc-900">
        {title} <span className="font-normal text-zinc-400">({recipes.length})</span>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {recipes.map((r) => <RecipeCard key={r.id} recipe={r} onAddToPlan={onAddToPlan} t={t} nt={nt} />)}
      </div>
    </div>
  );
}

// ── View (client) ──────────────────────────────────────────────────────────────

/**
 * Interactive recipes view. Data is fetched on the server (see page.tsx) and
 * passed in as `initialRecipes` — no client-side loading spinner / waterfall.
 * All interactivity (search, filters, add-to-plan modal, quick shopping-list)
 * lives here as a Client Component.
 */
export default function RecipesView({ initialRecipes }: { initialRecipes: Recipe[] }) {
  const { dict } = useDictionary();
  const t = dict.nutrition.recipes;
  const nt = dict.nutrition;
  const { success, error: toastError } = useToast();
  const [allRecipes] = useState<Recipe[]>(initialRecipes);
  const [search, setSearch] = useState("");
  const [goalFilter, setGoalFilter] = useState<"All" | RecipeGoal>("All");
  const [mealTypeFilter, setMealTypeFilter] = useState<"All" | MealType>("All");
  const [planRecipe, setPlanRecipe] = useState<MealPlanModalRecipe | null>(null);

  function openPlanModal(r: Recipe) {
    setPlanRecipe({ id: r.id, name: r.name, mealType: r.mealType, calories: r.calories, goal: r.goal });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRecipes.filter((r) => {
      const matchesSearch =
        !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      const matchesGoal = goalFilter === "All" || r.goal === goalFilter;
      const matchesMealType = mealTypeFilter === "All" || r.mealType === mealTypeFilter;
      return matchesSearch && matchesGoal && matchesMealType;
    });
  }, [allRecipes, search, goalFilter, mealTypeFilter]);

  // Grouped view: group by GOAL. Each recipe appears in exactly one section
  // (no "Featured" duplicate). Only shown when no filters/search are active.
  const showGrouped = goalFilter === "All" && mealTypeFilter === "All" && !search.trim();
  const byGoal = useMemo(() => {
    const groups: Record<RecipeGoal, Recipe[]> = {
      "Muscle Gain": [],
      "Fat Loss": [],
      "Maintenance": [],
    };
    for (const r of filtered) groups[r.goal].push(r);
    return groups;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
        <p className="mt-1 text-golden-sm text-zinc-500">
          {t.available.replace("{n}", String(allRecipes.length))}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <input
              type="search"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t.searchPlaceholder}
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-golden-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:h-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["All", ...RECIPE_GOALS] as const).map((g) => (
              <Chip key={g} active={goalFilter === g} onClick={() => setGoalFilter(g)}>
                {goalFilterLabel(g, t)}
              </Chip>
            ))}
          </div>
        </div>

        {/* Meal-type filter (Breakfast / Lunch / Dinner / Snack) */}
        <div className="flex flex-wrap gap-2">
          {(["All", ...MEAL_TYPES] as const).map((m) => (
            <Chip key={m} active={mealTypeFilter === m} onClick={() => setMealTypeFilter(m)}>
              {m === "All" ? t.goalAll : mealTypeLabel(m, nt)}
            </Chip>
          ))}
        </div>
      </div>

      {/* Content */}
      {allRecipes.length === 0 ? (
        <EmptyState
          icon="📖"
          title={t.emptyTitle}
          description={t.emptyDescription}
        />
      ) : showGrouped ? (
        <div className="flex flex-col gap-8">
          <RecipeSection title={t.sectionMuscleGain} recipes={byGoal["Muscle Gain"]} onAddToPlan={openPlanModal} t={t} nt={nt} />
          <RecipeSection title={t.sectionFatLoss} recipes={byGoal["Fat Loss"]} onAddToPlan={openPlanModal} t={t} nt={nt} />
          <RecipeSection title={t.sectionMaintenance} recipes={byGoal["Maintenance"]} onAddToPlan={openPlanModal} t={t} nt={nt} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
          <p className="text-golden-sm text-zinc-400">{t.noMatch}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((r) => <RecipeCard key={r.id} recipe={r} onAddToPlan={openPlanModal} t={t} nt={nt} />)}
        </div>
      )}

      <MealPlanModal
        isOpen={planRecipe !== null}
        onClose={() => setPlanRecipe(null)}
        recipe={planRecipe}
        onSuccess={(msg) => success(msg)}
        onError={(msg) => toastError(msg)}
      />
    </div>
  );
}
