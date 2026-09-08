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
}

const RECIPE_GOALS: RecipeGoal[] = ["Fat Loss", "Muscle Gain", "Maintenance"];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminRecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [ingredientOptions, setIngredientOptions] = useState<IngredientOption[]>([]);
  const [search, setSearch] = useState("");
  const [goalFilter, setGoalFilter] = useState<"All" | RecipeGoal>("All");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState<RecipeGoal>("Maintenance");
  const [servings, setServings] = useState("1");
  const [prepTime, setPrepTime] = useState("");
  const [instructionsText, setInstructionsText] = useState("");
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  // Nutrition is now editable state (kept as strings so inputs can be cleared
  // while typing). Persisted from here — no longer silently recomputed from
  // ingredients on save, which is what wiped macros when ingredient names did
  // not match the catalog. See calculateNutrition / handleAutoFillNutrition.
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  // One-shot acknowledgement so an intentional all-zero save is possible after
  // an explicit warning (Parte 3 requirement).
  const [nutritionWarningAck, setNutritionWarningAck] = useState(false);
  const [formError, setFormError] = useState("");
  const [addIngId, setAddIngId] = useState("");
  const [addIngQty, setAddIngQty] = useState("");

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      // Load recipes with ingredients
      const { data: recipesData } = await supabase
        .from("recipes")
        .select("id, name, description, goal, servings, prep_time, calories, protein, carbs, fat, recipe_ingredients(id, name, quantity, unit)")
        .order("name");

      if (recipesData) {
        setRecipes(recipesData.map((r: any) => ({
          id: r.id, name: r.name, description: r.description || "", goal: r.goal || "Maintenance",
          servings: r.servings, prep_time: r.prep_time || 0, calories: r.calories || 0,
          protein: r.protein || 0, carbs: r.carbs || 0, fat: r.fat || 0,
          ingredients: (r.recipe_ingredients || []).map((i: any) => ({ id: i.id, name: i.name, quantity: i.quantity, unit: i.unit })),
        })));
      }

      // Load ingredient options
      const { data: ingData } = await supabase
        .from("ingredients")
        .select("id, name, unit, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g")
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

  function resetForm() {
    setName(""); setDescription(""); setGoal("Maintenance"); setServings("1");
    setPrepTime(""); setInstructionsText(""); setRecipeIngredients([]);
    setCalories(""); setProtein(""); setCarbs(""); setFat(""); setNutritionWarningAck(false);
    setFormError(""); setEditId(null); setShowForm(false); setAddIngId(""); setAddIngQty("");
  }

  function handleEdit(recipe: Recipe) {
    setName(recipe.name); setDescription(recipe.description); setGoal(recipe.goal);
    setServings(recipe.servings.toString()); setPrepTime(recipe.prep_time.toString());
    setRecipeIngredients([...recipe.ingredients]);
    // Pre-fill the current nutrition so editing anything else never blanks it.
    setCalories(recipe.calories.toString()); setProtein(recipe.protein.toString());
    setCarbs(recipe.carbs.toString()); setFat(recipe.fat.toString()); setNutritionWarningAck(false);
    setEditId(recipe.id); setShowForm(true);
    // Load instructions
    const supabase = createClient();
    supabase.from("recipe_instructions").select("instruction").eq("recipe_id", recipe.id).order("step_number").then(({ data }) => {
      if (data) setInstructionsText(data.map((d: any) => d.instruction).join("\n"));
    });
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (!error) setRecipes((prev) => prev.filter((r) => r.id !== id));
    setDeleteTarget(null);
  }

  function handleAddIngredient() {
    if (!addIngId || !addIngQty) return;
    const ing = ingredientOptions.find((i) => i.id === addIngId);
    if (!ing) return;
    if (recipeIngredients.some((ri) => ri.name === ing.name)) return;
    setRecipeIngredients([...recipeIngredients, { name: ing.name, quantity: parseFloat(addIngQty) || 0, unit: ing.unit || "g" }]);
    setAddIngId(""); setAddIngQty("");
  }

  function handleRemoveIngredient(ingredientName: string) {
    setRecipeIngredients(recipeIngredients.filter((ri) => ri.name !== ingredientName));
  }

  function calculateNutrition(ings: RecipeIngredient[]): { calories: number; protein: number; carbs: number; fat: number } {
    let cal = 0, pro = 0, car = 0, fa = 0;
    for (const ri of ings) {
      const ing = ingredientOptions.find((i) => i.name === ri.name);
      if (!ing) continue;
      const factor = ri.quantity / 100;
      cal += ing.calories_per_100g * factor;
      pro += ing.protein_per_100g * factor;
      car += ing.carbs_per_100g * factor;
      fa += ing.fat_per_100g * factor;
    }
    return { calories: Math.round(cal), protein: Math.round(pro), carbs: Math.round(car), fat: Math.round(fa) };
  }

  // Assisted auto-fill: recompute macros from the ingredient catalog and write
  // them INTO the editable fields — only when the recompute is meaningful.
  // Never silently overwrites existing values with 0 (the original bug); if the
  // recompute yields all-zero because ingredient names don't match the catalog,
  // we warn instead of clobbering.
  function handleAutoFillNutrition() {
    const n = calculateNutrition(recipeIngredients);
    if (n.calories === 0 && n.protein === 0 && n.carbs === 0 && n.fat === 0) {
      setFormError("Cannot auto-calculate: none of the ingredients match the catalog. Enter macros manually.");
      return;
    }
    setCalories(String(n.calories)); setProtein(String(n.protein));
    setCarbs(String(n.carbs)); setFat(String(n.fat));
    setFormError("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setFormError("Name is required."); return; }
    if (recipeIngredients.length === 0) { setFormError("Add at least one ingredient."); return; }

    // Persist the macros the user sees in the form (not a forced recompute).
    // Empty string → 0 only intentionally; the guard below stops accidental
    // all-zero saves so editing a description can never blank the nutrition.
    const nutrition = {
      calories: Math.max(0, Math.round(Number(calories) || 0)),
      protein: Math.max(0, Math.round(Number(protein) || 0)),
      carbs: Math.max(0, Math.round(Number(carbs) || 0)),
      fat: Math.max(0, Math.round(Number(fat) || 0)),
    };
    const macrosEmpty =
      nutrition.calories === 0 && nutrition.protein === 0 &&
      nutrition.carbs === 0 && nutrition.fat === 0;
    if (macrosEmpty && !nutritionWarningAck) {
      setNutritionWarningAck(true);
      setFormError("This recipe has no nutrition info (all macros are 0). Click Save again to confirm, or enter values / use Auto-calculate.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const instructions = instructionsText.split("\n").filter((l) => l.trim());

    try {
      if (editId) {
        // Update recipe
        await supabase.from("recipes").update({
          name: name.trim(), description: description.trim() || null, goal, servings: parseInt(servings) || 1,
          prep_time: parseInt(prepTime) || 0, ...nutrition,
        }).eq("id", editId);

        // Replace ingredients
        await supabase.from("recipe_ingredients").delete().eq("recipe_id", editId);
        if (recipeIngredients.length > 0) {
          await supabase.from("recipe_ingredients").insert(recipeIngredients.map((ri, idx) => ({
            recipe_id: editId, name: ri.name, quantity: ri.quantity, unit: ri.unit, sort_order: idx,
          })));
        }

        // Replace instructions
        await supabase.from("recipe_instructions").delete().eq("recipe_id", editId);
        if (instructions.length > 0) {
          await supabase.from("recipe_instructions").insert(instructions.map((inst, idx) => ({
            recipe_id: editId, step_number: idx + 1, instruction: inst.trim(),
          })));
        }

        setRecipes((prev) => prev.map((r) => r.id === editId ? { ...r, name: name.trim(), description: description.trim(), goal, servings: parseInt(servings) || 1, prep_time: parseInt(prepTime) || 0, ...nutrition, ingredients: recipeIngredients } : r));
      } else {
        // Create recipe
        const { data: newRecipe, error } = await supabase.from("recipes").insert({
          name: name.trim(), description: description.trim() || null, goal, servings: parseInt(servings) || 1,
          prep_time: parseInt(prepTime) || 0, ...nutrition,
        }).select("id").single();

        if (error || !newRecipe) { setFormError("Failed to create recipe."); setSaving(false); return; }

        // Insert ingredients
        if (recipeIngredients.length > 0) {
          await supabase.from("recipe_ingredients").insert(recipeIngredients.map((ri, idx) => ({
            recipe_id: newRecipe.id, name: ri.name, quantity: ri.quantity, unit: ri.unit, sort_order: idx,
          })));
        }

        // Insert instructions
        if (instructions.length > 0) {
          await supabase.from("recipe_instructions").insert(instructions.map((inst, idx) => ({
            recipe_id: newRecipe.id, step_number: idx + 1, instruction: inst.trim(),
          })));
        }

        setRecipes((prev) => [{ id: newRecipe.id, name: name.trim(), description: description.trim(), goal, servings: parseInt(servings) || 1, prep_time: parseInt(prepTime) || 0, ...nutrition, ingredients: recipeIngredients }, ...prev]);
      }
      resetForm();
    } catch { setFormError("Failed to save recipe."); }
    setSaving(false);
  }

  const previewNutrition = calculateNutrition(recipeIngredients);

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
        <Button type="button" onClick={() => { resetForm(); setShowForm(true); }}>+ New Recipe</Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-zinc-700">{editId ? "Edit Recipe" : "New Recipe"}</p>
          {formError && <p className="mb-3 text-xs text-red-500" role="alert">{formError}</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input id="rec-name" type="text" label="Name" value={name} onChange={(e) => { setName(e.target.value); setFormError(""); }} placeholder="e.g. Chicken Rice Bowl" />
            <div className="flex flex-col gap-1.5"><label htmlFor="rec-goal" className="text-sm font-medium text-zinc-700">Goal</label><select id="rec-goal" value={goal} onChange={(e) => setGoal(e.target.value as RecipeGoal)} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200">{RECIPE_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}</select></div>
            <Input id="rec-servings" type="number" label="Servings" value={servings} onChange={(e) => setServings(e.target.value)} placeholder="1" min={1} />
            <Input id="rec-prep" type="number" label="Prep Time (min)" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="20" min={0} />
            <div className="sm:col-span-2"><Input id="rec-desc" type="text" label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" /></div>
          </div>

          {/* Nutrition — always-visible editable fields. Pre-filled with the
              recipe's current macros on edit; persisted as-is on save so editing
              anything else never blanks them. */}
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
              <Input id="rec-cal" type="number" label="Calories (kcal)" value={calories} min={0} onChange={(e) => { setCalories(e.target.value); setNutritionWarningAck(false); setFormError(""); }} placeholder="0" />
              <Input id="rec-pro" type="number" label="Protein (g)" value={protein} min={0} step={0.1} onChange={(e) => { setProtein(e.target.value); setNutritionWarningAck(false); setFormError(""); }} placeholder="0" />
              <Input id="rec-carb" type="number" label="Carbs (g)" value={carbs} min={0} step={0.1} onChange={(e) => { setCarbs(e.target.value); setNutritionWarningAck(false); setFormError(""); }} placeholder="0" />
              <Input id="rec-fat" type="number" label="Fat (g)" value={fat} min={0} step={0.1} onChange={(e) => { setFat(e.target.value); setNutritionWarningAck(false); setFormError(""); }} placeholder="0" />
            </div>
          </div>

          {/* Ingredients */}
          <div className="mt-5 rounded-lg border border-zinc-100 bg-zinc-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">Ingredients</p>
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1 flex-1 min-w-[180px]"><label htmlFor="add-ing" className="text-xs text-zinc-500">Ingredient</label><select id="add-ing" value={addIngId} onChange={(e) => setAddIngId(e.target.value)} className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"><option value="">Select…</option>{ingredientOptions.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select></div>
              <div className="flex flex-col gap-1 w-24"><label htmlFor="add-qty" className="text-xs text-zinc-500">Qty</label><input id="add-qty" type="number" value={addIngQty} onChange={(e) => setAddIngQty(e.target.value)} placeholder="100" min={0} className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" /></div>
              <button type="button" onClick={handleAddIngredient} className="h-9 rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover">Add</button>
            </div>
            {recipeIngredients.length === 0 ? (
              <p className="text-xs text-zinc-400">No ingredients added yet.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {recipeIngredients.map((ri) => (
                  <div key={ri.name} className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm">
                    <span className="text-zinc-700">{ri.name} — <strong>{ri.quantity}</strong> {ri.unit}</span>
                    <button type="button" onClick={() => handleRemoveIngredient(ri.name)} className="text-xs text-zinc-400 hover:text-red-600">Remove</button>
                  </div>
                ))}
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

          <div className="mt-4 flex flex-col gap-1.5"><label htmlFor="rec-instructions" className="text-sm font-medium text-zinc-700">Instructions (one per line)</label><textarea id="rec-instructions" value={instructionsText} onChange={(e) => setInstructionsText(e.target.value)} rows={4} placeholder={"Season chicken.\nGrill for 6 min per side.\nServe over rice."} className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" /></div>

          <div className="mt-5 flex gap-3">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : editId ? "Save Changes" : "Create Recipe"}</Button>
            <button type="button" onClick={resetForm} className="text-sm font-medium text-zinc-500 hover:text-zinc-900">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64"><svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" /></svg><input type="search" placeholder="Search recipes..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search recipes" className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" /></div>
        <select value={goalFilter} onChange={(e) => setGoalFilter(e.target.value as "All" | RecipeGoal)} aria-label="Filter by goal" className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"><option value="All">All Goals</option>{RECIPE_GOALS.map((g) => <option key={g} value={g}>{g}</option>)}</select>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center"><p className="text-sm text-zinc-400">No recipes found.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50">
                <tr><th className="px-5 py-3 font-semibold text-zinc-700">Name</th><th className="px-5 py-3 font-semibold text-zinc-700">Goal</th><th className="px-5 py-3 font-semibold text-zinc-700">Cal</th><th className="px-5 py-3 font-semibold text-zinc-700">P</th><th className="px-5 py-3 font-semibold text-zinc-700">C</th><th className="px-5 py-3 font-semibold text-zinc-700">F</th><th className="px-5 py-3 font-semibold text-zinc-700">Servings</th><th className="px-5 py-3 font-semibold text-zinc-700">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-3 font-medium text-zinc-900">{r.name}</td>
                    <td className="px-5 py-3 text-zinc-600">{r.goal}</td>
                    <td className="px-5 py-3 text-zinc-600">{r.calories}</td>
                    <td className="px-5 py-3 text-zinc-600">{r.protein}g</td>
                    <td className="px-5 py-3 text-zinc-600">{r.carbs}g</td>
                    <td className="px-5 py-3 text-zinc-600">{r.fat}g</td>
                    <td className="px-5 py-3 text-zinc-600">{r.servings}</td>
                    <td className="px-5 py-3"><div className="flex gap-2"><button type="button" onClick={() => handleEdit(r)} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">Edit</button><button type="button" onClick={() => setDeleteTarget(r.id)} className="text-xs font-medium text-zinc-500 hover:text-red-600">Delete</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
