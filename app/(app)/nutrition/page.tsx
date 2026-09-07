"use client";

import { useState, useEffect, useCallback, useMemo, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type MealType = "Breakfast" | "Lunch" | "Dinner" | "Snack";

interface Meal {
  id: string;
  name: string;
  description: string;
  mealType: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  photoUrl: string | null;
}

interface NutritionEntry {
  date: string;
  meals: Meal[];
}

interface DailyNutritionSummary {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
}

interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MEAL_TYPES: MealType[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

const DEFAULT_TARGETS: NutritionTargets = { calories: 2200, protein: 150, carbs: 250, fat: 70 };

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTime(): string {
  return new Date().toTimeString().slice(0, 5);
}

function getDailySummary(meals: Meal[], date: string): DailyNutritionSummary {
  const dayMeals = meals.filter((m) => m.date === date);
  return {
    totalCalories: dayMeals.reduce((s, m) => s + m.calories, 0),
    totalProtein: dayMeals.reduce((s, m) => s + m.protein, 0),
    totalCarbs: dayMeals.reduce((s, m) => s + m.carbs, 0),
    totalFat: dayMeals.reduce((s, m) => s + m.fat, 0),
    mealCount: dayMeals.length,
  };
}

function getDateRange(filter: "today" | "week" | "month"): string[] {
  const dates: string[] = [];
  const now = new Date();
  const days = filter === "today" ? 1 : filter === "week" ? 7 : 30;
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div role="status" aria-live="polite" className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-border-brand bg-white px-5 py-3.5 shadow-lg">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-light">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-success" aria-hidden="true">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
        </svg>
      </span>
      <p className="text-sm font-medium text-zinc-800">{message}</p>
      <button type="button" onClick={onClose} aria-label="Dismiss" className="ml-1 text-zinc-400 hover:text-zinc-600 focus-visible:outline-none">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function MacroBar({ label, current, target, color, isCalories }: { label: string; current: number; target: number; color: string; isCalories?: boolean }) {
  const pct = Math.min((current / target) * 100, 100);
  const over = current > target;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-600">{label}</span>
        <span className={`text-xs font-semibold ${over ? "text-red-500" : "text-zinc-700"}`}>
          {current} / {target}{isCalories ? " kcal" : "g"}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-400" : ""}`}
          style={{ width: `${pct}%`, backgroundColor: over ? undefined : color }}
        />
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd, t }: { onAdd: () => void; t: ReturnType<typeof useDictionary>["dict"]["nutrition"] }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white py-20">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-zinc-400" aria-hidden="true">
          <path fillRule="evenodd" d="M9.965 3.038C7.67 3.28 5.64 4.533 4.25 6.492a8.014 8.014 0 0 0-1.223 6.584c.194.8.96 1.284 1.746 1.07A7.95 7.95 0 0 0 7 13.5c1.18 0 2.3.256 3.31.713C10.86 15.48 12.15 16 13.5 16c1.657 0 3-.828 3-2.5C16.5 7.649 13.576 2.664 9.965 3.038Z" clipRule="evenodd" />
        </svg>
      </div>
      <p className="mb-1 text-base font-semibold text-zinc-900">{t.emptyTitle}</p>
      <p className="mb-6 text-sm text-zinc-500">{t.emptyDescription}</p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        {t.emptyAction}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NutritionPage() {
  const { dict } = useDictionary();
  const t = dict.nutrition;
  const { success: showToast } = useToast();
  const [meals, setMeals] = useState<Meal[]>([]);
  const [targets, setTargets] = useState<NutritionTargets>(DEFAULT_TARGETS);
  const [hydrated, setHydrated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"today" | "week" | "month">("today");

  // Form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<MealType>("Breakfast");
  const [formCalories, setFormCalories] = useState("");
  const [formProtein, setFormProtein] = useState("");
  const [formCarbs, setFormCarbs] = useState("");
  const [formFat, setFormFat] = useState("");
  const [formDate, setFormDate] = useState(todayISO());
  const [formTime, setFormTime] = useState(nowTime());
  const [formPhoto, setFormPhoto] = useState<string | null>(null);

  const mealTypeLabel = (type: MealType): string => {
    switch (type) {
      case "Breakfast": return t.mealTypeBreakfast;
      case "Lunch": return t.mealTypeLunch;
      case "Dinner": return t.mealTypeDinner;
      case "Snack": return t.mealTypeSnack;
      default: return type;
    }
  };

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setHydrated(true); return; }

      // Load all meals
      const { data: mealData } = await supabase
        .from("meal_logs")
        .select("id, name, description, meal_type, calories, protein, carbs, fat, date, time, photo_url")
        .order("date", { ascending: false });

      if (mealData) {
        setMeals(mealData.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description || "",
          mealType: m.meal_type as MealType,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
          date: m.date,
          time: m.time || "",
          photoUrl: m.photo_url,
        })));
      }

      // Load targets from profile
      const { data: profile } = await supabase
        .from("users")
        .select("weight_kg, fitness_goal")
        .eq("id", user.id)
        .single();

      if (profile?.weight_kg) {
        const weight = Number(profile.weight_kg);
        const goal = profile.fitness_goal || "";
        let multiplier = 30;
        if (goal.toLowerCase().includes("lose") || goal.toLowerCase().includes("fat")) multiplier = 25;
        if (goal.toLowerCase().includes("muscle") || goal.toLowerCase().includes("build")) multiplier = 35;
        const cal = Math.round(weight * multiplier);
        const prot = Math.round(weight * 2);
        const fatG = Math.round((cal * 0.25) / 9);
        const carbsG = Math.round((cal - prot * 4 - fatG * 9) / 4);
        setTargets({ calories: cal, protein: Math.max(prot, 80), carbs: Math.max(carbsG, 100), fat: Math.max(fatG, 40) });
      }

      setHydrated(true);
    }
    loadData();
  }, []);

  // ── Form handlers ──────────────────────────────────────────────────────────

  function resetForm() {
    setFormName("");
    setFormDesc("");
    setFormType("Breakfast");
    setFormCalories("");
    setFormProtein("");
    setFormCarbs("");
    setFormFat("");
    setFormDate(todayISO());
    setFormTime(nowTime());
    setFormPhoto(null);
    setEditingId(null);
  }

  function openAddForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(meal: Meal) {
    setFormName(meal.name);
    setFormDesc(meal.description);
    setFormType(meal.mealType);
    setFormCalories(meal.calories.toString());
    setFormProtein(meal.protein.toString());
    setFormCarbs(meal.carbs.toString());
    setFormFat(meal.fat.toString());
    setFormDate(meal.date);
    setFormTime(meal.time);
    setFormPhoto(meal.photoUrl);
    setEditingId(meal.id);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!formName.trim()) return;

    const meal: Meal = {
      id: editingId || crypto.randomUUID(),
      name: formName.trim(),
      description: formDesc.trim(),
      mealType: formType,
      calories: parseInt(formCalories) || 0,
      protein: parseInt(formProtein) || 0,
      carbs: parseInt(formCarbs) || 0,
      fat: parseInt(formFat) || 0,
      date: formDate,
      time: formTime,
      photoUrl: formPhoto,
    };

    let updated: Meal[];
    if (editingId) {
      updated = meals.map((m) => (m.id === editingId ? meal : m));
      // Update in Supabase
      const supabase = createClient();
      await supabase.from("meal_logs").update({
        name: meal.name, description: meal.description || null, meal_type: meal.mealType,
        calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat,
        date: meal.date, time: meal.time || null, photo_url: meal.photoUrl,
      }).eq("id", editingId);
      showToast(t.toast.updated);
    } else {
      // Insert in Supabase
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: inserted } = await supabase.from("meal_logs").insert({
          user_id: user.id, name: meal.name, description: meal.description || null,
          meal_type: meal.mealType, calories: meal.calories, protein: meal.protein,
          carbs: meal.carbs, fat: meal.fat, date: meal.date, time: meal.time || null, photo_url: meal.photoUrl,
        }).select("id").single();
        if (inserted) meal.id = inserted.id;
      }
      updated = [meal, ...meals];
      showToast(t.toast.added);
    }

    setMeals(updated);
    setShowForm(false);
    resetForm();
  }

  function handleDelete(id: string) {
    const updated = meals.filter((m) => m.id !== id);
    setMeals(updated);
    const supabase = createClient();
    supabase.from("meal_logs").delete().eq("id", id);
    showToast(t.toast.deleted);
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFormPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  const today = todayISO();
  const todaySummary = useMemo(() => getDailySummary(meals, today), [meals, today]);
  const todayMeals = useMemo(() => meals.filter((m) => m.date === today).sort((a, b) => a.time.localeCompare(b.time)), [meals, today]);

  // History
  const historyDates = useMemo(() => getDateRange(historyFilter), [historyFilter]);
  const historyStats = useMemo(() => {
    const historyMeals = meals.filter((m) => historyDates.includes(m.date));
    const daysWithMeals = new Set(historyMeals.map((m) => m.date)).size || 1;
    const totalCal = historyMeals.reduce((s, m) => s + m.calories, 0);
    const totalPro = historyMeals.reduce((s, m) => s + m.protein, 0);
    const totalCarbs = historyMeals.reduce((s, m) => s + m.carbs, 0);
    const totalFat = historyMeals.reduce((s, m) => s + m.fat, 0);
    return {
      totalCalories: totalCal,
      avgCalories: Math.round(totalCal / daysWithMeals),
      avgProtein: Math.round(totalPro / daysWithMeals),
      avgCarbs: Math.round(totalCarbs / daysWithMeals),
      avgFat: Math.round(totalFat / daysWithMeals),
    };
  }, [meals, historyDates]);

  // Insights
  const insights = useMemo(() => {
    const msgs: string[] = [];
    if (todaySummary.totalProtein >= targets.protein) msgs.push(t.insight.proteinGoalReached);
    else if (todaySummary.totalProtein > 0 && todaySummary.totalProtein < targets.protein * 0.5) msgs.push(t.insight.proteinLow);
    if (todaySummary.totalCalories > 0 && todaySummary.totalCalories < targets.calories * 0.8) msgs.push(t.insight.belowCalorie);
    if (todaySummary.totalCalories > targets.calories) msgs.push(t.insight.exceededCalorie);
    if (todaySummary.totalFat > targets.fat) msgs.push(t.insight.exceededFat);
    if (todaySummary.totalCarbs >= targets.carbs) msgs.push(t.insight.carbsGoalReached);

    // Weekly consistency
    const weekDates = getDateRange("week");
    const daysLogged = new Set(meals.filter((m) => weekDates.includes(m.date)).map((m) => m.date)).size;
    if (daysLogged >= 5) msgs.push(t.insight.consistency.replace("{n}", String(daysLogged)));

    if (msgs.length === 0 && todaySummary.mealCount === 0) msgs.push(t.insight.noMeals);
    return msgs;
  }, [todaySummary, targets, meals, t]);

  if (!hydrated) return null;

  const hasMeals = meals.length > 0;

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
            <p className="mt-1 text-sm text-zinc-500">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {t.addMeal}
          </button>
        </div>

        {!hasMeals && !showForm ? (
          <EmptyState onAdd={openAddForm} t={t} />
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════════════════════
                1. DAILY NUTRITION DASHBOARD
            ═══════════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900">{t.todaysNutrition}</p>
                <span className="text-xs text-zinc-400">{today}</span>
              </div>

              {/* Summary cards */}
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-lg bg-zinc-50 p-3 text-center">
                  <p className="text-lg font-bold text-zinc-900">{todaySummary.totalCalories}</p>
                  <p className="text-xs text-zinc-400">{t.consumed}</p>
                </div>
                <div className="rounded-lg bg-zinc-50 p-3 text-center">
                  <p className="text-lg font-bold text-success">{Math.max(0, targets.calories - todaySummary.totalCalories)}</p>
                  <p className="text-xs text-zinc-400">{t.remaining}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <p className="text-lg font-bold text-blue-600">{todaySummary.totalProtein}g</p>
                  <p className="text-xs text-zinc-400">{t.protein}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-center">
                  <p className="text-lg font-bold text-amber-600">{todaySummary.totalCarbs}g</p>
                  <p className="text-xs text-zinc-400">{t.carbs}</p>
                </div>
                <div className="rounded-lg bg-success-light p-3 text-center">
                  <p className="text-lg font-bold text-success">{todaySummary.totalFat}g</p>
                  <p className="text-xs text-zinc-400">{t.fat}</p>
                </div>
              </div>

              {/* Progress bars */}
              <div className="flex flex-col gap-3">
                <MacroBar label={t.calories} isCalories current={todaySummary.totalCalories} target={targets.calories} color="#18181b" />
                <MacroBar label={t.protein} current={todaySummary.totalProtein} target={targets.protein} color="#2563eb" />
                <MacroBar label={t.carbs} current={todaySummary.totalCarbs} target={targets.carbs} color="#d97706" />
                <MacroBar label={t.fat} current={todaySummary.totalFat} target={targets.fat} color="#059669" />
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                4. DAILY MEAL TIMELINE
            ═══════════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="mb-4 text-sm font-semibold text-zinc-900">{t.todaysMeals}</p>
              {todayMeals.length === 0 ? (
                <p className="text-sm text-zinc-400">{t.noMealsToday}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {MEAL_TYPES.map((type) => {
                    const typeMeals = todayMeals.filter((m) => m.mealType === type);
                    if (typeMeals.length === 0) return null;
                    return (
                      <div key={type}>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-400">{mealTypeLabel(type)}</p>
                        <div className="flex flex-col gap-2">
                          {typeMeals.map((meal) => (
                            <div key={meal.id} className="flex items-center gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                              {/* Photo thumbnail */}
                              {meal.photoUrl ? (
                                <img src={meal.photoUrl} alt={meal.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                              ) : (
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-200">
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400" aria-hidden="true">
                                    <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 0 0-1.06 0L2.5 11.06Zm12.22-4.81a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" clipRule="evenodd" />
                                  </svg>
                                </div>
                              )}
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-zinc-900 truncate">{meal.name}</p>
                                <p className="text-xs text-zinc-400">
                                  {meal.calories} kcal &middot; P {meal.protein}g &middot; C {meal.carbs}g &middot; F {meal.fat}g
                                </p>
                              </div>
                              {/* Time */}
                              <span className="shrink-0 text-xs text-zinc-400">{meal.time}</span>
                              {/* Actions */}
                              <div className="flex shrink-0 gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEditForm(meal)}
                                  aria-label={`Edit ${meal.name}`}
                                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-700 focus-visible:outline-none lg:min-h-0 lg:min-w-0"
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                                    <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                                    <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(meal.id)}
                                  aria-label={`Delete ${meal.name}`}
                                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none lg:min-h-0 lg:min-w-0"
                                >
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════
                6. NUTRITION INSIGHTS
            ═══════════════════════════════════════════════════════════════════ */}
            {insights.length > 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
                <p className="mb-3 text-sm font-semibold text-zinc-900">{t.insights}</p>
                <div className="flex flex-col gap-2">
                  {insights.map((msg, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg bg-zinc-50 p-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3 text-blue-600" aria-hidden="true">
                          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                        </svg>
                      </span>
                      <p className="text-sm text-zinc-700">{msg}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════
                5. NUTRITION HISTORY
            ═══════════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900">{t.historyTitle}</p>
                <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
                  {([["today", dict.common.filterToday], ["week", dict.common.filterThisWeek], ["month", dict.common.filterThisMonth]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setHistoryFilter(key)}
                      className={[
                        "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300",
                        historyFilter === key ? "bg-primary text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-lg bg-zinc-50 p-3 text-center">
                  <p className="text-lg font-bold text-zinc-900">{historyStats.totalCalories}</p>
                  <p className="text-xs text-zinc-400">{t.totalCalories}</p>
                </div>
                <div className="rounded-lg bg-zinc-50 p-3 text-center">
                  <p className="text-lg font-bold text-zinc-900">{historyStats.avgCalories}</p>
                  <p className="text-xs text-zinc-400">{t.avgCaloriesDay}</p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <p className="text-lg font-bold text-blue-600">{historyStats.avgProtein}g</p>
                  <p className="text-xs text-zinc-400">{t.avgProtein}</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-center">
                  <p className="text-lg font-bold text-amber-600">{historyStats.avgCarbs}g</p>
                  <p className="text-xs text-zinc-400">{t.avgCarbs}</p>
                </div>
                <div className="rounded-lg bg-success-light p-3 text-center">
                  <p className="text-lg font-bold text-success">{historyStats.avgFat}g</p>
                  <p className="text-xs text-zinc-400">{t.avgFat}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          2 & 3. ADD/EDIT MEAL MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900">{editingId ? t.form.editTitle : t.form.addTitle}</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                aria-label={dict.common.close}
                className="rounded-lg p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Meal Type */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mealType" className="text-sm font-medium text-zinc-700">{t.form.mealType}</label>
                <select
                  id="mealType"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as MealType)}
                  className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm sm:h-10 text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                >
                  {MEAL_TYPES.map((mt) => <option key={mt} value={mt}>{mealTypeLabel(mt)}</option>)}
                </select>
              </div>

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mealName" className="text-sm font-medium text-zinc-700">{t.form.mealName}</label>
                <input
                  id="mealName"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={t.form.mealNamePlaceholder}
                  required
                  className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm sm:h-10 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mealDesc" className="text-sm font-medium text-zinc-700">{t.form.description}</label>
                <input
                  id="mealDesc"
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder={t.form.descriptionPlaceholder}
                  className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm sm:h-10 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              {/* Macros grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mealCal" className="text-sm font-medium text-zinc-700">{t.form.calories}</label>
                  <input id="mealCal" type="number" min={0} max={5000} value={formCalories} onChange={(e) => setFormCalories(e.target.value)} placeholder="0" className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm sm:h-10 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mealPro" className="text-sm font-medium text-zinc-700">{t.form.proteinG}</label>
                  <input id="mealPro" type="number" min={0} max={500} value={formProtein} onChange={(e) => setFormProtein(e.target.value)} placeholder="0" className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm sm:h-10 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mealCarbs" className="text-sm font-medium text-zinc-700">{t.form.carbsG}</label>
                  <input id="mealCarbs" type="number" min={0} max={500} value={formCarbs} onChange={(e) => setFormCarbs(e.target.value)} placeholder="0" className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm sm:h-10 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mealFat" className="text-sm font-medium text-zinc-700">{t.form.fatG}</label>
                  <input id="mealFat" type="number" min={0} max={500} value={formFat} onChange={(e) => setFormFat(e.target.value)} placeholder="0" className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm sm:h-10 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
                </div>
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mealDate" className="text-sm font-medium text-zinc-700">{t.form.date}</label>
                  <input id="mealDate" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm sm:h-10 text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mealTime" className="text-sm font-medium text-zinc-700">{t.form.time}</label>
                  <input id="mealTime" type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)} className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm sm:h-10 text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200" />
                </div>
              </div>

              {/* Photo upload */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="mealPhoto" className="text-sm font-medium text-zinc-700">{t.form.mealPhoto}</label>
                <div className="flex items-center gap-3">
                  {formPhoto ? (
                    <img src={formPhoto} alt={t.form.mealPhoto} className="h-16 w-16 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-zinc-200 bg-zinc-50">
                      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-zinc-300" aria-hidden="true">
                        <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 0 0-1.06 0L2.5 11.06Zm12.22-4.81a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="mealPhoto"
                      className="cursor-pointer rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                      {formPhoto ? t.form.changePhoto : t.form.uploadPhoto}
                    </label>
                    <input id="mealPhoto" type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                    {formPhoto && (
                      <button type="button" onClick={() => setFormPhoto(null)} className="text-left text-xs text-red-500 hover:text-red-700">
                        {dict.common.remove}
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-zinc-400">{t.form.aiHint}</p>
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:ring-offset-2"
                >
                  {dict.common.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {editingId ? t.form.updateMeal : t.form.addMeal}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
    </>
  );
}
