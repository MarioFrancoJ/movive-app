"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { SkeletonPage } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import EmptyState from "@/components/ui/EmptyState";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkoutsDict = ReturnType<typeof useDictionary>["dict"]["workouts"];

type WorkoutGoal = "Fat Loss" | "Muscle Gain" | "Strength" | "Endurance" | "Mobility" | "General Fitness";
type WorkoutDifficulty = "Beginner" | "Intermediate" | "Advanced";

interface WorkoutItem {
  id: string;
  name: string;
  description: string | null;
  goal: WorkoutGoal | null;
  difficulty: WorkoutDifficulty | null;
  duration: number | null;
  is_template: boolean;
  exerciseCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function difficultyColor(d: WorkoutDifficulty | null): string {
  switch (d) {
    case "Beginner":     return "bg-success-light text-success";
    case "Intermediate": return "bg-amber-50 text-amber-700";
    case "Advanced":     return "bg-red-50 text-red-700";
    default:             return "bg-zinc-100 text-zinc-600";
  }
}

function goalColor(g: WorkoutGoal | null): string {
  switch (g) {
    case "Fat Loss":        return "bg-rose-50 text-rose-700";
    case "Muscle Gain":     return "bg-blue-50 text-blue-700";
    case "Strength":        return "bg-purple-50 text-purple-700";
    case "Endurance":       return "bg-orange-50 text-orange-700";
    case "Mobility":        return "bg-teal-50 text-teal-700";
    case "General Fitness": return "bg-zinc-100 text-zinc-700";
    default:                return "bg-zinc-100 text-zinc-600";
  }
}

// Localized display label for a goal value (value stays the logic/DB key).
function goalLabel(g: WorkoutGoal | null, t: WorkoutsDict): string {
  switch (g) {
    case "Fat Loss":        return t.goalFatLoss;
    case "Muscle Gain":     return t.goalMuscleGain;
    case "Strength":        return t.goalStrength;
    case "Endurance":       return t.goalEndurance;
    case "Mobility":        return t.goalMobility;
    case "General Fitness": return t.goalGeneralFitness;
    default:                return g ?? "";
  }
}

// Localized display label for a difficulty value (value stays the logic/DB key).
function difficultyLabel(d: WorkoutDifficulty | null, t: WorkoutsDict): string {
  switch (d) {
    case "Beginner":     return t.difficultyBeginner;
    case "Intermediate": return t.difficultyIntermediate;
    case "Advanced":     return t.difficultyAdvanced;
    default:             return d ?? "";
  }
}

// ── Workout Card ──────────────────────────────────────────────────────────────

function WorkoutCard({ workout, href, t }: { workout: WorkoutItem; href: string; t: WorkoutsDict }) {
  return (
    <Link href={href} className="flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900">{workout.name}</h3>
        {workout.difficulty && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColor(workout.difficulty)}`}>
            {difficultyLabel(workout.difficulty, t)}
          </span>
        )}
      </div>
      {workout.description && <p className="mb-3 text-xs text-zinc-400 line-clamp-2">{workout.description}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
        {workout.goal && (
          <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${goalColor(workout.goal)}`}>{goalLabel(workout.goal, t)}</span>
        )}
        <span className="text-xs text-zinc-400">{workout.exerciseCount} exercises</span>
        {workout.duration && <span className="text-xs text-zinc-400">{workout.duration} min</span>}
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkoutsPage() {
  const { success: showToast } = useToast();
  const { dict } = useDictionary();
  const t = dict.workouts;
  const [workouts, setWorkouts] = useState<WorkoutItem[]>([]);
  const [templates, setTemplates] = useState<WorkoutItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // User workouts (non-template) + system templates are independent → fetch
    // both concurrently instead of one after the other.
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

    if (userWorkoutsRes.data) {
      setWorkouts(userWorkoutsRes.data.map(mapWorkout));
    }
    if (templateRes.data) {
      setTemplates(templateRes.data.map(mapWorkout));
    }

    setLoading(false);
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
      goal: w.goal as WorkoutGoal | null,
      difficulty: w.difficulty as WorkoutDifficulty | null,
      duration: w.duration,
      is_template: w.is_template,
      exerciseCount,
    };
  }

  // ── Use Template ──────────────────────────────────────────────────────────

  async function handleUseTemplate(templateId: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch template with full nested data
    const { data: tpl } = await supabase
      .from("workouts")
      .select("name, description, goal, difficulty, duration, workout_days(day_name, sort_order, workout_exercises(exercise_id, exercise_name, sets, reps, rest_seconds, notes, sort_order))")
      .eq("id", templateId)
      .single();

    if (!tpl) return;

    // Create user's copy
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

    // Copy days + exercises without an N+1 loop:
    //  1) batch-insert ALL days in one call (returning their new ids, ordered),
    //  2) batch-insert ALL exercises in one call, mapping each day's exercises
    //     to the new day id by matching sort_order.
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
        // Map original template day (by sort_order) → its new inserted id.
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

    // Refresh list
    await loadData();
    showToast(t.toastTemplateLoaded);
  }

  // ── Delete Workout ────────────────────────────────────────────────────────

  async function handleDelete(workoutId: string) {
    const supabase = createClient();
    const { error } = await supabase.from("workouts").delete().eq("id", workoutId);
    if (!error) {
      setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t.subtitle}</p>
        </div>
        <Link href="/workouts/new" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          {t.newWorkout}
        </Link>
      </div>

      {/* My Workouts */}
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

      {/* Templates */}
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

      {/* Toast */}
    </div>
  );
}
