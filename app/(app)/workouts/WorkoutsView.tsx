"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useToast } from "@/components/ui/Toast";
import EmptyState from "@/components/ui/EmptyState";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";
import WorkoutCard, {
  difficultyColor,
  difficultyLabel,
  goalColor,
  goalLabel,
  type WorkoutItem,
  type WorkoutDifficulty,
} from "@/components/training/WorkoutCard";
import WeekPlanner from "@/components/training/WeekPlanner";
import WeeklyProgress from "@/components/training/WeeklyProgress";

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkoutsDict = ReturnType<typeof useDictionary>["dict"]["workouts"];

interface WeeklyStats {
  workoutsCompleted: number;
  totalTimeMinutes: number;
  currentStreak: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Monday of the week containing `date` as YYYY-MM-DD. */
function getMondayKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Sunday key for a given Monday key. */
function getSundayKey(mondayKey: string): string {
  const d = new Date(`${mondayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkoutsView() {
  const { success: showToast } = useToast();
  const { dict } = useDictionary();
  const t = dict.workouts;
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [templates, setTemplates] = useState<WorkoutItem[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    workoutsCompleted: 0,
    totalTimeMinutes: 0,
    currentStreak: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkouts();
    loadWeeklyStats();
  }, []);

  async function loadWorkouts() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [userWorkoutsRes, templateRes] = await Promise.all([
      supabase
        .from("workouts")
        .select("id, name, description, goal, difficulty, duration, is_template, workout_days(workout_exercises(id))")
        .eq("user_id", user.id)
        .eq("is_template", false)
        .order("created_at", { ascending: false }),
      supabase
        .from("workouts")
        .select("id, name, description, goal, difficulty, duration, is_template, workout_days(workout_exercises(id))")
        .is("user_id", null)
        .eq("is_template", true)
        .order("name"),
    ]);

    if (userWorkoutsRes.data) setWorkouts(userWorkoutsRes.data.map(mapWorkout));
    if (templateRes.data) setTemplates(templateRes.data.map(mapWorkout));

    setLoading(false);
  }

  async function loadWeeklyStats() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const mondayKey = getMondayKey(new Date());
    const sundayKey = getSundayKey(mondayKey);

    // 1. This week's completed sessions
    const { data: weekSessions } = await supabase
      .from("training_sessions")
      .select("date, duration_minutes")
      .eq("user_id", user.id)
      .eq("status", "Completed")
      .eq("is_sandbox", false)
      .gte("date", mondayKey)
      .lte("date", sundayKey);

    const workoutsCompleted = weekSessions?.length ?? 0;
    const totalTimeMinutes = (weekSessions ?? []).reduce(
      (sum, s) => sum + (s.duration_minutes || 0),
      0
    );

    // 2. Current streak — fetch last 60 sessions and compute consecutive days
    const { data: recentSessions } = await supabase
      .from("training_sessions")
      .select("date")
      .eq("user_id", user.id)
      .eq("status", "Completed")
      .eq("is_sandbox", false)
      .order("date", { ascending: false })
      .limit(60);

    let streak = 0;
    if (recentSessions) {
      const dates = new Set(recentSessions.map((s) => s.date));
      const d = new Date();
      for (let i = 0; i < 60; i++) {
        const key = d.toISOString().slice(0, 10);
        if (dates.has(key)) streak++;
        else if (i > 0) break;
        d.setDate(d.getDate() - 1);
      }
    }

    setWeeklyStats({ workoutsCompleted, totalTimeMinutes, currentStreak: streak });
  }

  function mapWorkout(w: {
    id: string;
    name: string;
    description: string | null;
    goal: string | null;
    difficulty: string | null;
    duration: number | null;
    is_template: boolean;
    workout_days: { workout_exercises: { id: string }[] }[] | null;
  }): WorkoutItem {
    const exerciseCount = w.workout_days?.reduce(
      (sum, d) => sum + (d.workout_exercises?.length || 0), 0
    ) || 0;

    return {
      id: w.id,
      name: w.name,
      description: w.description,
      goal: w.goal as WorkoutItem["goal"],
      difficulty: w.difficulty as WorkoutDifficulty | null,
      duration: w.duration,
      is_template: w.is_template,
      exerciseCount,
    };
  }

  async function handleUseTemplate(templateId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: tpl } = await supabase
      .from("workouts")
      .select("name, description, goal, difficulty, duration, workout_days(day_name, sort_order, workout_exercises(exercise_id, exercise_name, sets, reps, rest_seconds, notes, sort_order))")
      .eq("id", templateId)
      .single();

    if (!tpl) return;

    const { data: newWorkout } = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        name: tpl.name,
        description: tpl.description,
        goal: tpl.goal,
        difficulty: tpl.difficulty,
        duration: tpl.duration,
        is_template: false,
      })
      .select("id")
      .single();

    if (!newWorkout) return;

    const templateDays = tpl.workout_days || [];
    if (templateDays.length > 0) {
      const { data: newDays } = await supabase
        .from("workout_days")
        .insert(
          templateDays.map((day) => ({
            workout_id: newWorkout.id,
            user_id: user.id,
            day_name: day.day_name,
            sort_order: day.sort_order,
          }))
        )
        .select("id, sort_order");

      if (newDays) {
        const newDayIdBySort = new Map<number, string>(
          newDays.map((d) => [d.sort_order as number, d.id as string])
        );

        const allExercises = templateDays.flatMap((day) => {
          const newDayId = newDayIdBySort.get(day.sort_order);
          if (!newDayId) return [];
          return (day.workout_exercises || []).map((ex) => ({
            workout_day_id: newDayId,
            user_id: user.id,
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            sets: ex.sets,
            reps: ex.reps,
            rest_seconds: ex.rest_seconds,
            notes: ex.notes,
            sort_order: ex.sort_order,
          }));
        });

        if (allExercises.length > 0) {
          await supabase.from("workout_exercises").insert(allExercises);
        }
      }
    }

    await loadWorkouts();
    showToast(t.toastTemplateLoaded);
  }

  async function handleDelete(workoutId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("workouts").delete().eq("id", workoutId);
    if (!error) {
      setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    }
  }

  if (loading) {
    return <PageLoader text={t.loading} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/training/templates"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
          >
            {t.templates}
          </Link>
          <Link
            href="/workouts/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t.newWorkout}
          </Link>
        </div>
      </div>

      {/* ── This Week (Planner) ── */}
      <WeekPlanner
        labels={{
          title: t.thisWeekTitle,
          prevWeek: t.prevWeek,
          nextWeek: t.nextWeek,
          today: t.today,
          addWorkout: t.addWorkout,
          restDay: t.restDay,
          planned: t.planned,
          completed: t.completed,
          min: t.unitMin,
        }}
        weekdayLabels={[t.dayMon, t.dayTue, t.dayWed, t.dayThu, t.dayFri, t.daySat, t.daySun]}
      />

      {/* ── Weekly Progress ── */}
      <WeeklyProgress
        workoutsCompleted={weeklyStats.workoutsCompleted}
        totalTimeMinutes={weeklyStats.totalTimeMinutes}
        currentStreak={weeklyStats.currentStreak}
        labels={{
          title: t.weeklyProgressTitle,
          subtitle: t.weeklyProgressSubtitle,
          workoutsCompleted: t.weeklyProgressCompleted,
          totalTime: t.weeklyProgressTotalTime,
          currentStreak: t.weeklyProgressStreak,
          dayPlural: t.weeklyProgressStreak,
        }}
      />

      {/* ── My Workouts ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">{t.myWorkouts}</h2>
        {workouts.length === 0 ? (
          <EmptyState
            icon="🏋️"
            title={t.emptyTitle}
            description={t.emptyDescription}
            actionLabel={t.emptyAction}
            actionHref="/workouts/new"
            secondaryLabel={t.emptySecondary}
            secondaryHref="/training/templates"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workouts.map((w) => (
              <div key={w.id} className="relative">
                <WorkoutCard workout={w} href={`/workouts/${w.id}`} t={t} />
                <button
                  type="button"
                  onClick={() => handleDelete(w.id)}
                  className="absolute right-3 top-3 rounded-md p-1 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-600"
                  aria-label={`Delete ${w.name}`}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Templates ── */}
      {templates.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">{t.templates}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900">{tpl.name}</h3>
                  {tpl.difficulty && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColor(tpl.difficulty)}`}>
                      {difficultyLabel(tpl.difficulty, t)}
                    </span>
                  )}
                </div>
                {tpl.description && <p className="mb-3 text-xs text-zinc-400 line-clamp-2">{tpl.description}</p>}
                <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-3">
                  <div className="flex items-center gap-2">
                    {tpl.goal && <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${goalColor(tpl.goal)}`}>{goalLabel(tpl.goal, t)}</span>}
                    {tpl.duration && <span className="text-xs text-zinc-400">{tpl.duration} min</span>}
                    <span className="text-xs text-zinc-400">{tpl.exerciseCount} ex.</span>
                  </div>
                  <button type="button" onClick={() => handleUseTemplate(tpl.id)} className="text-xs font-semibold text-zinc-600 hover:text-zinc-900">
                    {t.useTemplate}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
