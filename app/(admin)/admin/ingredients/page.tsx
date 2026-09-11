"use client";

import { useState, useEffect, type FormEvent } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PageLoader from "@/components/ui/PageLoader";

// ── Types ─────────────────────────────────────────────────────────────────────

type IngredientCategory = "Protein" | "Carbohydrate" | "Fat" | "Vegetable" | "Fruit" | "Dairy" | "Beverage" | "Other";

interface Ingredient {
  id: string;
  name: string;
  category: IngredientCategory;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  unit: string;
  cooking_factor: number | null;
}

const INGREDIENT_CATEGORIES: IngredientCategory[] = ["Protein", "Carbohydrate", "Fat", "Vegetable", "Fruit", "Dairy", "Beverage", "Other"];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminIngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | IngredientCategory>("All");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState<IngredientCategory>("Protein");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [unit, setUnit] = useState("g");
const [cookingFactor, setCookingFactor] = useState("");
const [formError, setFormError] = useState("");

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data } = await supabase
        .from("ingredients")
        .select("id, name, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, unit, cooking_factor")
        .order("name");
      if (data) setIngredients(data as Ingredient[]);
      setLoading(false);
    }
    loadData();
  }, []);

  const filtered = ingredients.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === "All" || i.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

 function resetForm() {
  setName(""); setCategory("Protein"); setCalories(""); setProtein(""); setCarbs(""); setFat(""); setUnit("g"); setCookingFactor("");
  setFormError(""); setEditId(null); setShowForm(false);
}

  function handleEdit(ingredient: Ingredient) {
  setName(ingredient.name);
  setCategory(ingredient.category);
  setCalories(ingredient.calories_per_100g.toString());
  setProtein(ingredient.protein_per_100g.toString());
  setCarbs(ingredient.carbs_per_100g.toString());
  setFat(ingredient.fat_per_100g.toString());
  setUnit(ingredient.unit || "g");
  setCookingFactor(ingredient.cooking_factor != null ? ingredient.cooking_factor.toString() : "");
  setEditId(ingredient.id);
  setShowForm(true);
}

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (!error) setIngredients((prev) => prev.filter((i) => i.id !== id));
    setDeleteTarget(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setFormError("Name is required."); return; }
    if (!calories.trim()) { setFormError("Calories is required."); return; }

    setSaving(true);
    const supabase = createClient();

    const data = {
  name: name.trim(),
  category,
  calories_per_100g: parseFloat(calories) || 0,
  protein_per_100g: parseFloat(protein) || 0,
  carbs_per_100g: parseFloat(carbs) || 0,
  fat_per_100g: parseFloat(fat) || 0,
  unit,
  cooking_factor: cookingFactor.trim() === "" ? null : parseFloat(cookingFactor) || 1,
};

    try {
      if (editId) {
        const { error } = await supabase.from("ingredients").update(data).eq("id", editId);
        if (!error) setIngredients((prev) => prev.map((i) => (i.id === editId ? { ...i, ...data } : i)));
      } else {
        const { data: inserted, error } = await supabase.from("ingredients").insert(data).select("id").single();
        if (!error && inserted) setIngredients((prev) => [...prev, { id: inserted.id, ...data }]);
      }
      resetForm();
    } catch (err) {
      setFormError("Failed to save. Please try again.");
    }
    setSaving(false);
  }

  if (loading) {
    return <PageLoader />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Ingredients</h1>
          <p className="mt-1 text-sm text-zinc-500">{filtered.length} ingredient{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Button type="button" onClick={() => { resetForm(); setShowForm(true); }}>+ New Ingredient</Button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-zinc-700">{editId ? "Edit Ingredient" : "New Ingredient"}</p>
          {formError && <p className="mb-3 text-xs text-red-500" role="alert">{formError}</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input id="ing-name" type="text" label="Name" value={name} onChange={(e) => { setName(e.target.value); setFormError(""); }} placeholder="e.g. Chicken Breast" />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ing-cat" className="text-sm font-medium text-zinc-700">Category</label>
              <select id="ing-cat" value={category} onChange={(e) => setCategory(e.target.value as IngredientCategory)} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200">
                {INGREDIENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Input id="ing-cal" type="number" label="Calories /100g" value={calories} onChange={(e) => { setCalories(e.target.value); setFormError(""); }} placeholder="165" min={0} />
            <Input id="ing-pro" type="number" label="Protein /100g" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="31" min={0} step={0.1} />
            <Input id="ing-carb" type="number" label="Carbs /100g" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="0" min={0} step={0.1} />
            <Input id="ing-fat" type="number" label="Fat /100g" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="3.6" min={0} step={0.1} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ing-unit" className="text-sm font-medium text-zinc-700">Unit</label>
              <select id="ing-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200">
                <option value="g">g</option><option value="ml">ml</option><option value="unit">unit</option><option value="slice">slice</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
  <label htmlFor="ing-cook" className="text-sm font-medium text-zinc-700">
    Factor de cocción
    <span className="ml-1 text-xs font-normal text-zinc-400">(opcional)</span>
  </label>
  <Input
    id="ing-cook"
    type="number"
    value={cookingFactor}
    onChange={(e) => setCookingFactor(e.target.value)}
    placeholder="Ej: 2.8 (arroz)"
    min={0.5}
    step={0.1}
  />
  <p className="text-xs text-zinc-400">
    Crudo → cocido. 100g crudo × 2.8 = 280g cocido.
  </p>
</div>
          </div>
          <div className="mt-5 flex gap-3">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : editId ? "Save Changes" : "Create"}</Button>
            <button type="button" onClick={resetForm} className="text-sm font-medium text-zinc-500 hover:text-zinc-900">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" /></svg>
          <input type="search" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search ingredients" className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as "All" | IngredientCategory)} aria-label="Filter by category" className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200">
          <option value="All">All Categories</option>
          {INGREDIENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center"><p className="text-sm text-zinc-400">No ingredients found.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50">
                <tr>
                  <th className="px-5 py-3 font-semibold text-zinc-700">Name</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">Category</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">Cal</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">Protein</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">Carbs</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">Fat</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">Unit</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">Factor</th>
                  <th className="px-5 py-3 font-semibold text-zinc-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filtered.map((i) => (
                  <tr key={i.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-3 font-medium text-zinc-900">{i.name}</td>
                    <td className="px-5 py-3"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{i.category}</span></td>
                    <td className="px-5 py-3 text-zinc-600">{i.calories_per_100g}</td>
                    <td className="px-5 py-3 text-zinc-600">{i.protein_per_100g}g</td>
                    <td className="px-5 py-3 text-zinc-600">{i.carbs_per_100g}g</td>
                    <td className="px-5 py-3 text-zinc-600">{i.fat_per_100g}g</td>
                    <td className="px-5 py-3 text-zinc-600">{i.unit || "g"}</td>
                    <td className="px-5 py-3 text-zinc-600">   {i.cooking_factor != null ? i.cooking_factor : "—"} </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleEdit(i)} className="text-xs font-medium text-zinc-500 hover:text-zinc-900">Edit</button>
                        <button type="button" onClick={() => setDeleteTarget(i.id)} className="text-xs font-medium text-zinc-500 hover:text-red-600">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete ingredient?"
        description="This ingredient will be permanently removed. This action cannot be undone."
        onConfirm={() => { if (deleteTarget) handleDelete(deleteTarget); }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
