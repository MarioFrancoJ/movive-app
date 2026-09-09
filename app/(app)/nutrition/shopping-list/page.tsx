"use client";

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useToast } from "@/components/ui/Toast";
import {
  getWeekBounds,
  generateShoppingListFromWeek,
  getRecipeNames,
  SHOPPING_CATEGORIES,
  type ShoppingCategory,
  type ShoppingListItemRow,
  type MergeIngredientInput,
  mergeRows,
  mergeTwoRows,
  loadShoppingListItems,
} from "@/lib/nutrition";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

const UNIT_OPTIONS = ["g", "kg", "ml", "l", "unit", "slice", "scoop", "cup", "tbsp", "tsp", ""] as const;

function formatQty(qty: number | null, unit: string): string {
  if (qty == null) return "—";
  return unit ? `${qty} ${unit}` : String(qty);
}

export default function ShoppingListPage() {
  const { dict } = useDictionary();
  const t = dict.nutrition.shoppingList;
  const { success, info, error: toastError } = useToast();

  const [rows, setRows] = useState<ShoppingListItemRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("g");
  const [category, setCategory] = useState<ShoppingCategory>("Other");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("");

  const [boughtOpen, setBoughtOpen] = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Record<string, boolean>>({});

  const supabase = createClient();

  const [recipeNames, setRecipeNames] = useState<Record<string, string>>({});
  const [openSource, setOpenSource] = useState<string | null>(null);

  const refreshRecipeNames = async (list: ShoppingListItemRow[]) => {
    const ids = list.flatMap((r) => r.source_recipe_ids ?? []);
    if (ids.length) setRecipeNames(await getRecipeNames(ids));
  };

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      const list = await loadShoppingListItems();
      setRows(list);
      await refreshRecipeNames(list);
      setLoading(false);
    }
    load();
  }, []);

  const catLabel = (c: ShoppingCategory) => t.categories?.[c] ?? c;

  const { pendingByCat, bought } = useMemo(() => {
    const pending = rows.filter((r) => !r.checked);
    const done = rows.filter((r) => r.checked);
    const byCat: Record<string, ShoppingListItemRow[]> = {};
    for (const c of SHOPPING_CATEGORIES) {
      const inCat = pending.filter((r) => r.category === c);
      if (inCat.length) byCat[c] = inCat;
    }
    return { pendingByCat: byCat, bought: done };
  }, [rows]);

  const progress = useMemo(() => {
    const total = rows.length;
    const boughtN = rows.filter((r) => r.checked).length;
    return { total, bought: boughtN, pending: total - boughtN, pct: total > 0 ? Math.round((boughtN / total) * 100) : 0 };
  }, [rows]);

  function isCatOpen(c: ShoppingCategory): boolean {
    if (c in collapsedCats) return !collapsedCats[c];
    return (pendingByCat[c]?.length ?? 0) > 0;
  }
  function toggleCat(c: ShoppingCategory) {
    setCollapsedCats((prev) => ({ ...prev, [c]: !( c in prev ? !prev[c] : (pendingByCat[c]?.length ?? 0) > 0) }));
  }

  async function insertRow(row: Omit<ShoppingListItemRow, "id">): Promise<ShoppingListItemRow | null> {
    if (!userId) return null;
    setSaving(true);
    const { data, error: e } = await supabase
      .from("shopping_list_items")
      .insert({
        user_id: userId, name: row.name, qty: row.qty, unit: row.unit,
        category: row.category, checked: row.checked,
        source_recipe_id: row.source_recipe_id ?? null, sort_order: row.sort_order ?? rows.length,
      } as never)
      .select("id, name, qty, unit, category, checked, source_recipe_id, sort_order")
      .single();
    setSaving(false);
    if (e) { setError(e.message); return null; }
    return data as ShoppingListItemRow;
  }

  async function updateRow(id: string, patch: Partial<ShoppingListItemRow>) {
    setSaving(true);
    const { error: e } = await supabase.from("shopping_list_items").update(patch as never).eq("id", id);
    setSaving(false);
    if (e) setError(e.message);
  }

  async function deleteRow(id: string) {
    setSaving(true);
    const { error: e } = await supabase.from("shopping_list_items").delete().eq("id", id);
    setSaving(false);
    if (e) setError(e.message);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError(t.errorNameRequired); return; }
    setError("");

    const qNum = qty.trim() === "" ? null : Math.round((Number(qty) || 0) * 100) / 100;
    const incoming: MergeIngredientInput = { name: name.trim(), quantity: qNum ?? 0, unit, category };

    const merged = mergeRows(rows, [incoming]);
    const isMerge = merged.length === rows.length;

    if (isMerge) {
      const changed = merged.find((m) => {
        const prev = rows.find((r) => r.id === m.id);
        return prev && (prev.qty !== m.qty || prev.checked !== m.checked);
      });
      if (changed) {
        setRows(merged);
        await updateRow(changed.id, { qty: changed.qty, checked: changed.checked });
        info(t.toastMerged);
      }
    } else {
      const created = await insertRow({
        name: name.trim(), qty: qNum, unit, category, checked: false, sort_order: rows.length,
      });
      if (created) setRows((prev) => [...prev, created]);
    }
    setName(""); setQty(""); setUnit("g"); setCategory("Other");
  }

  async function handleToggle(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const next = !row.checked;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, checked: next } : r)));
    await updateRow(id, { checked: next });
  }

  async function handleRemove(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) setEditingId(null);
    await deleteRow(id);
  }

  async function handleClearAll() {
    if (!userId || rows.length === 0) return;
    setRows([]);
    setSaving(true);
    const { error: e } = await supabase.from("shopping_list_items").delete().eq("user_id", userId);
    setSaving(false);
    if (e) setError(e.message);
  }

  async function handleChangeCategory(id: string, c: ShoppingCategory) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, category: c } : r)));
    await updateRow(id, { category: c });
  }

  function startEdit(row: ShoppingListItemRow) {
    setEditingId(row.id);
    setEditName(row.name);
    setEditQty(row.qty == null ? "" : String(row.qty));
    setEditUnit(row.unit);
  }
  function cancelEdit() { setEditingId(null); }

  async function saveEdit(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const newName = editName.trim() || row.name;
    const newQty = editQty.trim() === "" ? null : Math.round((Number(editQty) || 0) * 100) / 100;
    const newUnit = editUnit;

    const collision = rows.find(
      (r) => r.id !== id &&
        r.name.trim().toLowerCase() === newName.trim().toLowerCase() &&
        r.unit === newUnit
    );

    if (collision) {
      const editedRow: ShoppingListItemRow = { ...row, name: newName, qty: newQty, unit: newUnit };
      const mergedInto = mergeTwoRows(collision, editedRow);
      setRows((prev) => prev
        .filter((r) => r.id !== id)
        .map((r) => (r.id === collision.id ? mergedInto : r)));
      setEditingId(null);
      await updateRow(collision.id, { qty: mergedInto.qty, checked: mergedInto.checked });
      await deleteRow(id);
      info(t.toastMerged);
      return;
    }

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, name: newName, qty: newQty, unit: newUnit } : r)));
    setEditingId(null);
    await updateRow(id, { name: newName, qty: newQty, unit: newUnit });
  }

  async function handleGenerate() {
    if (!userId) return;
    setError("");
    const weekStart = getWeekBounds(new Date()).start;
    setSaving(true);
    const res = await generateShoppingListFromWeek(weekStart);
    setSaving(false);
    if (!res.ok) {
      if (res.error === "NO_PLAN") setError(t.errorNoPlan);
      else if (res.error === "PLAN_EMPTY") setError(t.errorPlanEmpty);
      else setError(t.errorLoadIngredients);
      return;
    }
    const list = await loadShoppingListItems();
    setRows(list);
    await refreshRecipeNames(list);
    const added = res.added ?? 0;
    const consolidated = res.consolidated ?? 0;
    success(
      added === 0 && consolidated === 0
        ? t.generatedNoChange
        : t.generatedDetail
            .replace("{added}", String(added))
            .replace("{recipes}", String(res.recipeCount ?? 0))
            .replace("{consolidated}", String(consolidated))
    );
  }

  if (loading) return <PageLoader text={t.loading} />;

  const pendingCount = rows.length - bought.length;

  return (
    <div className="space-y-6 px-4 py-4 md:px-6 md:py-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t.itemCount.replace("{n}", String(rows.length))}
            {saving && <span className="ml-2 text-xs text-zinc-400">({dict.common.saving})</span>}
          </p>
        </div>
        {rows.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex min-h-[44px] items-center rounded-golden-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 lg:min-h-0"
          >
            {t.clearAll}
          </button>
        )}
      </div>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={saving}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto sm:self-start"
      >
        <span aria-hidden="true">🛒</span> {saving ? dict.common.saving : t.generate}
      </button>

      {error && <p className="text-sm text-red-500" role="alert">{error}</p>}

      {/* Progress summary */}
      {rows.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-sm">
              <span className="font-semibold text-zinc-900">{t.itemCount.replace("{n}", String(progress.total))}</span>
              <span className="text-zinc-500">{t.pendingCount.replace("{n}", String(progress.pending))}</span>
              <span className="text-success">{t.boughtCount.replace("{n}", String(progress.bought))}</span>
            </div>
            <span className="text-sm font-bold text-primary-fg">{t.percentComplete.replace("{n}", String(progress.pct))}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="mb-3 text-sm font-semibold text-zinc-700">{t.addIngredient}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="sl-name" className="mb-1 block text-xs font-medium text-zinc-600">{t.ingredient}</label>
            <input id="sl-name" type="text" placeholder={t.ingredientPlaceholder} value={name}
              onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:h-9" />
          </div>
          <div className="w-24">
            <label htmlFor="sl-qty" className="mb-1 block text-xs font-medium text-zinc-600">{t.quantity}</label>
            <input id="sl-qty" type="number" min={0} step="0.01" placeholder="0" value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:h-9" />
          </div>
          <div className="w-24">
            <label htmlFor="sl-unit" className="mb-1 block text-xs font-medium text-zinc-600">{t.unit}</label>
            <select id="sl-unit" value={unit} onChange={(e) => setUnit(e.target.value)}
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:h-9">
              {UNIT_OPTIONS.map((u) => <option key={u || "none"} value={u}>{u || "—"}</option>)}
            </select>
          </div>
          <div className="w-36">
            <label htmlFor="sl-cat" className="mb-1 block text-xs font-medium text-zinc-600">{t.category}</label>
            <select id="sl-cat" value={category} onChange={(e) => setCategory(e.target.value as ShoppingCategory)}
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:h-9">
              {SHOPPING_CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
            </select>
          </div>
          <button type="submit"
            className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto lg:min-h-0">
            {dict.common.add}
          </button>
        </div>
      </form>

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
          <p className="px-6 text-center text-sm text-zinc-400">{t.empty}</p>
        </div>
      ) : (
        <>
          {/* Pending */}
          {pendingCount === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white px-6 py-8 text-center text-sm text-zinc-400 shadow-sm">
              {t.allBought}
            </div>
          ) : (
            <div className="space-y-4">
              {SHOPPING_CATEGORIES.filter((c) => pendingByCat[c]?.length).map((c) => (
                <div key={c} className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleCat(c)}
                    aria-expanded={isCatOpen(c)}
                    className="flex w-full items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 text-left transition-colors hover:bg-zinc-100"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                      <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 transition-transform ${isCatOpen(c) ? "" : "-rotate-90"}`} aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" /></svg>
                      {catLabel(c)}
                    </span>
                    <span className="text-xs font-medium text-zinc-400">{pendingByCat[c].length}</span>
                  </button>
                  {isCatOpen(c) && (
                  <ul className="divide-y divide-zinc-100">
                    {pendingByCat[c].map((item) => (
                      <li key={item.id} className="px-4 py-3">
                        {editingId === item.id ? (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                              aria-label={t.ingredient}
                              className="h-10 min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:h-9" />
                            <input type="number" min={0} step="0.01" value={editQty} onChange={(e) => setEditQty(e.target.value)}
                              aria-label={t.quantity} placeholder="0"
                              className="h-10 w-20 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:h-9" />
                            <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)} aria-label={t.unit}
                              className="h-10 w-24 rounded-lg border border-zinc-200 px-2 text-sm text-zinc-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:h-9">
                              {UNIT_OPTIONS.map((u) => <option key={u || "none"} value={u}>{u || "—"}</option>)}
                            </select>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => saveEdit(item.id)}
                                className="inline-flex min-h-[40px] items-center rounded-lg bg-primary px-3 text-xs font-semibold text-white hover:bg-primary-hover sm:min-h-0 sm:py-2">
                                {dict.common.save}
                              </button>
                              <button type="button" onClick={cancelEdit}
                                className="inline-flex min-h-[40px] items-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-600 hover:bg-zinc-50 sm:min-h-0 sm:py-2">
                                {dict.common.cancel}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => handleToggle(item.id)}
                              aria-label={`${dict.common.add} ${item.name}`}
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-zinc-300 transition-colors hover:border-primary">
                              <span className="sr-only">toggle</span>
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-900">{item.name}</p>
                              <p className="text-xs text-zinc-400">{formatQty(item.qty, item.unit)}</p>
                              {(item.source_recipe_ids?.length ?? 0) > 0 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setOpenSource(openSource === item.id ? null : item.id)}
                                    aria-expanded={openSource === item.id}
                                    className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-semibold text-primary-fg"
                                  >
                                    {t.fromRecipes.replace("{n}", String(item.source_recipe_ids!.length))}
                                  </button>
                                  {openSource === item.id && (
                                    <ul className="mt-1 space-y-0.5">
                                      {item.source_recipe_ids!.map((rid) => (
                                        <li key={rid} className="truncate text-[11px] text-zinc-500">• {recipeNames[rid] ?? "…"}</li>
                                      ))}
                                    </ul>
                                  )}
                                </>
                              )}
                            </div>
                            <select value={item.category} onChange={(e) => handleChangeCategory(item.id, e.target.value as ShoppingCategory)}
                              aria-label={t.category}
                              className="h-8 rounded-lg border border-zinc-200 bg-white px-1.5 text-xs text-zinc-500 focus:border-zinc-400 focus:outline-none">
                              {SHOPPING_CATEGORIES.map((cc) => <option key={cc} value={cc}>{catLabel(cc)}</option>)}
                            </select>
                            <button type="button" onClick={() => startEdit(item)} aria-label={dict.common.edit}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700">
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M2.695 14.762l-1.262 3.155a.5.5 0 0 0 .65.65l3.155-1.262a4 4 0 0 0 1.343-.885L17.5 5.5a2.121 2.121 0 0 0-3-3L3.58 13.42a4 4 0 0 0-.885 1.343Z" /></svg>
                            </button>
                            <button type="button" onClick={() => handleRemove(item.id)} aria-label={`${dict.common.delete} ${item.name}`}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600">
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5Z" clipRule="evenodd" /></svg>
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Bought */}
          {bought.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
              <button type="button" onClick={() => setBoughtOpen((o) => !o)} aria-expanded={boughtOpen}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-50">
                <span className="text-sm font-semibold text-zinc-700">
                  {t.bought} <span className="text-zinc-400">({bought.length})</span>
                </span>
                <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 text-zinc-400 transition-transform ${boughtOpen ? "rotate-180" : ""}`} aria-hidden="true"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" clipRule="evenodd" /></svg>
              </button>
              {boughtOpen && (
                <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
                  {bought.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <button type="button" onClick={() => handleToggle(item.id)}
                        aria-label={`${dict.common.add} ${item.name}`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border-brand bg-success">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-white" aria-hidden="true"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" /></svg>
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-400 line-through">{item.name}</p>
                        <p className="text-xs text-zinc-300">{formatQty(item.qty, item.unit)}</p>
                      </div>
                      <button type="button" onClick={() => handleRemove(item.id)} aria-label={`${dict.common.delete} ${item.name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5Z" clipRule="evenodd" /></svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
