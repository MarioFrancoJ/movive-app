"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import Chip from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { readSlot, getWeekBounds, type PlanSlotValue } from "@/lib/nutrition";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// Dictionary slices for the meal-planner view.
type NutritionDict = ReturnType<typeof useDictionary>["dict"]["nutrition"];
type MealPlannerDict = NutritionDict["mealPlanner"];

// ── Types ─────────────────────────────────────────────────────────────────────

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
// 5 meal slots in chronological order (Snack PM comes before Dinner). Legacy
// plans stored a "Snack" key; it is read as "Snack PM" for backward
// compatibility (see normalizeDaySlots).
const MEALS = ["Breakfast", "Snack AM", "Lunch", "Snack PM", "Dinner"] as const;

type Day = (typeof DAYS)[number];
type Meal = (typeof MEALS)[number];
// A slot value may be a legacy recipe-id string or a structured entry.
type MealPlan = Record<Day, Record<Meal, PlanSlotValue>>;

interface RecipeSummary {
  id: string;
  name: string;
  goal: string;
  imageUrl: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ── Templates (goal-based week fill, adapted to the 4-slot model) ────────────

interface PlanTemplate {
  name: string;
  goal: string;
  description: string;
}

// Templates carry a functional `goal` (used to filter recipes — data, not UI)
// plus a localized display `name` (reusing the shared recipe goal labels).
// The template descriptions have no matching keys, so they remain English.
function buildTemplates(nt: NutritionDict): PlanTemplate[] {
  return [
    { name: nt.recipes.goalFatLoss, goal: "Fat Loss", description: "Low-calorie plan focused on lean proteins and vegetables." },
    { name: nt.recipes.goalMaintenance, goal: "Maintenance", description: "Balanced plan to maintain current weight and energy." },
    { name: nt.recipes.goalMuscleGain, goal: "Muscle Gain", description: "High-protein, high-calorie plan for muscle growth." },
  ];
}

type CalendarDict = ReturnType<typeof useDictionary>["dict"]["calendar"];

// Abbreviated weekday label. The mealPlanner namespace has no day-name keys,
// so we reuse the shared calendar.weekday* abbreviations (Mon…Sun).
function weekdayAbbrev(day: string, cal: CalendarDict): string {
  switch (day) {
    case "Monday":    return cal.weekdayMon;
    case "Tuesday":   return cal.weekdayTue;
    case "Wednesday": return cal.weekdayWed;
    case "Thursday":  return cal.weekdayThu;
    case "Friday":    return cal.weekdayFri;
    case "Saturday":  return cal.weekdaySat;
    case "Sunday":    return cal.weekdaySun;
    default:          return day.slice(0, 3);
  }
}

// Localized label for a meal slot (mealPlanner.slot* keys). The English slot
// string is also the object key used for logic/state (MEAL_META, plan data).
function slotLabel(meal: string, t: MealPlannerDict): string {
  switch (meal) {
    case "Breakfast": return t.slotBreakfast;
    case "Snack AM":  return t.slotSnackAm;
    case "Lunch":     return t.slotLunch;
    case "Dinner":    return t.slotDinner;
    case "Snack PM":  return t.slotSnackPm;
    default:          return meal;
  }
}

// Localized full weekday name (mealPlanner.dayFull* keys). The English day
// string ("Monday"…) stays the internal state/logic key; this only affects
// what the user sees.
function fullWeekdayLabel(day: string, t: MealPlannerDict): string {
  switch (day) {
    case "Monday":    return t.dayFullMonday;
    case "Tuesday":   return t.dayFullTuesday;
    case "Wednesday": return t.dayFullWednesday;
    case "Thursday":  return t.dayFullThursday;
    case "Friday":    return t.dayFullFriday;
    case "Saturday":  return t.dayFullSaturday;
    case "Sunday":    return t.dayFullSunday;
    default:          return day;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptySlots(): Record<Meal, PlanSlotValue> {
  return { "Breakfast": null, "Snack AM": null, "Lunch": null, "Snack PM": null, "Dinner": null };
}

function emptyPlan(): MealPlan {
  const plan = {} as MealPlan;
  for (const day of DAYS) {
    plan[day] = emptySlots();
  }
  return plan;
}

/** Normalize a stored plan_data blob to the current 5-slot model.
 * Backward-compat: a legacy "Snack" key maps to "Snack PM". Unknown keys are
 * ignored. Every day always gets all 5 slots (missing ones default to null). */
function normalizePlan(raw: unknown): MealPlan {
  const plan = emptyPlan();
  if (!raw || typeof raw !== "object") return plan;
  const data = raw as Record<string, Record<string, PlanSlotValue>>;
  for (const day of DAYS) {
    const slots = data[day];
    if (!slots || typeof slots !== "object") continue;
    for (const [key, value] of Object.entries(slots)) {
      const target = key === "Snack" ? "Snack PM" : key;
      if ((MEALS as readonly string[]).includes(target)) {
        plan[day][target as Meal] = value ?? null;
      }
    }
  }
  return plan;
}

/** This week's Monday key (today). */
function currentWeekStart(): string {
  return getWeekBounds(new Date()).start;
}

/** Shift a Monday key by ±7*n days, returning the new Monday key. */
function shiftWeek(weekStart: string, weeks: number): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

/** Sunday key for a given Monday key. */
function weekEnd(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** Human label e.g. "Aug 25 – Aug 31, 2026" for a Monday key. */
function formatWeekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const end = new Date(`${weekEnd(weekStart)}T00:00:00Z`);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
  const startStr = start.toLocaleDateString("en-US", opts);
  const endStr = end.toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}, ${end.getUTCFullYear()}`;
}

// ── Meal-slot identity (color system only — no emojis, no dots) ──────────────
// 5 slots, each with a distinct but coherent tint + text color.
const MEAL_META: Record<string, { accent: string; tint: string }> = {
  "Breakfast": { accent: "text-amber-600", tint: "bg-amber-50" },
  "Snack AM": { accent: "text-orange-600", tint: "bg-orange-50" },
  "Lunch": { accent: "text-success", tint: "bg-success-light" },
  "Snack PM": { accent: "text-rose-600", tint: "bg-rose-50" },
  "Dinner": { accent: "text-indigo-600", tint: "bg-indigo-50" },
};

/** Small recipe photo thumbnail (falls back to a soft food glyph). */
function MealThumb({ imageUrl, name, className = "" }: { imageUrl: string | null; name: string; className?: string }) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={name} loading="lazy" decoding="async" className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-300 ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-1/3 w-1/3" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/** Resolve a slot value (legacy string or structured) into recipe + servings. */
function getSlot(
  value: PlanSlotValue,
  recipes: RecipeSummary[]
): { recipe: RecipeSummary; servings: number } | undefined {
  const entry = readSlot(value);
  if (!entry) return undefined;
  const recipe = recipes.find((r) => r.id === entry.recipeId);
  if (!recipe) return undefined;
  return { recipe, servings: entry.servings };
}

function dayTotals(plan: MealPlan, day: Day, recipes: RecipeSummary[]) {
  let calories = 0, protein = 0, carbs = 0, fat = 0;
  for (const meal of MEALS) {
    const s = getSlot(plan[day][meal], recipes);
    if (s) {
      calories += s.recipe.calories * s.servings;
      protein += s.recipe.protein * s.servings;
      carbs += s.recipe.carbs * s.servings;
      fat += s.recipe.fat * s.servings;
    }
  }
  return { calories, protein, carbs, fat };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MealPlannerPage() {
  const { dict } = useDictionary();
  const nt = dict.nutrition;
  const t = dict.nutrition.mealPlanner;
  const cal = dict.calendar;
  const { success: showToast } = useToast();
  const templates = useMemo(() => buildTemplates(nt), [nt]);
  const [plan, setPlan] = useState<MealPlan>(emptyPlan());
  const [planId, setPlanId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [selectedDay, setSelectedDay] = useState<Day>("Monday");
  const [loading, setLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // Clipboard for Copy Day / Paste Day (holds one day's 4-slot map).
  const [clipboardDay, setClipboardDay] = useState<Record<Meal, PlanSlotValue> | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showLoad, setShowLoad] = useState(false);
  // Which (day, meal) slot the recipe picker is choosing for (null = closed).
  const [pickerTarget, setPickerTarget] = useState<{ day: Day; meal: Meal } | null>(null);
  // Which day's "···" menu is open (desktop grid), null = none.
  const [openDayMenu, setOpenDayMenu] = useState<Day | null>(null);
  // Desktop drag & drop: the slot currently being dragged, and the hovered drop target.
  const [dragFrom, setDragFrom] = useState<{ day: Day; meal: Meal } | null>(null);
  const [dragOver, setDragOver] = useState<{ day: Day; meal: Meal } | null>(null);
  // Whether the currently loaded week's plan is an explicit saved plan.
  const [isSaved, setIsSaved] = useState(false);
  const [savedPlans, setSavedPlans] = useState<{ id: string; weekStart: string; weekEnd: string }[]>([]);
  // The Monday of the week currently being edited. Starts on the current week.
  const [weekStart, setWeekStart] = useState<string>(() => currentWeekStart());

  const isCurrentWeek = weekStart === currentWeekStart();

  // Load recipes once (they don't change per week).
  useEffect(() => {
    async function loadRecipes() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: recipesData } = await supabase
        .from("recipes")
        .select("id, name, goal, image_url, calories, protein, carbs, fat")
        .order("name");

      if (recipesData) {
        setRecipes(recipesData.map((r) => ({
          id: r.id,
          name: r.name,
          goal: r.goal || "Maintenance",
          imageUrl: r.image_url || null,
          calories: r.calories || 0,
          protein: r.protein || 0,
          carbs: r.carbs || 0,
          fat: r.fat || 0,
        })));
      }
      setLoading(false);
    }
    loadRecipes();
  }, []);

  // Load the plan for the selected week whenever it changes.
  useEffect(() => {
    async function loadWeek() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setWeekLoading(true);
      const start = weekStart;
      const end = weekEnd(weekStart);

      // Tolerant read: order by updated_at so any historical duplicate for the
      // same week never breaks the load (maybeSingle would otherwise error).
      const { data: planData } = await supabase
        .from("meal_plans")
        .select("id, plan_data, is_saved")
        .eq("user_id", user.id)
        .eq("week_start_date", start)
        .eq("week_end_date", end)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (planData && planData.plan_data) {
        setPlanId(planData.id);
        setPlan(normalizePlan(planData.plan_data));
        setIsSaved(planData.is_saved ?? false);
      } else {
        setPlanId(null);
        setPlan(emptyPlan());
        setIsSaved(false);
      }
      setWeekLoading(false);
    }
    loadWeek();
  }, [weekStart]);

  // ── Persist to Supabase (always the SELECTED week) ───────────────────────────

  // Persist the selected week. Auto-saves are drafts (is_saved stays false);
  // only an explicit "Save Plan" passes markSaved=true. An already-saved plan
  // is never silently demoted to draft by an auto-save.
  const savePlan = useCallback(async (updatedPlan: MealPlan, markSaved?: boolean) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSaving(true);
    const start = weekStart;
    const end = weekEnd(weekStart);

    if (planId) {
      await supabase
        .from("meal_plans")
        .update({
          plan_data: updatedPlan as any,
          ...(markSaved ? { is_saved: true } : {}),
        })
        .eq("id", planId);
      if (markSaved) setIsSaved(true);
    } else {
      const { data: inserted } = await supabase
        .from("meal_plans")
        .insert({
          user_id: user.id,
          week_start_date: start,
          week_end_date: end,
          plan_data: updatedPlan as any,
          is_saved: markSaved ?? false,
        })
        .select("id")
        .single();

      if (inserted) setPlanId(inserted.id);
      if (markSaved) setIsSaved(true);
    }
    setSaving(false);
  }, [weekStart, planId]);

  // ── Week navigation ──────────────────────────────────────────────────────────
  function goPrevWeek() { setWeekStart((w) => shiftWeek(w, -1)); }
  function goNextWeek() { setWeekStart((w) => shiftWeek(w, 1)); }
  function goCurrentWeek() { setWeekStart(currentWeekStart()); }

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleClear(meal: Meal) {
    const updated = { ...plan, [selectedDay]: { ...plan[selectedDay], [meal]: null } };
    setPlan(updated);
    savePlan(updated);
  }

  async function handleClearAll() {
    const cleared = emptyPlan();
    setPlan(cleared);
    await savePlan(cleared);
    showToast(t.toastCleared);
  }

  // ── Day tools (Copy / Paste / Clear the selected day) ────────────────────────

  function copyDay() {
    // Snapshot the selected day's 4 slots into the clipboard.
    setClipboardDay({ ...plan[selectedDay] });
    showToast(t.toastDayCopied.replace("{day}", fullWeekdayLabel(selectedDay, t)));
  }

  function pasteDay() {
    if (!clipboardDay) return;
    const updated = { ...plan, [selectedDay]: { ...clipboardDay } };
    setPlan(updated);
    savePlan(updated);
    showToast(t.toastPastedTo.replace("{day}", fullWeekdayLabel(selectedDay, t)));
  }

  function clearDay() {
    const updated = { ...plan, [selectedDay]: emptySlots() };
    setPlan(updated);
    savePlan(updated);
    showToast(t.toastDayCleared.replace("{day}", fullWeekdayLabel(selectedDay, t)));
  }

  // Whether the selected day has anything to copy/clear.
  const selectedDayHasMeals = MEALS.some((m) => readSlot(plan[selectedDay][m]) !== null);

  // ── Day-parameterized helpers (used by the desktop 7-day grid) ───────────────
  // Same behavior as the selected-day handlers, but target an explicit day so
  // the grid can edit any cell directly. All persist via the week-scoped savePlan.
  function setSlotFor(day: Day, meal: Meal, recipeId: string) {
    const updated = { ...plan, [day]: { ...plan[day], [meal]: recipeId || null } };
    setPlan(updated);
    savePlan(updated);
  }
  function clearSlotFor(day: Day, meal: Meal) {
    const updated = { ...plan, [day]: { ...plan[day], [meal]: null } };
    setPlan(updated);
    savePlan(updated);
  }

  // Drag & drop (desktop): move a slot's value to another slot. If the target
  // is occupied the two values swap; otherwise the source is emptied. Recalcs
  // (totals/KPIs) are derived from `plan`, so they update automatically.
  function moveSlot(from: { day: Day; meal: Meal }, to: { day: Day; meal: Meal }) {
    if (from.day === to.day && from.meal === to.meal) return;
    const fromVal = plan[from.day][from.meal];
    if (!readSlot(fromVal)) return; // nothing to move
    const toVal = plan[to.day][to.meal];
    const updated: MealPlan = {
      ...plan,
      [from.day]: { ...plan[from.day], [from.meal]: toVal ?? null },
      [to.day]: { ...plan[to.day], [to.meal]: fromVal },
    };
    // When from/to share a day, the two spreads above must be merged so both
    // edits land on the same day object.
    if (from.day === to.day) {
      updated[from.day] = { ...plan[from.day], [from.meal]: toVal ?? null, [to.meal]: fromVal };
    }
    setPlan(updated);
    savePlan(updated);
  }
  function copyDayOf(day: Day) {
    setClipboardDay({ ...plan[day] });
    showToast(t.toastDayCopied.replace("{day}", fullWeekdayLabel(day, t)));
  }
  function pasteDayInto(day: Day) {
    if (!clipboardDay) return;
    const updated = { ...plan, [day]: { ...clipboardDay } };
    setPlan(updated);
    savePlan(updated);
    showToast(t.toastPastedTo.replace("{day}", fullWeekdayLabel(day, t)));
  }
  function clearDayOf(day: Day) {
    const updated = { ...plan, [day]: emptySlots() };
    setPlan(updated);
    savePlan(updated);
    showToast(t.toastDayCleared.replace("{day}", fullWeekdayLabel(day, t)));
  }
  function dayHasMeals(day: Day) {
    return MEALS.some((m) => readSlot(plan[day][m]) !== null);
  }

  // ── Templates (fill the whole week by goal, 4-slot model) ────────────────────

  // Does the CURRENT week have any planned meal on any day/slot?
  const weekHasMeals = DAYS.some((d) => MEALS.some((m) => readSlot(plan[d][m]) !== null));

  function applyTemplate(template: PlanTemplate) {
    const goalRecipes = recipes.filter((r) => r.goal === template.goal);
    if (goalRecipes.length === 0) {
      showToast(t.toastNoRecipesForGoal.replace("{name}", template.name));
      setShowTemplates(false);
      return;
    }

    // Fill every day/slot by cycling through the goal's recipes (same approach
    // as Planner B, mapped to the 4-slot MEALS array). Writes plain recipe-id
    // strings, which readSlot normalizes everywhere (Calendar/Shopping List).
    const newPlan = emptyPlan();
    for (const day of DAYS) {
      for (const meal of MEALS) {
        const idx = (DAYS.indexOf(day) * MEALS.length + MEALS.indexOf(meal)) % goalRecipes.length;
        newPlan[day][meal] = goalRecipes[idx].id;
      }
    }

    setPlan(newPlan);
    savePlan(newPlan);
    setShowTemplates(false);
    showToast(t.toastTemplateApplied.replace("{name}", template.name));
  }

  // ── Save / Load / Duplicate ──────────────────────────────────────────────────

  // Explicitly mark the current week's plan as saved (is_saved = true).
  async function handleSavePlan() {
    await savePlan(plan, true);
    showToast(isSaved ? t.toastPlanUpdated : t.toastPlanSaved);
  }

  // Open the Load modal, fetching this user's saved plans (is_saved = true).
  async function handleOpenLoad() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("meal_plans")
      .select("id, week_start_date, week_end_date")
      .eq("user_id", user.id)
      .eq("is_saved", true)
      .order("week_start_date", { ascending: false })
      .limit(20);

    setSavedPlans((data ?? []).map((p) => ({
      id: p.id,
      weekStart: p.week_start_date,
      weekEnd: p.week_end_date,
    })));
    setShowLoad(true);
  }

  // Load a saved plan: navigate to its week (which reloads plan + is_saved).
  function handleLoadPlan(weekStartKey: string) {
    setShowLoad(false);
    setWeekStart(weekStartKey);
    setSelectedDay("Monday");
    showToast(t.toastPlanLoaded);
  }

  // Duplicate the current week's plan into the NEXT EMPTY week (going forward).
  // Uses load-or-create so it never violates the unique (user, week) index.
  async function handleDuplicateWeek() {
    if (!weekHasMeals) { showToast(t.toastWeekEmpty); return; }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Look ahead up to 52 weeks for the first week with no planned meals.
    let cursor = shiftWeek(weekStart, 1);
    let targetStart: string | null = null;
    for (let i = 0; i < 52; i++) {
      const end = weekEnd(cursor);
      const { data: existing } = await supabase
        .from("meal_plans")
        .select("id, plan_data")
        .eq("user_id", user.id)
        .eq("week_start_date", cursor)
        .eq("week_end_date", end)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const occupied =
        existing?.plan_data &&
        DAYS.some((d) => MEALS.some((m) => readSlot((existing.plan_data as MealPlan)[d]?.[m]) !== null));

      if (!occupied) { targetStart = cursor; break; }
      cursor = shiftWeek(cursor, 1);
    }

    if (!targetStart) { showToast(t.toastNoEmptyWeek); return; }

    const targetEnd = weekEnd(targetStart);
    // Write the copied plan into the target week as a DRAFT (is_saved = false).
    const { data: existingTarget } = await supabase
      .from("meal_plans")
      .select("id")
      .eq("user_id", user.id)
      .eq("week_start_date", targetStart)
      .eq("week_end_date", targetEnd)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingTarget?.id) {
      await supabase.from("meal_plans").update({ plan_data: plan as any }).eq("id", existingTarget.id);
    } else {
      await supabase.from("meal_plans").insert({
        user_id: user.id,
        week_start_date: targetStart,
        week_end_date: targetEnd,
        plan_data: plan as any,
        is_saved: false,
      });
    }

    showToast(t.toastDuplicatedTo.replace("{range}", formatWeekRange(targetStart)));
    setWeekStart(targetStart); // jump to the new week so the user sees it
  }

  const totals = useMemo(() => dayTotals(plan, selectedDay, recipes), [plan, selectedDay, recipes]);

  // Weekly totals
  const weekTotals = useMemo(() => {
    return DAYS.reduce(
      (acc, day) => {
        const dt = dayTotals(plan, day, recipes);
        return { calories: acc.calories + dt.calories, protein: acc.protein + dt.protein, carbs: acc.carbs + dt.carbs, fat: acc.fat + dt.fat };
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [plan, recipes]);

  if (loading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {t.subtitle}
              {weekLoading && <span className="ml-2 text-xs text-zinc-400">{t.loadingWeek}</span>}
              {saving && <span className="ml-2 text-xs text-zinc-400">({dict.common.saving})</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowTemplates(true)}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
            >
              {t.templates}
            </button>
            <button
              type="button"
              onClick={handleOpenLoad}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
            >
              {t.loadPlan}
            </button>
            <button
              type="button"
              onClick={handleDuplicateWeek}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
            >
              {t.duplicateWeek}
            </button>
            <button
              type="button"
              onClick={handleSavePlan}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isSaved ? t.updatePlan : t.savePlan}
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            >
              {t.clearWeek}
            </button>
          </div>
        </div>

        {/* Week navigation — mirrors the Calendar's prev/next/today pattern */}
        <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={goPrevWeek}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
            aria-label={t.previousWeek}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>
            <span className="hidden sm:inline">{t.previousWeek}</span>
          </button>

          <div className="flex items-center gap-2 text-center">
            <span className="text-sm font-semibold text-zinc-900">{formatWeekRange(weekStart)}</span>
            {isSaved && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">{t.saved}</span>
            )}
            {isCurrentWeek ? (
              <span className="rounded-full bg-success-light px-2 py-0.5 text-xs font-medium text-success">{t.currentWeek}</span>
            ) : (
              <button
                type="button"
                onClick={goCurrentWeek}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" /></svg>
                {t.goToCurrentWeek}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={goNextWeek}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
            aria-label={t.nextWeek}
          >
            <span className="hidden sm:inline">{t.nextWeek}</span>
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
          </button>
        </div>

        {/* Weekly KPIs — shown above the grid for the whole selected week */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-zinc-900">{weekTotals.calories}</p>
            <p className="mt-0.5 text-xs font-medium text-zinc-400">{t.weeklyCalories}</p>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-blue-600">{weekTotals.protein}g</p>
            <p className="mt-0.5 text-xs font-medium text-zinc-400">{t.weeklyProtein}</p>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-amber-600">{weekTotals.carbs}g</p>
            <p className="mt-0.5 text-xs font-medium text-zinc-400">{t.weeklyCarbs}</p>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-2xl font-bold text-success">{weekTotals.fat}g</p>
            <p className="mt-0.5 text-xs font-medium text-zinc-400">{t.weeklyFat}</p>
          </div>
        </div>

        {/* ── MOBILE / TABLET: day-tab experience (unchanged) ── */}
        <div className="flex flex-col gap-6 lg:hidden">
        {/* Day tabs */}
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          {DAYS.map((day) => (
            <button
              key={day}
              type="button"
              onClick={() => setSelectedDay(day)}
              className={[
                "inline-flex min-h-[44px] shrink-0 items-center rounded-md px-4 py-1.5 text-xs font-semibold transition-colors lg:min-h-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300",
                selectedDay === day
                  ? "bg-primary text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900",
              ].join(" ")}
            >
              {weekdayAbbrev(day, cal)}
            </button>
          ))}
        </div>

        {/* Selected day header + "···" day actions (Copy / Paste / Clear) */}
        <div className="relative flex items-center justify-between">
          <span className="text-sm font-semibold text-zinc-800">{fullWeekdayLabel(selectedDay, t)}</span>
          <button
            type="button"
            onClick={() => setOpenDayMenu((d) => (d === selectedDay ? null : selectedDay))}
            aria-label={`${selectedDay} options`}
            aria-haspopup="menu"
            aria-expanded={openDayMenu === selectedDay}
            className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M10 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM11.5 15.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" /></svg>
          </button>
          {openDayMenu === selectedDay && (
            <DayMenu
              day={selectedDay}
              t={t}
              canCopyOrClear={selectedDayHasMeals}
              canPaste={clipboardDay !== null}
              onCopy={() => { copyDay(); setOpenDayMenu(null); }}
              onPaste={() => { pasteDay(); setOpenDayMenu(null); }}
              onClear={() => { clearDay(); setOpenDayMenu(null); }}
              onClose={() => setOpenDayMenu(null)}
            />
          )}
        </div>

        {/* Day totals */}
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-lg font-bold text-zinc-900">{totals.calories}</p>
            <p className="text-xs text-zinc-400">{nt.calories}</p>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-lg font-bold text-blue-600">{totals.protein}g</p>
            <p className="text-xs text-zinc-400">{nt.protein}</p>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-lg font-bold text-amber-600">{totals.carbs}g</p>
            <p className="text-xs text-zinc-400">{nt.carbs}</p>
          </div>
          <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-lg font-bold text-success">{totals.fat}g</p>
            <p className="text-xs text-zinc-400">{nt.fat}</p>
          </div>
        </div>

        {/* Meal slots */}
        {recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white py-16">
            <p className="mb-1 text-base font-semibold text-zinc-900">{t.noRecipesTitle}</p>
            <p className="text-sm text-zinc-500">{t.noRecipesDescription}</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {MEALS.map((meal) => {
              const slotData = getSlot(plan[selectedDay][meal], recipes);
              const selected = slotData?.recipe;
              const selectedServings = slotData?.servings ?? 1;
              return (
                <div key={meal} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <p className={`text-sm font-semibold ${MEAL_META[meal].accent}`}>
                      {slotLabel(meal, t)}
                    </p>
                    {selected && (
                      <button
                        type="button"
                        onClick={() => handleClear(meal)}
                        className="-mr-2 inline-flex min-h-[44px] items-center rounded-md px-2 text-xs font-medium text-zinc-400 transition-colors hover:text-red-600 lg:min-h-0"
                      >
                        {t.slotRemove}
                      </button>
                    )}
                  </div>

                  {selected ? (
                    <div className="flex gap-3 rounded-lg bg-zinc-50 p-2">
                      <MealThumb imageUrl={selected.imageUrl} name={selected.name} className="h-16 w-16 shrink-0 rounded-lg" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-900">
                          {selected.name}{selectedServings > 1 ? ` ×${selectedServings}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {selected.calories * selectedServings} kcal
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {selected.protein * selectedServings}g Prot. · {selected.carbs * selectedServings}g Carb. · {selected.fat * selectedServings}g Fat
                        </p>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPickerTarget({ day: selectedDay, meal })}
                      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-sm font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z" /></svg>
                      {t.addRecipe}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
        {/* ── /MOBILE ── */}

        {/* ── DESKTOP: full 7-day week grid (all days + 4 slots + day totals) ── */}
        {recipes.length === 0 ? (
          <div className="hidden lg:flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white py-16">
            <p className="mb-1 text-base font-semibold text-zinc-900">{t.noRecipesTitle}</p>
            <p className="text-sm text-zinc-500">{t.noRecipesDescription}</p>
          </div>
        ) : (
          <div className="hidden lg:block overflow-x-auto">
            <div className="min-w-[880px]">
              {/* Header row: soft day labels + per-day tools (menu board, not a calendar bar) */}
              <div className="grid grid-cols-[104px_repeat(7,1fr)] gap-2">
                <div />
                {DAYS.map((day) => (
                  <div key={day} className="relative flex items-center justify-between px-1 pb-1">
                    <span className="text-sm font-bold tracking-tight text-zinc-800">{weekdayAbbrev(day, cal)}</span>
                    <button
                      type="button"
                      onClick={() => setOpenDayMenu((d) => (d === day ? null : day))}
                      aria-label={`${day} options`}
                      aria-haspopup="menu"
                      aria-expanded={openDayMenu === day}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M10 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM11.5 15.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" /></svg>
                    </button>
                    {openDayMenu === day && (
                      <DayMenu
                        day={day}
                        t={t}
                        canCopyOrClear={dayHasMeals(day)}
                        canPaste={clipboardDay !== null}
                        onCopy={() => { copyDayOf(day); setOpenDayMenu(null); }}
                        onPaste={() => { pasteDayInto(day); setOpenDayMenu(null); }}
                        onClear={() => { clearDayOf(day); setOpenDayMenu(null); }}
                        onClose={() => setOpenDayMenu(null)}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* One row per meal slot — each slot has its own identity (icon + tint) */}
              {MEALS.map((meal) => {
                const m = MEAL_META[meal];
                return (
                <div key={meal} className="mt-2 grid grid-cols-[104px_repeat(7,1fr)] gap-2">
                  <div className={`flex items-center rounded-xl ${m.tint} px-3`}>
                    <span className={`text-sm font-semibold ${m.accent}`}>{slotLabel(meal, t)}</span>
                  </div>
                  {DAYS.map((day) => {
                    const slotData = getSlot(plan[day][meal], recipes);
                    const selected = slotData?.recipe;
                    const servings = slotData?.servings ?? 1;
                    const isDropTarget = dragOver?.day === day && dragOver?.meal === meal;
                    const isDragging = dragFrom?.day === day && dragFrom?.meal === meal;
                    // Shared drop-target props (both filled cards and empty tiles accept a drop).
                    const dropProps = {
                      onDragOver: (e: React.DragEvent) => { if (dragFrom) { e.preventDefault(); setDragOver({ day, meal }); } },
                      onDragLeave: () => { setDragOver((d) => (d?.day === day && d?.meal === meal ? null : d)); },
                      onDrop: (e: React.DragEvent) => {
                        e.preventDefault();
                        if (dragFrom) moveSlot(dragFrom, { day, meal });
                        setDragFrom(null);
                        setDragOver(null);
                      },
                    };
                    return selected ? (
                      // Filled slot = a draggable menu card with the recipe photo
                      <div
                        key={`${day}-${meal}`}
                        draggable
                        onDragStart={() => setDragFrom({ day, meal })}
                        onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                        {...dropProps}
                        title="Drag to move to another slot"
                        className={[
                          "group relative cursor-grab overflow-hidden rounded-xl border bg-white shadow-sm transition-all active:cursor-grabbing",
                          isDragging ? "opacity-40" : "hover:shadow-md",
                          isDropTarget ? "border-primary ring-2 ring-primary/20" : "border-zinc-200",
                        ].join(" ")}
                      >
                        <div className="relative h-16 w-full">
                          <MealThumb imageUrl={selected.imageUrl} name={selected.name} className="h-16 w-full" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                          <p className="absolute inset-x-1.5 bottom-1 line-clamp-2 text-[11px] font-semibold leading-tight text-white drop-shadow">
                            {selected.name}{servings > 1 ? ` ×${servings}` : ""}
                          </p>
                          <button
                            type="button"
                            onClick={() => clearSlotFor(day, meal)}
                            aria-label={`Remove ${selected.name} from ${day} ${meal}`}
                            title={t.slotRemove}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100"
                          >
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
                          </button>
                        </div>
                        <p className="px-1.5 py-1 text-[10px] font-medium text-zinc-400">{selected.calories * servings} kcal</p>
                      </div>
                    ) : (
                      <button
                        key={`${day}-${meal}`}
                        type="button"
                        onClick={() => setPickerTarget({ day, meal })}
                        {...dropProps}
                        aria-label={`Add recipe for ${day} ${meal}`}
                        className={[
                          "flex min-h-[92px] w-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs font-medium transition-colors",
                          isDropTarget ? "border-primary bg-zinc-50 text-zinc-700" : "border-zinc-200 text-zinc-400 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-600",
                        ].join(" ")}
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z" /></svg>
                        {t.add}
                      </button>
                    );
                  })}
                </div>
                );
              })}

              {/* Per-day totals — visually tied to the grid (shared divider,
                  card-consistent cells, clearer hierarchy) */}
              <div className="mt-3 border-t border-zinc-200 pt-3">
                <div className="grid grid-cols-[104px_repeat(7,1fr)] gap-2">
                  <div className="flex items-center pl-3">
                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{t.dayTotal}</span>
                  </div>
                  {DAYS.map((day) => {
                    const dt = dayTotals(plan, day, recipes);
                    return (
                      <div key={`${day}-totals`} className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-2 py-2 text-center">
                        <p className="text-sm font-bold text-zinc-900">
                          {dt.calories}<span className="text-xs font-medium text-zinc-400"> kcal</span>
                        </p>
                        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[11px] font-medium">
                          <span className="text-blue-600">{dt.protein}g Prot.</span>
                          <span className="text-amber-600">{dt.carbs}g Carb.</span>
                          <span className="text-success">{dt.fat}g Fat</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Recipe picker (searchable, scales to a large library) */}
      {pickerTarget && (
        <RecipePicker
          recipes={recipes}
          day={pickerTarget.day}
          meal={pickerTarget.meal}
          t={t}
          nt={nt}
          onSelect={(recipeId) => {
            setSlotFor(pickerTarget.day, pickerTarget.meal, recipeId);
            setPickerTarget(null);
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}

      {/* Templates modal */}
      {showTemplates && (
        <TemplatesModal
          weekHasMeals={weekHasMeals}
          templates={templates}
          t={t}
          onApply={applyTemplate}
          onClose={() => setShowTemplates(false)}
        />
      )}

      {/* Load saved plans modal */}
      {showLoad && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Load a saved plan"
          onClick={() => setShowLoad(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            style={{ maxHeight: "80vh", overflowY: "auto" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">{t.savedPlans}</h2>
              <button type="button" onClick={() => setShowLoad(false)} aria-label={dict.common.close} className="text-zinc-400 hover:text-zinc-700">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
              </button>
            </div>
            {savedPlans.length === 0 ? (
              <p className="text-sm text-zinc-400">{t.noSavedPlans}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {savedPlans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleLoadPlan(p.weekStart)}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50"
                  >
                    <span className="text-sm font-medium text-zinc-900">{formatWeekRange(p.weekStart)}</span>
                    <span className="text-xs font-medium text-zinc-500">{t.load}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Per-day "···" menu (Copy / Paste / Clear) ────────────────────────────────

function DayMenu({
  day,
  t,
  canCopyOrClear,
  canPaste,
  onCopy,
  onPaste,
  onClear,
  onClose,
}: {
  day: Day;
  t: MealPlannerDict;
  canCopyOrClear: boolean;
  canPaste: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocClick); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={`${day} actions`}
      className="absolute right-0 top-8 z-30 w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg"
    >
      <button type="button" role="menuitem" onClick={onCopy} disabled={!canCopyOrClear} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400" aria-hidden="true"><path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h5A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 7 12.5v-9Z" /><path d="M5 6.5A1.5 1.5 0 0 0 3.5 8v8A1.5 1.5 0 0 0 5 17.5h5A1.5 1.5 0 0 0 11.5 16H8.5A2.5 2.5 0 0 1 6 13.5V6.5H5Z" /></svg>
        {t.copyDay}
      </button>
      <button type="button" role="menuitem" onClick={onPaste} disabled={!canPaste} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-success" aria-hidden="true"><path d="M8 2a2 2 0 0 0-1.94 1.5H5.5A1.5 1.5 0 0 0 4 5v11a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 16 16V5a1.5 1.5 0 0 0-1.5-1.5h-.56A2 2 0 0 0 12 2H8Zm0 1.5h4a.5.5 0 0 1 .5.5v.5h-5V4a.5.5 0 0 1 .5-.5Z" /></svg>
        {t.pasteDay}
      </button>
      <div className="my-1 h-px bg-zinc-100" />
      <button type="button" role="menuitem" onClick={onClear} disabled={!canCopyOrClear} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 disabled:opacity-40">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41 41 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5Z" clipRule="evenodd" /></svg>
        {t.clearDay}
      </button>
    </div>
  );
}

// ── Recipe picker modal (searchable — scales to a large recipe library) ──────

function RecipePicker({
  recipes,
  day,
  meal,
  t,
  nt,
  onSelect,
  onClose,
}: {
  recipes: RecipeSummary[];
  day: Day;
  meal: Meal;
  t: MealPlannerDict;
  nt: NutritionDict;
  onSelect: (recipeId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [goalFilter, setGoalFilter] = useState<"All" | string>("All");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const goals = useMemo(
    () => Array.from(new Set(recipes.map((r) => r.goal).filter(Boolean))),
    [recipes]
  );

  // Localize a goal value (data string) using the shared recipe goal labels.
  const goalDisplay = (g: string): string => {
    switch (g) {
      case "All":         return nt.recipes.goalAll;
      case "Fat Loss":    return nt.recipes.goalFatLoss;
      case "Muscle Gain": return nt.recipes.goalMuscleGain;
      case "Maintenance": return nt.recipes.goalMaintenance;
      default:            return g;
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      const matchesQuery = !q || r.name.toLowerCase().includes(q);
      const matchesGoal = goalFilter === "All" || r.goal === goalFilter;
      return matchesQuery && matchesGoal;
    });
  }, [recipes, query, goalFilter]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Choose a recipe for ${day} ${meal}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + search */}
        <div className="border-b border-zinc-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900">{t.pickerTitle}</h2>
              <p className="text-xs text-zinc-400">{fullWeekdayLabel(day, t)} · {slotLabel(meal, t)}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
            </button>
          </div>
          <div className="relative">
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" /></svg>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.pickerSearchPlaceholder}
              aria-label={t.pickerSearchPlaceholder}
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:h-10"
            />
          </div>
          {goals.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["All", ...goals] as const).map((g) => (
                <Chip key={g} active={goalFilter === g} onClick={() => setGoalFilter(g)}>
                  {goalDisplay(g)}
                </Chip>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-400">{t.pickerNoMatch.replace("{query}", query)}</p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(r.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-zinc-50"
                  >
                    <MealThumb imageUrl={r.imageUrl} name={r.name} className="h-11 w-11 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900">{r.name}</span>
                      <span className="block text-xs text-zinc-400">
                        {r.calories} kcal · {r.protein}g Prot. · {r.carbs}g Carb. · {r.fat}g Fat
                      </span>
                    </span>
                    {r.goal && (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">{goalDisplay(r.goal)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-zinc-100 px-4 py-2 text-center text-xs text-zinc-400">
          {t.pickerCountSummary.replace("{x}", String(filtered.length)).replace("{y}", String(recipes.length))}
        </div>
      </div>
    </div>
  );
}

// ── Templates modal ───────────────────────────────────────────────────────────

function TemplatesModal({
  weekHasMeals,
  templates,
  t,
  onApply,
  onClose,
}: {
  weekHasMeals: boolean;
  templates: PlanTemplate[];
  t: MealPlannerDict;
  onApply: (tpl: PlanTemplate) => void;
  onClose: () => void;
}) {
  // When the week already has meals, require an explicit confirm before a
  // template overwrites it (rule #5).
  const [pending, setPending] = useState<PlanTemplate | null>(null);

  function handlePick(tpl: PlanTemplate) {
    if (weekHasMeals) setPending(tpl);
    else onApply(tpl);
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Meal plan templates"
      onClick={onClose}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">{t.templatesTitle}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-zinc-400 hover:text-zinc-700">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" /></svg>
          </button>
        </div>

        {pending ? (
          // Confirmation step (week not empty)
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-700">
              {t.overwriteConfirm.replace("{name}", pending.name)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onApply(pending)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700"
              >
                {t.overwriteWeek}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {weekHasMeals && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                {t.weekHasMealsWarning}
              </p>
            )}
            {templates.map((tpl) => (
              <button
                key={tpl.name}
                type="button"
                onClick={() => handlePick(tpl)}
                className="flex flex-col items-start rounded-xl border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-400 hover:bg-zinc-50"
              >
                <p className="text-sm font-semibold text-zinc-900">{tpl.name}</p>
                <p className="mt-0.5 text-xs text-zinc-400">{tpl.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
