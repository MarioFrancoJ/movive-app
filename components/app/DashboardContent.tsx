"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// Dictionary slice for the dashboard home view.
type HomeDict = ReturnType<typeof useDictionary>["dict"]["dashboard"]["home"];

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserProfile {
  name: string;
  fitnessGoal: string;
}
interface QuickStats {
  lastWeight: number | null;
  caloriesToday: number;
  proteinToday: number;
  workoutsThisWeek: number;
}
interface TodayFocus {
  hasWorkout: boolean;
  workoutName: string | null;
  exerciseCount: number;
  workoutId: string | null;
  exerciseNames: string[];
}
interface WeeklyProgress {
  workoutsCompleted: number;
  workoutsGoal: number;
  avgCalories: number;
  caloriesTarget: number;
  weightChange: number | null;
  dailyWorkouts: boolean[]; // 7 days, true = completed
}
interface ActivityItem {
  id: string;
  type: "workout" | "meal" | "weight";
  title: string;
  timestamp: string;
}
interface NextMeal {
  name: string;
  calories: number | null;
  time: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(t: HomeDict): string {
  const hour = new Date().getHours();
  if (hour < 12) return t.goodMorning;
  if (hour < 17) return t.goodAfternoon;
  return t.goodEvening;
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function timeAgo(iso: string, t: HomeDict): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t.justNow;
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return t.yesterday;
  return `${days}d ago`;
}

function getDayLabels(t: HomeDict): string[] {
  return [t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat, t.daySun];
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Daily Habits config ─────────────────────────────────────────────────────

const WATER_GOAL_ML = 3000;
const WATER_QUICK_ADD = [100, 250, 500, 1000]; // ml

// Default supplement catalog. Adding a supplement here requires no migration —
// supplement_logs.taken is a JSONB array of names.
const DEFAULT_SUPPLEMENTS = [
  "Creatine",
  "Whey Protein",
  "Collagen",
  "Biotin",
  "Multivitamin",
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardContent() {
  const { dict } = useDictionary();
  const t = dict.dashboard.home;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [focus, setFocus] = useState<TodayFocus | null>(null);
  const [weekly, setWeekly] = useState<WeeklyProgress | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [nextMeal, setNextMeal] = useState<NextMeal | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const now = new Date();
      // Get Monday of the current week
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);
      const weekStart = monday.toISOString().slice(0, 10);

      // ── Parallel fetch ────────────────────────────────────────────────────
      // All dashboard queries depend only on `user.id` + computed dates — none
      // depends on another query's result — so they run concurrently in a
      // single round-trip batch instead of a sequential waterfall. The full
      // weight_entries history is fetched ONCE here and reused for the latest
      // weight, the recent weight-change delta, and the "added weight" activity
      // (previously three separate identical queries).
      // NOTE: We intentionally do NOT filter by `is_sandbox` in the query.
      // Write paths (weight tracker, meal log, workout start) don't always set
      // that column, and it may be absent/NULL depending on migration state.
      // A hard `.eq("is_sandbox", false)` would then exclude real user rows and
      // leave KPIs empty. Instead we select the flag and drop rows only when it
      // is explicitly `true`, so sandbox isolation still works when present.
      const [
        profileRes,
        weightRes,
        mealsTodayRes,
        weekSessionRes,
        nextWorkoutRes,
        weekMealRes,
        planRes,
        recentSessionRes,
        recentMealRes,
      ] = await Promise.all([
        supabase.from("users").select("name, fitness_goal").eq("id", user.id).single(),
        supabase.from("weight_entries").select("id, weight_kg, created_at, is_sandbox").eq("user_id", user.id).order("date", { ascending: false }),
        supabase.from("meal_logs").select("calories, protein, is_sandbox").eq("date", today),
        supabase.from("training_sessions").select("id, date, status, is_sandbox").eq("user_id", user.id).eq("status", "Completed").gte("date", weekStart),
        supabase.from("workouts").select("id, name, workout_days(workout_exercises(id, exercise_name, sort_order))").eq("user_id", user.id).eq("is_template", false).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("meal_logs").select("calories, date, is_sandbox").gte("date", weekStart),
        supabase.from("meal_plans").select("plan_data").eq("user_id", user.id).gte("week_end_date", today).lte("week_start_date", today).limit(1).maybeSingle(),
        supabase.from("training_sessions").select("id, workout_name, start_time, status, is_sandbox").eq("user_id", user.id).eq("status", "Completed").order("start_time", { ascending: false }).limit(10),
        supabase.from("meal_logs").select("id, name, created_at").order("created_at", { ascending: false }).limit(3),
      ]);

      const profileData = profileRes.data;
      if (profileData)
        setProfile({
          name: profileData.name || "User",
          fitnessGoal: profileData.fitness_goal || "",
        });

      // Full (non-sandbox) weight history — reused across the dashboard.
      const weightHistory = (weightRes.data ?? []).filter((r) => r.is_sandbox !== true);
      const weightData = weightHistory[0] ?? null;

      const mealsToday = (mealsTodayRes.data ?? []).filter((m) => m.is_sandbox !== true);

      const weekSessions = (weekSessionRes.data ?? []).filter((s) => s.is_sandbox !== true);

      setStats({
        lastWeight: weightData?.weight_kg ?? null,
        caloriesToday:
          mealsToday.reduce((s, m) => s + m.calories, 0) ?? 0,
        proteinToday:
          mealsToday.reduce((s, m) => s + m.protein, 0) ?? 0,
        workoutsThisWeek: weekSessions.length,
      });

      // Build daily workout completion map for the week (Mon–Sun)
      const dailyWorkouts: boolean[] = Array(7).fill(false);
      for (const s of weekSessions) {
        const sessionDate = new Date(s.date);
        const diff = Math.floor(
          (sessionDate.getTime() - monday.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (diff >= 0 && diff < 7) dailyWorkouts[diff] = true;
      }

      const nextWorkout = nextWorkoutRes.data;
      if (nextWorkout) {
        const allExercises: { exercise_name: string; sort_order: number }[] = [];
        for (const day of (nextWorkout.workout_days || [])) {
          for (const ex of (day.workout_exercises || [])) {
            allExercises.push(ex);
          }
        }
        allExercises.sort((a, b) => a.sort_order - b.sort_order);
        setFocus({
          hasWorkout: true,
          workoutName: nextWorkout.name,
          exerciseCount: allExercises.length,
          workoutId: nextWorkout.id,
          exerciseNames: allExercises.slice(0, 3).map((e) => e.exercise_name),
        });
      } else {
        setFocus({
          hasWorkout: false,
          workoutName: null,
          exerciseCount: 0,
          workoutId: null,
          exerciseNames: [],
        });
      }

      const weekMeals = (weekMealRes.data ?? []).filter((m) => m.is_sandbox !== true);
      const daysWithMeals =
        new Set(weekMeals.map((m) => m.date)).size || 1;
      const totalWeekCals =
        weekMeals.reduce((s, m) => s + m.calories, 0) ?? 0;
      // Reuse the already-fetched weight history (no extra query).
      const recentWeights = weightHistory.slice(0, 2);
      let weightChange: number | null = null;
      if (recentWeights.length >= 2)
        weightChange =
          Math.round(
            (recentWeights[0].weight_kg - recentWeights[1].weight_kg) * 10
          ) / 10;
      setWeekly({
        workoutsCompleted: weekSessions.length,
        workoutsGoal: 4,
        avgCalories: Math.round(totalWeekCals / daysWithMeals),
        caloriesTarget: 2200,
        weightChange,
        dailyWorkouts,
      });

      // Next meal from meal plans (already fetched above).
      const planData = planRes.data;
      if (planData?.plan_data) {
        const plan = planData.plan_data as any;
        const todayName = now
          .toLocaleDateString("en-US", { weekday: "long" })
          .toLowerCase();
        const todayPlan = plan[todayName] || plan.monday || null;
        if (todayPlan) {
          // Find next meal based on current hour
          const hour = now.getHours();
          let meal: any = null;
          if (hour < 10 && todayPlan.breakfast) meal = { ...todayPlan.breakfast, time: "Breakfast" };
          else if (hour < 14 && todayPlan.lunch) meal = { ...todayPlan.lunch, time: "Lunch" };
          else if (todayPlan.dinner) meal = { ...todayPlan.dinner, time: "Dinner" };
          else if (todayPlan.snack) meal = { ...todayPlan.snack, time: "Snack" };

          if (meal) {
            setNextMeal({
              name: meal.name || meal.recipe || "Planned meal",
              calories: meal.calories || null,
              time: meal.time || null,
            });
          }
        }
      }

      // Recent activity (all source rows already fetched above).
      const activities: ActivityItem[] = [];
      const recentSessions = (recentSessionRes.data ?? []).filter((s) => s.is_sandbox !== true).slice(0, 3);
      if (recentSessions)
        for (const s of recentSessions)
          activities.push({
            id: `s-${s.id}`,
            type: "workout",
            title: t.activityCompletedWorkout.replace(
              "{name}",
              s.workout_name || t.fallbackWorkout
            ),
            timestamp: s.start_time,
          });
      const recentMeals = recentMealRes.data;
      if (recentMeals)
        for (const m of recentMeals)
          activities.push({
            id: `m-${m.id}`,
            type: "meal",
            title: t.activityLoggedMeal.replace("{name}", m.name),
            timestamp: m.created_at,
          });
      // Reuse the weight history (already ordered by date desc) for the
      // "added weight" activity items — no extra query.
      const recentWeightEntries = weightHistory.slice(0, 2);
      if (recentWeightEntries)
        for (const w of recentWeightEntries)
          activities.push({
            id: `w-${w.id}`,
            type: "weight",
            title: t.activityAddedWeight,
            timestamp: w.created_at,
          });
      activities.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setActivity(activities.slice(0, 6));

      setLoading(false);
    }
    loadDashboard();
  }, [t]);

  if (loading) return <SkeletonDashboard />;

  return (
    <div className="flex flex-col gap-golden-5">
      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — HEADER
      ═══════════════════════════════════════════════════════════════════════ */}
      <header className="flex flex-col gap-golden-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-golden-lg font-bold tracking-tight text-zinc-900">
            {getGreeting(t)}, {(profile?.name || "User").split(" ")[0]}
          </h1>
          <div className="mt-golden-1 flex flex-wrap items-center gap-golden-2 text-golden-sm text-zinc-500">
            {profile?.fitnessGoal && (
              <span className="inline-flex items-center gap-golden-1 rounded-golden-md bg-zinc-100 px-golden-2 py-golden-1 text-golden-sm font-medium text-zinc-700">
                🎯 {profile.fitnessGoal}
              </span>
            )}
            <span>{formatDate()}</span>
          </div>
        </div>
        <div className="flex items-center gap-golden-2 sm:self-start">
          <QuickActionsMenu t={t} />
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — DAILY SUMMARY (compact metric strip)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-golden-3 sm:grid-cols-4">
        <KpiCard
          icon="⚖️"
          label={t.kpiWeight}
          value={stats?.lastWeight ? `${stats.lastWeight} kg` : "—"}
          sub={stats?.lastWeight ? t.kpiWeightLatest : t.kpiWeightEmpty}
          href="/progress/weight"
        />
        <KpiCard
          icon="🔥"
          label={t.kpiCaloriesToday}
          value={stats?.caloriesToday ? `${stats.caloriesToday.toLocaleString()} kcal` : "0 kcal"}
          sub={t.kpiLoggedToday}
          href="/nutrition"
        />
        <KpiCard
          icon="🥩"
          label={t.kpiProteinToday}
          value={stats?.proteinToday ? `${stats.proteinToday}g` : "0g"}
          sub={t.kpiLoggedToday}
          href="/nutrition"
        />
        <KpiCard
          icon="💪"
          label={t.kpiWorkoutsThisWeek}
          value={`${stats?.workoutsThisWeek ?? 0}`}
          sub={t.kpiCompletedSessions}
          href="/training/history"
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — MAIN AREA (two equal columns)
          Left: Today's Workout
          Right: This Week
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-golden-4 lg:grid-cols-2">
        {/* Today's Workout — light card */}
        <div className="rounded-golden-xl border border-zinc-200 bg-white p-golden-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-golden-xs font-bold uppercase tracking-widest text-zinc-400">
              {t.todaysWorkout}
            </p>
            {focus?.hasWorkout && (
              <Link
                href="/training/start"
                className="inline-flex items-center gap-golden-1 rounded-golden-md bg-primary px-golden-3 py-golden-1 text-golden-sm font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                {t.startWorkout}
              </Link>
            )}
          </div>

          {focus?.hasWorkout ? (
            <div className="mt-golden-3">
              <h3 className="text-golden-lg font-bold text-zinc-900">{focus.workoutName}</h3>

              {/* Compact indicators */}
              <div className="mt-golden-3 flex flex-wrap items-center gap-golden-3 text-golden-sm text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <span className="text-golden-base">💪</span>
                  {focus.exerciseCount} {focus.exerciseCount !== 1 ? t.exercisePlural : t.exerciseSingular}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="text-golden-base">⏱️</span>
                  ~{Math.max(focus.exerciseCount * 4, 15)} {t.unitMin}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="text-golden-base">📊</span>
                  {weekly?.workoutsCompleted ?? 0}/{weekly?.workoutsGoal ?? 4} {t.thisWeekSuffix}
                </span>
              </div>

              {/* Next up — exercise preview */}
              {focus.exerciseNames.length > 0 && (
                <div className="mt-golden-4">
                  <p className="mb-golden-2 text-golden-sm font-bold uppercase tracking-widest text-zinc-500">{t.nextUp}</p>
                  <div className="flex flex-col gap-golden-1">
                    {focus.exerciseNames.map((name, i) => (
                      <div key={i} className="flex items-center gap-golden-2 rounded-golden-md bg-zinc-50 px-golden-3 py-golden-2">
                        <span className="text-golden-sm font-semibold text-zinc-500">{i + 1}</span>
                        <span className="text-golden-sm font-medium text-zinc-700">{name}</span>
                      </div>
                    ))}
                    {focus.exerciseCount > 3 && (
                      <Link
                        href="/training/start"
                        className="mt-golden-1 inline-flex items-center gap-1 pl-golden-3 text-golden-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
                      >
                        {t.viewMoreExercises
                          .replace("{count}", String(focus.exerciseCount - 3))
                          .replace(
                            "{label}",
                            focus.exerciseCount - 3 !== 1 ? t.exercisePlural : t.exerciseSingular
                          )}
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Weekly goal bar */}
              <div className="mt-golden-4">
                <div className="mb-golden-1 flex items-center justify-between text-golden-sm text-zinc-600">
                  <span className="font-medium">{t.weeklyGoal}</span>
                  <span className="font-semibold text-zinc-900">{t.workoutsProgress
                    .replace("{completed}", String(weekly?.workoutsCompleted ?? 0))
                    .replace("{goal}", String(weekly?.workoutsGoal ?? 4))}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.min(((weekly?.workoutsCompleted ?? 0) / (weekly?.workoutsGoal ?? 4)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-golden-4 flex flex-col items-center justify-center py-golden-5">
              <p className="text-golden-base font-medium text-zinc-500">{t.noWorkoutPlanned}</p>
              <p className="mt-golden-1 text-golden-sm text-zinc-400">{t.createRoutineHint}</p>
              <Link
                href="/workouts/new"
                className="mt-golden-4 inline-flex items-center gap-golden-1 rounded-golden-md border border-zinc-200 px-golden-3 py-golden-2 text-golden-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                {t.createWorkout}
              </Link>
            </div>
          )}
        </div>

        {/* This Week — light card */}
        <div className="rounded-golden-xl border border-zinc-200 bg-white p-golden-4 shadow-sm">
          <div className="mb-golden-3 flex items-center justify-between">
            <h2 className="text-golden-xs font-bold uppercase tracking-widest text-zinc-400">{t.thisWeek}</h2>
          </div>

          {/* Workouts headline — prominent on light background */}
          <div className="mb-golden-4">
            <p className="text-golden-xl font-bold text-zinc-900">
              {weekly?.workoutsCompleted ?? 0}<span className="text-golden-lg font-medium text-zinc-400">/{weekly?.workoutsGoal ?? 4}</span>
            </p>
            <p className="text-golden-sm text-zinc-500">{t.workoutsCompleted}</p>
          </div>

          {/* Day dots visualization */}
          <div className="mb-golden-4 grid grid-cols-7 gap-golden-1">
            {getDayLabels(t).map((day, idx) => {
              const completed = weekly?.dailyWorkouts[idx] ?? false;
              const isToday = idx === ((new Date().getDay() + 6) % 7);
              return (
                <div key={day} className="flex flex-col items-center gap-golden-1">
                  <span
                    className={[
                      "text-golden-xs font-medium",
                      isToday ? "text-zinc-900" : "text-zinc-500",
                    ].join(" ")}
                  >
                    {day}
                  </span>
                  <div
                    className={[
                      "flex h-8 w-8 items-center justify-center rounded-full text-golden-xs font-bold transition-all",
                      completed
                        ? "bg-primary text-white"
                        : isToday
                        ? "ring-2 ring-primary text-primary-fg"
                        : "bg-zinc-100 text-zinc-400",
                    ].join(" ")}
                  >
                    {completed ? "✓" : ""}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress bars — secondary info */}
          <div className="space-y-golden-3">
            <ProgressRow
              label={t.progressWorkouts}
              current={weekly?.workoutsCompleted ?? 0}
              target={weekly?.workoutsGoal ?? 4}
              suffix={t.progressWorkoutsSuffix}
              color="bg-primary"
            />
            <ProgressRow
              label={t.progressCalories}
              current={weekly?.avgCalories ?? 0}
              target={weekly?.caloriesTarget ?? 2200}
              suffix={t.progressCaloriesSuffix}
              color="bg-zinc-300"
            />
            <div className="flex items-center justify-between rounded-golden-md bg-zinc-50 px-golden-3 py-golden-2">
              <span className="text-golden-sm font-medium text-zinc-600">{t.weightDelta}</span>
              {weekly?.weightChange !== null &&
              weekly?.weightChange !== undefined ? (
                <span
                  className={[
                    "text-golden-base font-bold",
                    weekly.weightChange < 0
                      ? "text-success"
                      : weekly.weightChange > 0
                      ? "text-red-500"
                      : "text-zinc-700",
                  ].join(" ")}
                >
                  {weekly.weightChange > 0 ? "+" : ""}
                  {weekly.weightChange} kg
                </span>
              ) : (
                <span className="text-golden-sm font-medium text-zinc-400">{t.noDataYet}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3.5 — DAILY HABITS (water, supplements, meals, workout)
      ═══════════════════════════════════════════════════════════════════════ */}
      <DailyHabits
        t={t}
        mealsLoggedToday={(stats?.caloriesToday ?? 0) > 0}
        caloriesToday={stats?.caloriesToday ?? 0}
        workoutDoneToday={weekly?.dailyWorkouts?.[(new Date().getDay() + 6) % 7] ?? false}
      />

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — BOTTOM AREA (Next Meal + Recent Activity)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid gap-golden-4 lg:grid-cols-2">
        {/* Next Meal */}
        <div className="rounded-golden-xl border border-zinc-200 bg-white p-golden-4 shadow-sm">
          <div className="mb-golden-3 flex items-center justify-between">
            <h2 className="text-golden-base font-bold text-zinc-900">{t.nextMeal}</h2>
            <Link
              href="/nutrition/meal-planner"
              className="text-golden-sm font-medium text-zinc-400 transition-colors hover:text-zinc-700"
            >
              {t.mealPlanLink}
            </Link>
          </div>
          {nextMeal ? (
            <div className="flex items-center gap-golden-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-golden-lg bg-amber-50 text-lg">
                🍽️
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-golden-base font-semibold text-zinc-900">
                  {nextMeal.name}
                </p>
                <div className="flex items-center gap-golden-2 text-golden-sm text-zinc-500">
                  {nextMeal.time && <span>{nextMeal.time}</span>}
                  {nextMeal.calories && (
                    <span className="text-zinc-400">
                      • {nextMeal.calories} kcal
                    </span>
                  )}
                </div>
              </div>
              <Link
                href="/nutrition"
                className="shrink-0 rounded-golden-md border border-zinc-200 px-golden-3 py-golden-1 text-golden-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                {t.log}
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-golden-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-golden-lg bg-zinc-100 text-lg">
                🍽️
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-golden-base text-zinc-500">{t.noMealPlanned}</p>
                <p className="text-golden-sm text-zinc-400">
                  {t.setupMealPlanHint}
                </p>
              </div>
              <Link
                href="/nutrition/meal-planner"
                className="shrink-0 rounded-golden-md border border-zinc-200 px-golden-3 py-golden-1 text-golden-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                {t.plan}
              </Link>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="rounded-golden-xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 px-golden-4 py-golden-3">
            <h2 className="text-golden-base font-bold text-zinc-900">{t.recentActivity}</h2>
            {activity.length > 0 && (
              <span className="text-golden-xs font-medium text-zinc-400">
                {activity.length} {t.entriesSuffix}
              </span>
            )}
          </div>
          {activity.length === 0 ? (
            <div className="px-golden-4 py-golden-4 text-center">
              <p className="text-golden-base text-zinc-400">
                {t.noActivityYet}
              </p>
              <p className="mt-golden-1 text-golden-sm text-zinc-300">
                {t.noActivityHint}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {activity.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-golden-3 px-golden-4 py-golden-2"
                >
                  <span
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-golden-sm",
                      item.type === "workout"
                        ? "bg-blue-50 text-blue-600"
                        : item.type === "meal"
                        ? "bg-amber-50 text-amber-600"
                        : "bg-success-light text-success",
                    ].join(" ")}
                  >
                    {item.type === "workout"
                      ? "💪"
                      : item.type === "meal"
                      ? "🥗"
                      : "⚖️"}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-golden-base text-zinc-700">
                    {item.title}
                  </p>
                  <span className="shrink-0 text-golden-xs text-zinc-400">
                    {timeAgo(item.timestamp, t)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// ── Daily Habits (water + supplements + meal/workout status) ──────────────────

function DailyHabits({
  t,
  mealsLoggedToday,
  caloriesToday,
  workoutDoneToday,
}: {
  t: HomeDict;
  mealsLoggedToday: boolean;
  caloriesToday: number;
  workoutDoneToday: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [intakeMl, setIntakeMl] = useState(0);
  const [goalMl, setGoalMl] = useState(WATER_GOAL_ML);
  const [takenSupps, setTakenSupps] = useState<string[]>([]);
  const [customMl, setCustomMl] = useState("");
  const [lastAddedMl, setLastAddedMl] = useState(0); // for "Undo" of the last water add
  const [editOpen, setEditOpen] = useState(false); // "Adjust total" modal
  const [editValue, setEditValue] = useState(""); // draft value inside the modal
  const [error, setError] = useState<string | null>(null);

  // Load today's water + supplement logs
  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const date = todayKey();

      const [waterRes, suppRes] = await Promise.all([
        supabase
          .from("water_logs")
          .select("intake_ml, goal_ml")
          .eq("user_id", user.id)
          .eq("date", date)
          .maybeSingle(),
        supabase
          .from("supplement_logs")
          .select("taken")
          .eq("user_id", user.id)
          .eq("date", date)
          .maybeSingle(),
      ]);

      // Surface load failures instead of silently showing empty state — this is
      // how a missing table/migration would otherwise masquerade as "no data".
      if (waterRes.error || suppRes.error) {
        setError(t.habitsLoadError);
      }

      if (waterRes.data) {
        setIntakeMl(waterRes.data.intake_ml ?? 0);
        setGoalMl(waterRes.data.goal_ml ?? WATER_GOAL_ML);
      }
      if (suppRes.data && Array.isArray(suppRes.data.taken)) {
        setTakenSupps(suppRes.data.taken as string[]);
      }
      setLoading(false);
    }
    load();
  }, [t]);

  // Persist water intake (upsert on user_id + date).
  // Returns true on success so the UI can roll back optimistic state on failure.
  const addWater = useCallback(async (ml: number) => {
    if (saving) return;
    const prev = intakeMl;
    const next = Math.max(0, intakeMl + ml);
    setIntakeMl(next); // optimistic
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIntakeMl(prev); setSaving(false); return; }
    const { error: upsertError } = await supabase
      .from("water_logs")
      .upsert(
        { user_id: user.id, date: todayKey(), intake_ml: next, goal_ml: goalMl },
        { onConflict: "user_id,date" }
      );
    if (upsertError) {
      // Roll back optimistic update so the UI never shows unsaved data as saved.
      setIntakeMl(prev);
      setError(t.waterSaveError.replace("{message}", upsertError.message));
    } else if (ml > 0) {
      // Remember the last added amount so it can be undone in one tap.
      setLastAddedMl(ml);
    }
    setSaving(false);
  }, [intakeMl, goalMl, saving, t]);

  // Undo the most recent water addition (removes exactly the last added amount).
  const undoLastWater = useCallback(() => {
    if (lastAddedMl <= 0) return;
    const amount = lastAddedMl;
    setLastAddedMl(0);
    void addWater(-amount);
  }, [lastAddedMl, addWater]);

  // Toggle a supplement (upsert the taken array)
  const toggleSupplement = useCallback(async (name: string) => {
    const prev = takenSupps;
    const next = takenSupps.includes(name)
      ? takenSupps.filter((s) => s !== name)
      : [...takenSupps, name];
    setTakenSupps(next); // optimistic
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setTakenSupps(prev); return; }
    const { error: upsertError } = await supabase
      .from("supplement_logs")
      .upsert(
        { user_id: user.id, date: todayKey(), taken: next },
        { onConflict: "user_id,date" }
      );
    if (upsertError) {
      setTakenSupps(prev);
      setError(t.supplementsSaveError.replace("{message}", upsertError.message));
    }
  }, [takenSupps, t]);

  // Add a custom water amount typed by the user (any positive number of ml).
  const submitCustomWater = useCallback(() => {
    const parsed = Number(customMl);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError(t.customWaterError);
      return;
    }
    setCustomMl("");
    void addWater(Math.round(parsed));
  }, [customMl, addWater, t]);

  // Open the "Adjust total" modal, pre-filling the draft with the current total.
  const openEditTotal = useCallback(() => {
    setEditValue(String(intakeMl));
    setEditOpen(true);
  }, [intakeMl]);

  // Set today's total directly. Reuses addWater via a delta (newTotal - current)
  // so persistence/optimistic logic is shared; addWater already clamps to >= 0.
  // No DB schema change — water_logs still stores a single daily total.
  const submitEditTotal = useCallback(() => {
    const parsed = Number(editValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(t.editTotalError);
      return;
    }
    const target = Math.round(parsed);
    const delta = target - intakeMl;
    setEditOpen(false);
    if (delta !== 0) void addWater(delta);
  }, [editValue, intakeMl, addWater, t]);

  const waterPct = Math.min(Math.round((intakeMl / goalMl) * 100), 100);
  const waterReached = intakeMl >= goalMl;
  const suppsDone = takenSupps.filter((s) => DEFAULT_SUPPLEMENTS.includes(s)).length;
  const suppsComplete = suppsDone >= DEFAULT_SUPPLEMENTS.length;

  return (
    <div className="rounded-golden-xl border border-zinc-200 bg-white p-golden-4 shadow-sm">
      <div className="mb-golden-3 flex items-center justify-between">
        <h2 className="text-golden-base font-bold text-zinc-900">{t.dailyHabits}</h2>
        <span className="text-golden-xs text-zinc-400">{t.resetsDaily}</span>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-golden-3 rounded-golden-md border border-red-200 bg-red-50 px-golden-3 py-golden-2 text-golden-sm font-medium text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-golden-4 lg:grid-cols-2">
        {/* Water tracking */}
        <div className="rounded-golden-lg border border-zinc-100 bg-zinc-50/50 p-golden-3">
          <div className="mb-golden-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-golden-1 text-golden-sm font-semibold text-zinc-700">
              💧 {t.water}
            </span>
            <span className="text-golden-sm font-semibold text-zinc-900">
              {(intakeMl / 1000).toFixed(2)}L <span className="font-medium text-zinc-400">/ {(goalMl / 1000).toFixed(1)}L</span>
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
            <div
              className={`h-full rounded-full transition-all duration-500 ${waterReached ? "bg-success" : "bg-blue-500"}`}
              style={{ width: `${waterPct}%` }}
            />
          </div>
          {/* Control group: quick adds, then a narrow custom input separated
              from its Add button. Flex-wrap keeps it responsive. */}
          <div className="mt-golden-3 flex flex-wrap items-center gap-golden-2">
            {WATER_QUICK_ADD.map((ml) => (
              <button
                key={ml}
                type="button"
                onClick={() => addWater(ml)}
                disabled={loading}
                className="rounded-golden-md border border-zinc-200 bg-white px-golden-3 py-golden-1 text-golden-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
              >
                +{ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`}
              </button>
            ))}
            {/* Custom water amount — narrow input, visually separated from the
                Add button (own borders + gap) so they don't read as one control. */}
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={50}
              value={customMl}
              onChange={(e) => setCustomMl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCustomWater();
                }
              }}
              disabled={loading || saving}
              placeholder={t.waterAmountPlaceholder}
              aria-label={t.waterAmountLabel}
              className="w-24 rounded-golden-md border border-zinc-200 bg-white px-golden-3 py-golden-1 text-golden-sm text-zinc-700 placeholder:text-zinc-400 transition-colors focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={submitCustomWater}
              disabled={loading || saving || customMl.trim() === ""}
              className="shrink-0 rounded-golden-md bg-blue-500 px-golden-3 py-golden-1 text-golden-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
            >
              {t.add}
            </button>
          </div>
          <div className="mt-golden-2 flex min-h-[1.25rem] items-center justify-between gap-golden-2">
            {waterReached ? (
              <p className="text-golden-xs font-medium text-success">{t.goalReached}</p>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-golden-3">
              {lastAddedMl > 0 && (
                <button
                  type="button"
                  onClick={undoLastWater}
                  disabled={loading || saving}
                  className="inline-flex items-center gap-golden-1 text-golden-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-50"
                  aria-label={t.undoLabel.replace("{amount}", lastAddedMl >= 1000 ? `${lastAddedMl / 1000}L` : `${lastAddedMl}ml`)}
                >
                  ↺ {t.undo.replace("{amount}", lastAddedMl >= 1000 ? `${lastAddedMl / 1000}L` : `${lastAddedMl}ml`)}
                </button>
              )}
              {/* Adjust total — opens a modal to set today's total directly */}
              <button
                type="button"
                onClick={openEditTotal}
                disabled={loading || saving}
                className="inline-flex items-center gap-golden-1 text-golden-xs font-medium text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-50"
              >
                ✎ {t.editTotal}
              </button>
            </div>
          </div>

          {/* Adjust-total modal — sets today's total directly (delta reuses
              addWater; no DB change; value is clamped to >= 0). */}
          {editOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-golden-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="water-edit-title"
              onClick={() => setEditOpen(false)}
            >
              <div
                className="w-full max-w-sm rounded-golden-xl border border-zinc-200 bg-white p-golden-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="water-edit-title" className="text-golden-base font-bold text-zinc-900">
                  {t.editTotalTitle}
                </h3>
                <p className="mt-golden-1 text-golden-xs text-zinc-500">{t.editTotalDescription}</p>

                <label htmlFor="water-edit-input" className="mt-golden-3 mb-golden-1 block text-golden-xs font-medium text-zinc-600">
                  {t.editTotalLabel}
                </label>
                <input
                  id="water-edit-input"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={50}
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); submitEditTotal(); }
                    if (e.key === "Escape") setEditOpen(false);
                  }}
                  className="w-full rounded-golden-md border border-zinc-200 bg-white px-golden-3 py-golden-2 text-golden-sm text-zinc-700 transition-colors focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                {Number.isFinite(Number(editValue)) && Number(editValue) >= 0 && (
                  <p className="mt-golden-1 text-golden-xs text-zinc-400">
                    {(Math.round(Number(editValue)) / 1000).toFixed(2)}L / {(goalMl / 1000).toFixed(1)}L
                  </p>
                )}

                <div className="mt-golden-4 flex justify-end gap-golden-2">
                  <button
                    type="button"
                    onClick={() => setEditOpen(false)}
                    className="rounded-golden-md border border-zinc-200 bg-white px-golden-3 py-golden-1 text-golden-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-50"
                  >
                    {t.editTotalCancel}
                  </button>
                  <button
                    type="button"
                    onClick={submitEditTotal}
                    disabled={saving}
                    className="rounded-golden-md bg-primary px-golden-3 py-golden-1 text-golden-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                  >
                    {t.editTotalSave}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Supplement tracking */}
        <div className="rounded-golden-lg border border-zinc-100 bg-zinc-50/50 p-golden-3">
          <div className="mb-golden-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-golden-1 text-golden-sm font-semibold text-zinc-700">
              💊 {t.supplements}
            </span>
            <span className={`text-golden-sm font-semibold ${suppsComplete ? "text-success" : "text-zinc-900"}`}>
              {t.supplementsTaken
                .replace("{done}", String(suppsDone))
                .replace("{total}", String(DEFAULT_SUPPLEMENTS.length))}
            </span>
          </div>
          <div className="flex flex-wrap gap-golden-2">
            {DEFAULT_SUPPLEMENTS.map((name) => {
              const taken = takenSupps.includes(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => toggleSupplement(name)}
                  disabled={loading}
                  aria-pressed={taken}
                  className={[
                    "inline-flex items-center gap-golden-1 rounded-golden-md border px-golden-3 py-golden-1 text-golden-sm font-medium transition-colors disabled:opacity-50",
                    taken
                      ? "border-border-brand bg-success-light text-success"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <span>{taken ? "✓" : "+"}</span>
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Today's status summary */}
      <div className="mt-golden-4 grid grid-cols-2 gap-golden-2 sm:grid-cols-4">
        <HabitStatus label={t.habitWater} done={waterReached} detail={`${(intakeMl / 1000).toFixed(1)}L`} />
        <HabitStatus label={t.habitSupplements} done={suppsComplete} detail={`${suppsDone}/${DEFAULT_SUPPLEMENTS.length}`} />
        <HabitStatus label={t.habitMeals} done={mealsLoggedToday} detail={mealsLoggedToday ? `${caloriesToday} kcal` : t.habitNone} />
        <HabitStatus label={t.habitWorkout} done={workoutDoneToday} detail={workoutDoneToday ? t.habitDone : t.habitPending} />
      </div>
    </div>
  );
}

function HabitStatus({ label, done, detail }: { label: string; done: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-golden-2 rounded-golden-md bg-zinc-50 px-golden-3 py-golden-2">
      <span
        className={[
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-golden-xs font-bold",
          done ? "bg-success text-white" : "bg-zinc-200 text-zinc-400",
        ].join(" ")}
      >
        {done ? "✓" : ""}
      </span>
      <div className="min-w-0">
        <p className="truncate text-golden-xs font-semibold text-zinc-700">{label}</p>
        <p className="truncate text-golden-xs text-zinc-400">{detail}</p>
      </div>
    </div>
  );
}

// ── Quick Actions Dropdown / Bottom Sheet ─────────────────────────────────────

function buildQuickActions(t: HomeDict) {
  return [
    { label: t.quickActionLogMeal, icon: "🥗", href: "/nutrition" },
    { label: t.quickActionLogWeight, icon: "⚖️", href: "/progress/weight" },
    { label: t.quickActionAddMeasurement, icon: "📏", href: "/progress/measurements" },
    { label: t.quickActionUploadPhoto, icon: "📸", href: "/progress/photos" },
    { label: t.quickActionStartWorkout, icon: "💪", href: "/training/start" },
    { label: t.quickActionCreateRecipe, icon: "🍳", href: "/nutrition/recipes" },
  ];
}

function QuickActionsMenu({ t }: { t: HomeDict }) {
  const QUICK_ACTIONS = buildQuickActions(t);
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const router = useRouter();

  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 640;

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setFocusIndex(-1);
    buttonRef.current?.focus();
  }, []);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, closeDropdown]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDropdown();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, closeDropdown]);

  useEffect(() => {
    if (!sheetOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeSheet();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [sheetOpen, closeSheet]);

  useEffect(() => {
    if (sheetOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [sheetOpen]);

  function handleButtonClick() {
    if (isMobile) {
      setSheetOpen(true);
    } else {
      setOpen((prev) => !prev);
      setFocusIndex(-1);
    }
  }

  function handleDropdownKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(focusIndex + 1, QUICK_ACTIONS.length - 1);
      setFocusIndex(next);
      itemsRef.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = Math.max(focusIndex - 1, 0);
      setFocusIndex(prev);
      itemsRef.current[prev]?.focus();
    } else if (e.key === "Enter" && focusIndex >= 0) {
      e.preventDefault();
      router.push(QUICK_ACTIONS[focusIndex].href);
      closeDropdown();
    }
  }

  return (
    <>
      <div
        ref={containerRef}
        className="relative"
        onKeyDown={handleDropdownKeyDown}
      >
        <button
          ref={buttonRef}
          onClick={handleButtonClick}
          aria-haspopup="true"
          aria-expanded={open}
          aria-label={t.quickActions}
          className="inline-flex items-center gap-golden-1 rounded-golden-lg border border-zinc-200 bg-white px-golden-3 py-golden-2 text-golden-base font-semibold text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300"
        >
          <span>⚡</span>
          <span className="hidden sm:inline">{t.quickActions}</span>
          <svg
            className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 8.25l-7.5 7.5-7.5-7.5"
            />
          </svg>
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-golden-2 w-56 rounded-golden-lg border border-zinc-200 bg-white py-golden-1 shadow-lg animate-in fade-in-0 zoom-in-95"
          >
            {QUICK_ACTIONS.map((action, idx) => (
              <a
                key={action.href}
                ref={(el) => {
                  itemsRef.current[idx] = el;
                }}
                href={action.href}
                role="menuitem"
                tabIndex={-1}
                onClick={(e) => {
                  e.preventDefault();
                  router.push(action.href);
                  closeDropdown();
                }}
                className={[
                  "flex items-center gap-golden-3 px-golden-3 py-golden-3 text-golden-base text-zinc-700 transition-colors hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none",
                  focusIndex === idx ? "bg-zinc-50" : "",
                ].join(" ")}
                style={{ minHeight: "44px" }}
              >
                <span className="text-golden-md">{action.icon}</span>
                <span className="font-medium">{action.label}</span>
              </a>
            ))}
          </div>
        )}
      </div>

      {sheetOpen && (
        <div
          className="fixed inset-0 z-[100] sm:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t.quickActions}
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0"
            onClick={closeSheet}
          />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-golden-xl bg-white pb-golden-6 pt-golden-3 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto mb-golden-4 h-1 w-10 rounded-full bg-zinc-300" />
            <p className="mb-golden-2 px-golden-4 text-golden-sm font-bold uppercase tracking-widest text-zinc-400">
              {t.quickActions}
            </p>
            <div className="flex flex-col">
              {QUICK_ACTIONS.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(action.href);
                    closeSheet();
                  }}
                  className="flex items-center gap-golden-4 px-golden-4 py-golden-3 text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100"
                  style={{ minHeight: "52px" }}
                >
                  <span className="text-xl">{action.icon}</span>
                  <span className="text-golden-md font-medium">{action.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────────────
// Information-first card that navigates to its related module. No create CTA —
// data creation lives in Quick Actions. Hover + arrow signal it's clickable.

function KpiCard({
  icon,
  label,
  value,
  sub,
  href,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-golden-3 rounded-golden-lg border border-zinc-200 bg-white px-golden-3 py-golden-3 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-300"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-golden-md bg-zinc-100 text-golden-md">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-golden-xs font-bold uppercase tracking-widest text-zinc-400">
          {label}
        </p>
        <p className="mt-golden-1 truncate text-golden-base font-bold text-zinc-900">
          {value}
        </p>
        <p className="truncate text-golden-xs text-zinc-400">{sub}</p>
      </div>
      <svg
        className="h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
      </svg>
    </Link>
  );
}

// ── Progress Row ──────────────────────────────────────────────────────────────

function ProgressRow({
  label,
  current,
  target,
  suffix,
  color,
}: {
  label: string;
  current: number;
  target: number;
  suffix: string;
  color: string;
}) {
  const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
  return (
    <div>
      <div className="mb-golden-1 flex items-center justify-between gap-golden-2">
        <span className="text-golden-sm font-medium text-zinc-600">{label}</span>
        <span className="text-golden-sm font-semibold text-zinc-900">
          {current.toLocaleString()} / {target.toLocaleString()} {suffix}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
