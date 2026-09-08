"use client";

/**
 * MealPlanModal — assignment-based meal planning for a single recipe.
 *
 * One recipe → many (day, slot, servings) assignments in a single save.
 * This is the long-term planning UI: multiple days, multiple meal slots and
 * different servings per assignment, plus a "Repeat Days" quick-fill. The
 * assignment model maps cleanly to a future drag-and-drop calendar.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  saveMealPlanAssignments,
  PLAN_DAYS,
  getPlanDayForDate,
  defaultSlotForRecipe,
  type MealSlot,
  type PlanDay,
  type MealPlanAssignment,
} from "@/lib/nutrition";

// ── Display helpers (UI only — internal values stay PlanDay / MealSlot) ───────

// Short label for a day chip (first 3 letters of the internal English value).
function dayShort(day: PlanDay): string {
  return day.slice(0, 3);
}

// Emoji + label for each meal slot. Keys are the internal MealSlot values so
// the stored value is unchanged; only the presentation is visual.
const SLOT_META: Record<MealSlot, { emoji: string; label: string }> = {
  Breakfast: { emoji: "🍳", label: "Breakfast" },
  Snack: { emoji: "🍎", label: "Snack" },
  Lunch: { emoji: "☀️", label: "Lunch" },
  Dinner: { emoji: "🌙", label: "Dinner" },
};

// Display order for the slot buttons (Breakfast → Snack → Lunch → Dinner),
// independent of MEAL_SLOTS' internal order.
const SLOT_DISPLAY_ORDER: MealSlot[] = ["Breakfast", "Snack", "Lunch", "Dinner"];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MealPlanModalRecipe {
  id: string;
  name: string;
  mealType?: MealSlot | null;
  calories?: number;
  goal?: string | null;
}

interface AssignmentRow {
  id: string;
  day: PlanDay;
  slot: MealSlot;
  servings: number;
}

interface MealPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipe: MealPlanModalRecipe | null;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MealPlanModal({
  isOpen,
  onClose,
  recipe,
  onSuccess,
  onError,
}: MealPlanModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [repeatFor, setRepeatFor] = useState<string | null>(null); // row id whose Repeat Days is open
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const defaultSlot = defaultSlotForRecipe(recipe?.mealType);

  const makeRow = useCallback(
    (): AssignmentRow => ({
      id: crypto.randomUUID(),
      day: getPlanDayForDate(),
      slot: defaultSlot,
      servings: 1,
    }),
    [defaultSlot]
  );

  // Reset to a single sensible default assignment each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setRows([makeRow()]);
      setRepeatFor(null);
      setWarning(null);
    }
  }, [isOpen, makeRow]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !recipe) return null;

  // ── Row mutations ─────────────────────────────────────────────────────────
  function updateRow(id: string, patch: Partial<AssignmentRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, makeRow()]);
  }
  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
    if (repeatFor === id) setRepeatFor(null);
  }

  // Repeat Days: generate one assignment per checked day, cloning this row's
  // slot + servings. Days already present (same slot) are not duplicated.
  function applyRepeatDays(baseRow: AssignmentRow, days: PlanDay[]) {
    setRows((prev) => {
      const next = [...prev];
      for (const day of days) {
        const exists = next.some((r) => r.day === day && r.slot === baseRow.slot);
        if (exists) continue;
        next.push({
          id: crypto.randomUUID(),
          day,
          slot: baseRow.slot,
          servings: baseRow.servings,
        });
      }
      return next;
    });
    setRepeatFor(null);
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!recipe || saving) return;
    setSaving(true);
    setWarning(null);

    const assignments: MealPlanAssignment[] = rows.map((r) => ({
      day: r.day,
      slot: r.slot,
      servings: r.servings,
    }));

    const res = await saveMealPlanAssignments(recipe.id, assignments);
    setSaving(false);

    if (!res.ok) {
      onError?.(res.error || "Could not save the meal plan.");
      return;
    }

    const added = res.added ?? 0;
    const skipped = res.skipped ?? [];

    if (added === 0) {
      // Everything was a duplicate — warn in-place, keep the modal open.
      setWarning(
        `This recipe is already scheduled in ${skipped.length} of those slot${skipped.length === 1 ? "" : "s"}. Nothing new was added.`
      );
      return;
    }

    let message = `Recipe added to ${added} meal plan slot${added === 1 ? "" : "s"}`;
    if (skipped.length > 0) {
      message += ` · ${skipped.length} skipped (already scheduled)`;
    }
    onSuccess?.(message);
    onClose();
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add recipe to meal plan"
    >
      <div className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-golden-xl bg-white shadow-xl sm:max-w-lg sm:rounded-golden-xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-100 p-golden-4">
          <div className="min-w-0">
            <h2 className="text-golden-lg font-bold text-zinc-900">Add Recipe to Meal Plan</h2>
            <p className="mt-0.5 truncate text-golden-sm text-zinc-500">
              {recipe.name}
              {typeof recipe.calories === "number" ? ` · ${recipe.calories} kcal` : ""}
              {recipe.goal ? ` · ${recipe.goal}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-golden-md p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
          </button>
        </div>

        {/* Assignments */}
        <div className="flex-1 overflow-y-auto p-golden-4">
          <div className="mb-golden-2 flex items-center justify-between">
            <p className="text-golden-xs font-bold uppercase tracking-widest text-zinc-400">Assignments</p>
            <span className="text-golden-xs text-zinc-400">{rows.length} row{rows.length === 1 ? "" : "s"}</span>
          </div>

          <div className="flex flex-col gap-golden-2">
            {rows.map((row) => (
              <div key={row.id} className="rounded-golden-lg border border-zinc-200 bg-zinc-50/50 p-golden-2">
                {/* Row header: summary + remove */}
                <div className="mb-golden-1 flex items-center justify-between gap-golden-2">
                  <span className="min-w-0 truncate text-golden-xs font-semibold text-zinc-500">
                    {dayShort(row.day)} · {SLOT_META[row.slot].label} · {row.servings}x
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={rows.length <= 1}
                    aria-label="Remove assignment"
                    className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-golden-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:min-h-0 sm:min-w-0"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41 41 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4Z" clipRule="evenodd" /></svg>
                  </button>
                </div>

                {/* Day — segmented chips (one tap; wraps on mobile) */}
                <div role="group" aria-label="Day" className="flex flex-wrap gap-1">
                  {PLAN_DAYS.map((d) => {
                    const active = row.day === d;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => updateRow(row.id, { day: d })}
                        aria-pressed={active}
                        title={d}
                        className={[
                          "min-h-[40px] min-w-[2.75rem] flex-1 rounded-golden-md px-golden-1 text-golden-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-h-[36px]",
                          active
                            ? "bg-primary text-white"
                            : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100",
                        ].join(" ")}
                      >
                        {dayShort(d)}
                      </button>
                    );
                  })}
                </div>

                {/* Slot — visual emoji buttons (one tap; 2-col mobile / 4-col desktop) */}
                <div role="group" aria-label="Meal slot" className="mt-golden-2 grid grid-cols-2 gap-1 sm:grid-cols-4">
                  {SLOT_DISPLAY_ORDER.map((s) => {
                    const active = row.slot === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => updateRow(row.id, { slot: s })}
                        aria-pressed={active}
                        className={[
                          "inline-flex min-h-[44px] items-center justify-center gap-1 rounded-golden-md px-golden-1 text-golden-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:min-h-[38px]",
                          active
                            ? "bg-primary text-white"
                            : "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100",
                        ].join(" ")}
                      >
                        <span aria-hidden="true">{SLOT_META[s].emoji}</span>
                        {SLOT_META[s].label}
                      </button>
                    );
                  })}
                </div>

                {/* Servings — stepper [-] n [+] */}
                <div className="mt-golden-2 flex items-center gap-golden-2">
                  <span className="text-golden-xs font-medium text-zinc-500">Servings</span>
                  <div className="inline-flex items-center rounded-golden-md ring-1 ring-inset ring-zinc-200">
                    <button
                      type="button"
                      onClick={() => updateRow(row.id, { servings: Math.max(1, row.servings - 1) })}
                      disabled={row.servings <= 1}
                      aria-label="Decrease servings"
                      className="flex h-11 w-11 items-center justify-center rounded-l-golden-md text-golden-base font-bold text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-30 sm:h-9 sm:w-9"
                    >
                      −
                    </button>
                    <span aria-live="polite" className="w-10 text-center text-golden-sm font-semibold text-zinc-900 sm:w-8">{row.servings}</span>
                    <button
                      type="button"
                      onClick={() => updateRow(row.id, { servings: row.servings + 1 })}
                      aria-label="Increase servings"
                      className="flex h-11 w-11 items-center justify-center rounded-r-golden-md text-golden-base font-bold text-zinc-600 transition-colors hover:bg-zinc-100 sm:h-9 sm:w-9"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Repeat Days toggle */}
                <div className="mt-golden-1">
                  <button
                    type="button"
                    onClick={() => setRepeatFor(repeatFor === row.id ? null : row.id)}
                    className="text-golden-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900"
                    aria-expanded={repeatFor === row.id}
                  >
                    {repeatFor === row.id ? "▾ Repeat Days" : "▸ Repeat Days"}
                  </button>

                  {repeatFor === row.id && (
                    <RepeatDays baseRow={row} onApply={(days) => applyRepeatDays(row, days)} />
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-golden-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-golden-md border border-dashed border-zinc-300 py-golden-2 text-golden-sm font-semibold text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-50 lg:min-h-0"
          >
            + Add Assignment
          </button>

          {warning && (
            <div role="alert" className="mt-golden-3 rounded-golden-md border border-amber-200 bg-amber-50 px-golden-3 py-golden-2 text-golden-sm font-medium text-amber-800">
              {warning}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-golden-2 border-t border-zinc-100 p-golden-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center rounded-golden-md border border-zinc-200 bg-white px-golden-4 py-golden-2 text-golden-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50 lg:min-h-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || rows.length === 0}
            className="inline-flex min-h-[44px] items-center justify-center rounded-golden-md bg-primary px-golden-4 py-golden-2 text-golden-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 lg:min-h-0"
          >
            {saving ? "Saving…" : `Save ${rows.length} assignment${rows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Repeat Days sub-panel ─────────────────────────────────────────────────────

function RepeatDays({
  baseRow,
  onApply,
}: {
  baseRow: AssignmentRow;
  onApply: (days: PlanDay[]) => void;
}) {
  // Default selection: weekdays (Mon–Fri), plus the base row's own day.
  const [selected, setSelected] = useState<Set<PlanDay>>(() => {
    const initial = new Set<PlanDay>(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    initial.add(baseRow.day);
    return initial;
  });

  function toggle(day: PlanDay) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  return (
    <div className="mt-golden-2 rounded-golden-md border border-zinc-200 bg-white p-golden-2">
      <p className="mb-golden-1 text-golden-xs text-zinc-500">
        Applies <strong className="font-semibold text-zinc-700">{baseRow.slot}</strong> · {baseRow.servings}x to each checked day.
      </p>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        {PLAN_DAYS.map((day) => {
          const checked = selected.has(day);
          return (
            <label
              key={day}
              className={[
                "flex cursor-pointer items-center gap-2 rounded-golden-md border px-golden-2 py-golden-1 text-golden-xs font-medium transition-colors",
                checked ? "border-zinc-700 bg-zinc-100 text-zinc-900" : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(day)}
                className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-400"
              />
              {day.slice(0, 3)}
            </label>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onApply(Array.from(selected))}
        disabled={selected.size === 0}
        className="mt-golden-2 w-full rounded-golden-md bg-primary py-golden-1 text-golden-xs font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
      >
        Apply to {selected.size} day{selected.size === 1 ? "" : "s"}
      </button>
    </div>
  );
}
