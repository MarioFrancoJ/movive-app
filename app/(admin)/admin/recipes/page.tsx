"use client";

import { useState, useEffect, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageLoader from "@/components/ui/PageLoader";

// ── Types ─────────────────────────────────────────────────────────────────────

type RecipeGoal = "Fat Loss" | "Muscle Gain" | "Maintenance";

interface RecipeIngredient {
  id?: string;
  // Catalog FK when known. Auto-calculate matches on this first (robust),
  // falling back to name only when it's absent — name matching alone is
  // fragile (casing / naming variants vs. the catalog).
  ingredientId?: string;
  name: string;
  quantity: number;
  unit: string;
}

interface Recipe {
  id: string;
  name: string;
  description: string;
  goal: RecipeGoal;
  servings: number;
  prep_time: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: RecipeIngredient[];
}

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  // Grams that one `unit` of this ingredient weighs (for non-gram units:
  // 'unit', 'ml', 'slice', 'scoop'…). Null for gram-based ingredients
  // (unit === 'g'), where it's unused.
  unit_weight: number | null;
}

const RECIPE_GOALS: RecipeGoal[] = ["Fat Loss", "Muscle Gain", "Maintenance"];

// ── Nutrition helpers (shared by the form + preview) ──────────────────────────

/**
 * Resolve a recipe ingredient against the catalog. Order matters: the
 * ingredient_id FK is authoritative, so try it first; only fall back to name
 * (exact, then case/space-insensitive) when there's no usable id. Matching by
 * name alone missed most ingredients because recipes store naming variants
 * ("Huevos" vs "Huevo Entero", casing differences, etc.).
 */
function resolveIngredient(
  ri: RecipeIngredient,
  catalog: IngredientOption[]
): IngredientOption | undefined {
  if (ri.ingredientId) {
    const byId = catalog.find((i) => i.id === ri.ingredientId);
    if (byId) return byId;
  }
  const exact = catalog.find((i) => i.name === ri.name);
  if (exact) return exact;
  const key = ri.name.trim().toLowerCase();
  return catalog.find((i) => i.name.trim().toLowerCase() === key);
}

// Convert a recipe ingredient's quantity to grams. Macros are stored per 100 g,
// so a non-gram unit ('unit', 'ml', 'slice', 'scoop'…) must be scaled by
// unit_weight before applying them:
//   unit === 'g'  → effectiveGrams = quantity
//   unit !== 'g'  → effectiveGrams = quantity × unit_weight
// Returns null when the ingredient is measured in a non-gram unit but has no
// unit_weight configured — the caller warns instead of miscalculating.
function effectiveGramsFor(ri: RecipeIngredient, ing: IngredientOption): number | null {
  if (ing.unit === "g") return ri.quantity;
  const w = ing.unit_weight;
  if (w == null || w <= 0) return null; // not configured → cannot convert
  return ri.quantity * w;
}

function calculateNutrition(
  ings: RecipeIngredient[],
  catalog: IngredientOption[]
): {
  calories: number; protein: number; carbs: number; fat: number;
  // Ingredient names measured in a non-gram unit without unit_weight set.
  missingConversion: string[];
} {
  let cal = 0, pro = 0, car = 0, fa = 0;
  const missingConversion: string[] = [];
  for (const ri of ings) {
    const ing = resolveIngredient(ri, catalog);
    if (!ing) continue;
    const grams = effectiveGramsFor(ri, ing);
    if (grams == null) { missingConversion.push(ri.name); continue; }
    const factor = grams / 100;
    cal += ing.calories_per_100g * factor;
    pro += ing.protein_per_100g * factor;
    car += ing.carbs_per_100g * factor;
    fa += ing.fat_per_100g * factor;
  }
  return {
    calories: Math.round(cal), protein: Math.round(pro),
    carbs: Math.round(car), fat: Math.round(fa), missingConversion,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminRecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [search, setSearch] = useState("");
  const [goalFilter, setGoalFilter] = useState<"All" | RecipeGoal>("All");
  // "new" = the top create form is open; a recipe id = that card is being
  // edited inline. Only one can be open at a time.
  const [openForm, setOpenForm] = useState<"new" | string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      // Load recipes with ingredients
      const { data: recipesData } = await supabase
        .from("recipes")
        .select("id, name, description, goal, servings, prep_time, calories, protein, carbs, fat, recipe_ingredients(id, ingredient_id, name, quantity, unit)")
        .order("name");

      if (recipesData) {
        setRecipes(recipesData.map((r: any) => ({
          id: r.id, name: r.name, description: r.description || "", goal: r.goal || "Maintenance",
          servings: r.servings, prep_time: r.prep_time || 0, calories: r.calories || 0,
          protein: r.protein || 0, carbs: r.carbs || 0, fat: r.fat || 0,
          ingredients: (r.recipe_ingredients || []).map((i: any) => ({ id: i.id, ingredientId: i.ingredient_id || undefined, name: i.name, quantity: i.quantity, unit: i.unit })),
        })));
      }

      // Load ingredient options
      const { data: ingData } = await supabase
        .from("ingredients")
        .select("id, name, unit, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit_weight")
        .order("name");
      if (ingData) setIngredientOptions(ingData as IngredientOption[]);

      setLoading(false);
    }
    loadData();
  }, []);

  const filtered = recipes.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesGoal = goalFilter === "All" || r.goal === goalFilter;
    return matchesSearch && matchesGoal;
  });

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (!error) setRecipes((prev) => prev.filter((r) => r.id !== id));
    if (openForm === id) setOpenForm(null);
    setDeleteTarget(null);
  }

  // Persist a create/update. RecipeForm owns the form state; the page owns the
  // recipes list + supabase writes so the card list stays in sync.
  async function handleSave(payload: {
    editId: string | null;
    name: string; description: string; goal: RecipeGoal;
    servings: number; prep_time: number;
    calories: number; protein: number; carbs: number; fat: number;
    ingredients: RecipeIngredient[]; instructions: string[];
  }): Promise<boolean> {
    const supabase = createClient();
    const nutrition = { calories: payload.calories, protein: payload.protein, carbs: payload.carbs, fat: payload.fat };
    try {
      if (payload.editId) {
        const editId = payload.editId;
        await supabase.from("recipes").update({
          name: payload.name, description: payload.description || null, goal: payload.goal,
          servings: payload.servings, prep_time: payload.prep_time, ...nutrition,
        }).eq("id", editId);

        await supabase.from("recipe_ingredients").delete().eq("recipe_id", editId);
        if (payload.ingredients.length > 0) {
          await supabase.from("recipe_ingredients").insert(payload.ingredients.map((ri, idx) => ({
            recipe_id: editId, ingredient_id: ri.ingredientId ?? null, name: ri.name, quantity: ri.quantity, unit: ri.unit, sort_order: idx,
          })));
        }

        await supabase.from("recipe_instructions").delete().eq("recipe_id", editId);
        if (payload.instructions.length > 0) {
          await supabase.from("recipe_instructions").insert(payload.instructions.map((inst, idx) => ({
            recipe_id: editId, step_number: idx + 1, instruction: inst.trim(),
          })));
        }

        setRecipes((prev) => prev.map((r) => r.id === editId ? {
          ...r, name: payload.name, description: payload.description, goal: payload.goal,
          servings: payload.servings, prep_time: payload.prep_time, ...nutrition, ingredients: payload.ingredients,
        } : r));
      } else {
        const { data: newRecipe, error } = await supabase.from("recipes").insert({
          name: payload.name, description: payload.description || null, goal: payload.goal,
          servings: payload.servings, prep_time: payload.prep_time, ...nutrition,
        }).select("id").single();
        if (error || !newRecipe) return false;

        if (payload.ingredients.length > 0) {
          await supabase.from("recipe_ingredients").insert(payload.ingredients.map((ri, idx) => ({
            recipe_id: newRecipe.id, ingredient_id: ri.ingredientId ?? null, name: ri.name, quantity: ri.quantity, unit: ri.unit, sort_order: idx,
          })));
        }
        if (payload.instructions.length > 0) {
          await supabase.from("recipe_instructions").insert(payload.instructions.map((inst, idx) => ({
            recipe_id: newRecipe.id, step_number: idx + 1, instruction: inst.trim(),
          })));
        }

        setRecipes((prev) => [{
          id: newRecipe.id, name: payload.name, description: payload.description, goal: payload.goal,
          servings: payload.servings, prep_time: payload.prep_time, ...nutrition, ingredients: payload.ingredients,
        }, ...prev]);
      }
      setOpenForm(null);
      return true;
    } catch {
      return false;
    }
  }

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Recipes</h1>
          <p className="mt-1 text-sm text-zinc-500">{filtered.length} recipe{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Button type="button" onClick={() => setOpenForm(openForm === "new" ? null : "new")}>+ New Recipe</Button>
      </div>

      {/* New Recipe form (top) — only for creating; editing happens inline. */}
      {openForm === "new" && (
        <RecipeForm
          key="new"
          recipe={null}
          ingredientOptions={ingredientOptions}
          onSave={handleSave}
          onCancel={() => setOpenForm(null)}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64"><svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" /></svg><input type="search" placeholder="Search recipes..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search recipes" className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" /></div>
        <select value={goalFilter} onChange={(e) => setGoalFilter(e.target.value as "All" | RecipeGoal)} aria-label="Filter by goal" className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"><option value="All">All Goals</option>{RECIPE_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}</select>
      </div>

      {/* Recipe cards — click Edit to expand an inline form under the card. */}
      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm"><p className="text-sm text-zinc-400">No recipes found.</p></div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{r.name}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                    <span>{r.goal}</span>
                    <span><strong className="text-zinc-700">{r.calories}</strong> kcal</span>
                    <span>P <strong className="text-zinc-700">{r.protein}g</strong></span>
                    <span>C <strong className="text-zinc-700">{r.carbs}g</strong></span>
                    <span>F <strong className="text-zinc-700">{r.fat}g</strong></span>
                    <span>{r.servings} serving{r.servings !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenForm(openForm === r.id ? null : r.id)}
                    aria-expanded={openForm === r.id}
                    className="rounded-golden-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
                  >
                    {openForm === r.id ? "Close" : "Edit"}
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(r.id)} className="rounded-golden-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:border-red-200 hover:text-red-600">Delete</button>
                </div>
              </div>
              {openForm === r.id && (
                <div className="border-t border-zinc-100 p-5">
                  <RecipeForm
                    key={r.id}
                    recipe={r}
                    ingredientOptions={ingredientOptions}
                    onSave={handleSave}
                    onCancel={() => setOpenForm(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete recipe?"
        description="This recipe and all its ingredients/instructions will be permanently removed."
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ── RecipeForm ────────────────────────────────────────────────────────────────
// Self-contained create/edit form. Owns its own field state (seeded from
// `recipe` when editing). Rendered inline under a card (edit) or at the top
// (new). No scroll side-effects — it appears in place.

function RecipeForm({
  recipe,
  ingredientOptions,
  onSave,
  onCancel,
}: {
  recipe: Recipe | null;
  ingredientOptions: IngredientOption[];
  onSave: (payload: {
    editId: string | null;
    name: string; description: string; goal: RecipeGoal;
    servings: number; prep_time: number;
    calories: number; protein: number; carbs: number; fat: number;
    ingredients: RecipeIngredient[]; instructions: string[];
  }) => Promise<boolean>;
  onCancel: () => void;
}) {
  const editId = recipe?.id ?? null;
  const [name, setName] = useState(recipe?.name ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [goal, setGoal] = useState<RecipeGoal>(recipe?.goal ?? "Maintenance");
  const [servings, setServings] = useState(recipe ? String(recipe.servings) : "1");
  const [prepTime, setPrepTime] = useState(recipe ? String(recipe.prep_time) : "");
  const [instructionsText, setInstructionsText] = useState("");
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>(recipe ? [...recipe.ingredients] : []);
  // Nutrition — editable, pre-filled from the recipe so editing anything else
  // never blanks it. Persisted as-is (no forced recompute on save).
  const [calories, setCalories] = useState(recipe ? String(recipe.calories) : "");
  const [protein, setProtein] = useState(recipe ? String(recipe.protein) : "");
  const [carbs, setCarbs] = useState(recipe ? String(recipe.carbs) : "");
  const [fat, setFat] = useState(recipe ? String(recipe.fat) : "");
  const [nutritionWarningAck, setNutritionWarningAck] = useState(false);
  const [formError, setFormError] = useState("");
  const [formNotice, setFormNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [addIngId, setAddIngId] = useState("");
  const [addIngQty, setAddIngQty] = useState("");

  // Load instructions for the recipe being edited.
  useEffect(() => {
    if (!editId) return;
    const supabase = createClient();
    supabase.from("recipe_instructions").select("instruction").eq("recipe_id", editId).order("step_number").then(({ data }) => {
      if (data) setInstructionsText(data.map((d: any) => d.instruction).join("\n"));
    });
  }, [editId]);

  function handleAddIngredient() {
    if (!addIngId || !addIngQty) return;
    const ing = ingredientOptions.find((i) => i.id === addIngId);
    if (!ing) return;
    if (recipeIngredients.some((ri) => ri.name === ing.name)) return;
    setRecipeIngredients([...recipeIngredients, { ingredientId: ing.id, name: ing.name, quantity: parseFloat(addIngQty) || 0, unit: ing.unit || "g" }]);
    setAddIngId(""); setAddIngQty("");
  }

  function handleRemoveIngredient(ingredientName: string) {
    setRecipeIngredients(recipeIngredients.filter((ri) => ri.name !== ingredientName));
  }

  // Assisted auto-fill. NEVER hides problems: reports exactly which ingredients
  // could not be resolved, and warns when quantities look like the "1" import
  // placeholder (which makes every macro round to ~0).
  function handleAutoFillNutrition() {
    const unresolved = recipeIngredients.filter((ri) => !resolveIngredient(ri, ingredientOptions)).map((ri) => ri.name);
    // Placeholder check only for gram-based ingredients — for unit-based ones a
    // quantity of 1–2 (e.g. 2 eggs) is perfectly valid.
    const placeholderQty = recipeIngredients
      .filter((ri) => { const ing = resolveIngredient(ri, ingredientOptions); return ing?.unit === "g" && Number(ri.quantity) <= 1; })
      .map((ri) => ri.name);
    const n = calculateNutrition(recipeIngredients, ingredientOptions);

    if (unresolved.length === recipeIngredients.length) {
      setFormNotice("");
      setFormError(`Auto-calculate failed: none of the ${recipeIngredients.length} ingredient(s) exist in the catalog: ${unresolved.join(", ")}. Re-add them from the ingredient list.`);
      return;
    }

    setCalories(String(n.calories)); setProtein(String(n.protein));
    setCarbs(String(n.carbs)); setFat(String(n.fat));
    setNutritionWarningAck(false);
    setFormError("");

    const notes: string[] = [];
    if (unresolved.length > 0) notes.push(`Not in catalog (excluded): ${unresolved.join(", ")}`);
    if (n.missingConversion.length > 0) notes.push(`Measured in units but missing unit weight (excluded — set unit_weight on the ingredient): ${n.missingConversion.join(", ")}`);
    if (placeholderQty.length > 0) notes.push(`Quantity is ≤1 g (looks like a placeholder — set the real grams): ${placeholderQty.join(", ")}`);
    if (n.calories === 0 && n.protein === 0 && n.carbs === 0 && n.fat === 0) notes.push("Result is 0 — check the quantities above.");
    setFormNotice(notes.join(" · "));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormNotice("");
    if (!name.trim()) { setFormError("Name is required."); return; }
    if (recipeIngredients.length === 0) { setFormError("Add at least one ingredient."); return; }

    const nutrition = {
      calories: Math.max(0, Math.round(Number(calories) || 0)),
      protein: Math.max(0, Math.round(Number(protein) || 0)),
      carbs: Math.max(0, Math.round(Number(carbs) || 0)),
      fat: Math.max(0, Math.round(Number(fat) || 0)),
    };
    const macrosEmpty = nutrition.calories === 0 && nutrition.protein === 0 && nutrition.carbs === 0 && nutrition.fat === 0;
    if (macrosEmpty && !nutritionWarningAck) {
      setNutritionWarningAck(true);
      setFormError("This recipe has no nutrition info (all macros are 0). Click Save again to confirm, or enter values / use Auto-calculate.");
      return;
    }

    setSaving(true);
    const ok = await onSave({
      editId,
      name: name.trim(), description: description.trim(), goal,
      servings: parseInt(servings) || 1, prep_time: parseInt(prepTime) || 0,
      ...nutrition,
      ingredients: recipeIngredients,
      instructions: instructionsText.split("\n").filter((l) => l.trim()),
    });
    setSaving(false);
    if (!ok) setFormError("Failed to save recipe.");
  }

  const previewNutrition = calculateNutrition(recipeIngredients, ingredientOptions);

  return (
    <form onSubmit={handleSubmit}>
      {!editId && <p className="mb-4 text-sm font-semibold text-zinc-700">New Recipe</p>}
      {formError && <p className="mb-3 text-xs text-red-500" role="alert">{formError}</p>}
      {formNotice && <p className="mb-3 text-xs text-amber-600" role="status">{formNotice}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input id={`rec-name-${editId ?? "new"}`} type="text" label="Name" value={name} onChange={(e) => { setName(e.target.value); setFormError(""); }} placeholder="e.g. Chicken Rice Bowl" />
        <div className="flex flex-col gap-1.5"><label htmlFor={`rec-goal-${editId ?? "new"}`} className="text-sm font-medium text-zinc-700">Goal</label><select id={`rec-goal-${editId ?? "new"}`} value={goal} onChange={(e) => setGoal(e.target.value as RecipeGoal)} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200">{RECIPE_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
        <Input id={`rec-servings-${editId ?? "new"}`} type="number" label="Servings" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="1" min={1} />
        <Input id={`rec-prep-${editId ?? "new"}`} type="number" label="Prep Time (min)" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="20" min={0} />
        <div className="sm:col-span-2"><Input id={`rec-desc-${editId ?? "new"}`} type="text" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" /></div>
      </div>

      {/* Nutrition — always-visible editable fields. */}
      <div className="mt-5 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Nutrition (per serving)</p>
          <button
            type="button"
            onClick={handleAutoFillNutrition}
            disabled={recipeIngredients.length === 0}
            className="rounded-golden-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-40"
            title="Recalculate macros from the ingredient catalog"
          >
            Auto-calculate from ingredients
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input id={`rec-cal-${editId ?? "new"}`} type="number" label="Calories (kcal)" value={calories} min={0} onChange={(e) => { setCalories(e.target.value); setNutritionWarningAck(false); setFormError(""); }} placeholder="0" />
          <Input id={`rec-pro-${editId ?? "new"}`} type="number" label="Protein (g)" value={protein} min={0} step={0.1} onChange={(e) => { setProtein(e.target.value); setNutritionWarningAck(false); setFormError(""); }} placeholder="0" />
          <Input id={`rec-carb-${editId ?? "new"}`} type="number" label="Carbs (g)" value={carbs} min={0} step={0.1} onChange={(e) => { setCarbs(e.target.value); setNutritionWarningAck(false); setFormError(""); }} placeholder="0" />
          <Input id={`rec-fat-${editId ?? "new"}`} type="number" label="Fat (g)" value={fat} min={0} step={0.1} onChange={(e) => { setFat(e.target.value); setNutritionWarningAck(false); setFormError(""); }} placeholder="0" />
        </div>
      </div>

      {/* Ingredients */}
      <div className="mt-5 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Ingredients</p>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]"><label htmlFor={`add-ing-${editId ?? "new"}`} className="text-xs text-zinc-500">Ingredient</label><select id={`add-ing-${editId ?? "new"}`} value={addIngId} onChange={(e) => setAddIngId(e.target.value)} className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"><option value="">Select…</option>{ingredientOptions.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></div>
          <div className="flex flex-col gap-1 w-24"><label htmlFor={`add-qty-${editId ?? "new"}`} className="text-xs text-zinc-500">Qty (g)</label><input id={`add-qty-${editId ?? "new"}`} type="number" value={addIngQty} onChange={(e) => setAddIngQty(e.target.value)} placeholder="100" min={0} className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" /></div>
          <button type="button" onClick={handleAddIngredient} className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover">Add</button>
        </div>
        {recipeIngredients.length === 0 ? (
          <p className="text-xs text-zinc-400">No ingredients added yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {recipeIngredients.map((ri) => {
              const resolved = resolveIngredient(ri, ingredientOptions);
              return (
                <div key={ri.name} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
                  <span className="text-zinc-700">
                    {ri.name} — <strong>{ri.quantity}</strong> {ri.unit}
                    {!resolved && <span className="ml-2 text-xs font-medium text-red-500">not in catalog</span>}
                  </span>
                  <button type="button" onClick={() => handleRemoveIngredient(ri.name)} className="text-xs text-zinc-400 hover:text-red-600">Remove</button>
                </div>
              );
            })}
          </div>
        )}
        {recipeIngredients.length > 0 && (
          <div className="mt-3 border-t border-zinc-200 pt-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Calculated from catalog (reference only — use Auto-calculate to apply)</p>
            <div className="flex flex-wrap gap-4 text-xs">
              <span className="text-zinc-600"><strong className="text-zinc-900">{previewNutrition.calories}</strong> kcal</span>
              <span className="text-zinc-600"><strong className="text-blue-600">{previewNutrition.protein}g</strong> protein</span>
              <span className="text-zinc-600"><strong className="text-amber-600">{previewNutrition.carbs}g</strong> carbs</span>
              <span className="text-zinc-600"><strong className="text-success">{previewNutrition.fat}g</strong> fat</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-1.5"><label htmlFor={`rec-instructions-${editId ?? "new"}`} className="text-sm font-medium text-zinc-700">Instructions (one per line)</label><textarea id={`rec-instructions-${editId ?? "new"}`} value={instructionsText} onChange={(e) => setInstructionsText(e.target.value)} rows={4} placeholder={"Season chicken.\nGrill for 6 min per side.\nServe over rice."} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" /></div>

      <div className="mt-5 flex gap-3">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : editId ? "Save Changes" : "Create Recipe"}</Button>
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
