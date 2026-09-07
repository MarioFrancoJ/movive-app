"use client";

import { useState, useEffect, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { readSlot, type PlanSlotValue } from "@/lib/nutrition";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ShoppingItem {
  id: string;
  name: string;
  quantity: string;
  checked: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShoppingListPage() {
  const { dict } = useDictionary();
  const t = dict.nutrition.shoppingList;
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [listId, setListId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Load shopping list (most recent)
      const { data: listData } = await supabase
        .from("shopping_lists")
        .select("id, items")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (listData) {
        setListId(listData.id);
        const storedItems = (listData.items as any[]) || [];
        setItems(storedItems.map((item: any) => ({
          id: item.id || crypto.randomUUID(),
          name: item.name || "",
          quantity: item.quantity || "—",
          checked: item.checked || false,
        })));
      }

      setLoading(false);
    }
    loadData();
  }, []);

  // ── Persist to Supabase ─────────────────────────────────────────────────────

  async function saveItems(updatedItems: ShoppingItem[]) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);

    if (listId) {
      await supabase
        .from("shopping_lists")
        .update({ items: updatedItems as any })
        .eq("id", listId);
    } else {
      const { data: inserted } = await supabase
        .from("shopping_lists")
        .insert({
          user_id: user.id,
          items: updatedItems as any,
        })
        .select("id")
        .single();

      if (inserted) setListId(inserted.id);
    }

    setSaving(false);
  }

  // ── Generate from Meal Plan ─────────────────────────────────────────────────

  async function handleGenerate() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get the current week's meal plan
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const weekStart = monday.toISOString().slice(0, 10);

    const { data: planData } = await supabase
      .from("meal_plans")
      .select("plan_data")
      .eq("user_id", user.id)
      .eq("week_start_date", weekStart)
      .maybeSingle();

    if (!planData || !planData.plan_data) {
      setError(t.errorNoPlan);
      return;
    }

    // Extract recipe IDs from plan. Slots may be legacy strings or structured
    // { recipeId, servings } — readSlot normalizes both. The multiplier is the
    // SUM of servings across occurrences (a 2x lunch buys 2x its ingredients).
    const plan = planData.plan_data as Record<string, Record<string, PlanSlotValue>>;
    const recipeIds = new Set<string>();
    const recipeCounts: Record<string, number> = {};

    for (const day of Object.values(plan)) {
      for (const rawSlot of Object.values(day)) {
        const entry = readSlot(rawSlot);
        if (entry) {
          recipeIds.add(entry.recipeId);
          recipeCounts[entry.recipeId] = (recipeCounts[entry.recipeId] || 0) + entry.servings;
        }
      }
    }

    if (recipeIds.size === 0) {
      setError(t.errorPlanEmpty);
      return;
    }

    // Load recipe ingredients
    const { data: recipesData } = await supabase
      .from("recipes")
      .select(`
        id,
        recipe_ingredients (
          name,
          quantity,
          unit
        )
      `)
      .in("id", Array.from(recipeIds));

    if (!recipesData || recipesData.length === 0) {
      setError(t.errorLoadIngredients);
      return;
    }

    // Aggregate ingredients
    const ingredientMap: Record<string, { qty: number; unit: string }> = {};

    for (const recipe of recipesData) {
      const count = recipeCounts[recipe.id] || 1;
      for (const ing of (recipe.recipe_ingredients || [])) {
        const key = ing.name;
        if (ingredientMap[key]) {
          ingredientMap[key].qty += (ing.quantity || 0) * count;
        } else {
          ingredientMap[key] = { qty: (ing.quantity || 0) * count, unit: ing.unit || "" };
        }
      }
    }

    // Convert to ShoppingItem format
    const generatedItems: ShoppingItem[] = Object.entries(ingredientMap).map(([itemName, { qty, unit }]) => ({
      id: crypto.randomUUID(),
      name: itemName,
      quantity: `${qty} ${unit}`.trim(),
      checked: false,
    }));

    const updated = [...items, ...generatedItems];
    setItems(updated);
    await saveItems(updated);
    setGenerated(true);
    setError("");
    setTimeout(() => setGenerated(false), 2500);
  }

  // ── Add item ────────────────────────────────────────────────────────────────

  async function handleAdd(e: FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      setError(t.errorNameRequired);
      return;
    }

    setError("");

    const newItem: ShoppingItem = {
      id: crypto.randomUUID(),
      name: name.trim(),
      quantity: quantity.trim() || "—",
      checked: false,
    };

    const updated = [...items, newItem];
    setItems(updated);
    await saveItems(updated);
    setName("");
    setQuantity("");
  }

  // ── Remove / toggle / clear ─────────────────────────────────────────────────

  async function handleRemove(id: string) {
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    await saveItems(updated);
  }

  async function handleToggle(id: string) {
    const updated = items.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );
    setItems(updated);
    await saveItems(updated);
  }

  async function handleClearAll() {
    setItems([]);
    await saveItems([]);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t.itemCount.replace("{n}", String(items.length))}
            {saving && <span className="ml-2 text-xs text-zinc-400">({dict.common.saving})</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 lg:min-h-0"
          >
            {t.generate}
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 lg:min-h-0"
            >
              {t.clearAll}
            </button>
          )}
        </div>
      </div>

      {generated && (
        <p className="text-sm font-medium text-success">
          {t.generatedSuccess}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <p className="mb-4 text-sm font-semibold text-zinc-700">{t.addIngredient}</p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-56">
            <label htmlFor="ingredient-name" className="mb-1 block text-xs font-medium text-zinc-600">{t.ingredient}</label>
            <input
              id="ingredient-name"
              type="text"
              placeholder={t.ingredientPlaceholder}
              value={name}
              onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:h-9"
            />
          </div>
          <div className="w-full sm:w-36">
            <label htmlFor="ingredient-qty" className="mb-1 block text-xs font-medium text-zinc-600">{t.quantity}</label>
            <input
              id="ingredient-qty"
              type="text"
              placeholder={t.quantityPlaceholder}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:h-9"
            />
          </div>
          <button
            type="submit"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto lg:min-h-0"
          >
            {dict.common.add}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-6 py-4">
          <p className="text-sm font-semibold text-zinc-700">{t.items}</p>
        </div>

        {items.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-zinc-400">
              {t.empty}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => handleToggle(item.id)}
                    aria-label={item.checked ? `Uncheck ${item.name}` : `Check ${item.name}`}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      item.checked ? "border-border-brand bg-success" : "border-zinc-300 hover:border-zinc-400"
                    }`}
                  >
                    {item.checked && (
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-white" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                  <div>
                    <p className={`text-sm font-medium ${item.checked ? "text-zinc-400 line-through" : "text-zinc-900"}`}>
                      {item.name}
                    </p>
                    <p className="text-xs text-zinc-400">{item.quantity}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(item.id)}
                  aria-label={`Remove ${item.name}`}
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 lg:min-h-0 lg:min-w-0"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
