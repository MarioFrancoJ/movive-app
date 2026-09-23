"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useToast } from "@/components/ui/Toast";
import EmptyState from "@/components/ui/EmptyState";
import Chip from "@/components/ui/Chip";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";
import WorkoutCard, {
  type WorkoutItem,
  type WorkoutDifficulty,
} from "@/components/training/WorkoutCard";
import WeekPlanner from "@/components/training/WeekPlanner";
import WeeklyProgress from "@/components/training/WeeklyProgress";
import type { WorkoutPickerItem } from "@/components/training/WorkoutPicker";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WeeklyStats {
  workoutsCompleted: number;
  totalTimeMinutes: number;
  currentStreak: number;
}

type FilterCategory = "All" | "Strength" | "Hypertrophy" | "Calisthenics" | "Mobility";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getSundayKey(mondayKey: string): string {
  const d = new Date(`${mondayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkoutsView() {
  const { dict } = useDictionary();
  const t = dict.workouts;
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({
    workoutsCompleted: 0,
    totalTimeMinutes: 0,
    currentStreak: 0,
  });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkouts();
    loadWeeklyStats();
  }, []);

  async function loadWorkouts() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from("workouts")
      .select("id, name, description, goal, difficulty, duration, is_template, workout_days(workout_exercises(id))")
      .eq("user_id", user.id)
      .eq("is_template", false)
      .order("created_at", { ascending: false });

    if (data) setWorkouts(data.map(mapWorkout));
    setLoading(false);
  }

  async function loadWeeklyStats() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const mondayKey = getMondayKey(new Date());
    const sundayKey = getSundayKey(mondayKey);

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

  // Visual-only filters (no logic yet).
  const filteredWorkouts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workouts;
    return workouts.filter((w) => w.name.toLowerCase().includes(q));
  }, [workouts, search]);

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
  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
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

      {/* ── Week Planner ── */}
     <WeekPlanner
  workouts={workouts.map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description,
    goal: w.goal,
    difficulty: w.difficulty,
    duration: w.duration,
    exerciseCount: w.exerciseCount,
  }))}
  labels={{
    title: t.thisWeekTitle,
    prevWeek: t.prevWeek,
    nextWeek: t.nextWeek,
    today: t.today,
    currentWeek: t.currentWeek,
    goToCurrentWeek: t.goToCurrentWeek,
    addWorkout: t.addWorkout,
    restDay: t.restDay,
    planned: t.planned,
    completed: t.completed,
    min: t.unitMin,
    picker: {
      title: t.pickerTitle,
  searchPlaceholder: t.pickerSearch,
noMatch: t.pickerNoMatch,
countSummary: t.pickerCount,
      all: t.goalAll,
    },
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
          workoutsCompletedSub: t.weeklyProgressCompletedSub,
          totalTime: t.weeklyProgressTotalTime,
          totalTimeSub: t.weeklyProgressTotalTimeSub,
          currentStreak: t.weeklyProgressStreak,
          currentStreakSub: t.weeklyProgressStreakSub,
        }}
      />

      {/* ── My Workouts ── */}
      <div>
        <div className="mb-4">
          <h2 className="text-lg font-bold text-zinc-900">{t.myWorkouts}</h2>
          <p className="mt-1 text-sm text-zinc-500">{t.myWorkoutsSubtitle}</p>
        </div>

        {/* Search + Filter chips (visual only for filters) */}
        <div className="mb-4 flex flex-col gap-3">
          <div className="relative w-full sm:w-80">
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <input
              type="search"
              placeholder={t.searchWorkoutsPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t.searchWorkoutsPlaceholder}
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:h-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["All", "Strength", "Hypertrophy", "Calisthenics", "Mobility"] as const).map((cat) => (
              <Chip
                key={cat}
                active={filter === cat}
                onClick={() => setFilter(cat)}
              >
                {cat === "All" ? t.goalAll : cat}
              </Chip>
            ))}
          </div>
        </div>

        {/* Workouts Grid */}
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
        ) : filteredWorkouts.length === 0 ? (
          <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
            <p className="text-sm text-zinc-400">{t.noMatch}</p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredWorkouts.map((w) => (
            <WorkoutCard key={w.id} workout={w} href={`/workouts/${w.id}`} t={t} />
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
