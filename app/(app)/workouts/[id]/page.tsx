"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useToast } from "@/components/ui/Toast";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";
import RoutineDayCard from "@/components/training/RoutineDayCard";
import ExercisePicker, { type ExercisePickerItem } from "@/components/training/ExercisePicker";
import ExerciseEditModal from "@/components/training/ExerciseEditModal";
import ExerciseVideoModal from "@/components/training/ExerciseVideoModal";
import type { RoutineExercise } from "@/components/training/RoutineDayCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkoutsDict = ReturnType<typeof useDictionary>["dict"]["workouts"];

type WorkoutDifficulty = "Beginner" | "Intermediate" | "Advanced";
type WorkoutGoal = "Fat Loss" | "Muscle Gain" | "Strength" | "Endurance" | "Mobility" | "General Fitness";

interface WorkoutExercise {
  id: string;
  exercise_id: string | null;
  exercise_name: string;
  sets: number;
  reps: number;
  rest_seconds: number;
  notes: string | null;
  sort_order: number;
  image_url: string | null;
  video_url: string | null;
}

interface WorkoutDay {
  id: string;
  day_name: string;
  sort_order: number;
  workout_exercises: WorkoutExercise[];
}

interface WorkoutDetail {
  id: string;
  name: string;
  description: string | null;
  goal: WorkoutGoal | null;
  difficulty: WorkoutDifficulty | null;
  duration: number | null;
  workout_days: WorkoutDay[];
}

interface VideoExercise {
  name: string;
  video_url: string;
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

function goalLabel(g: WorkoutGoal | null, w: WorkoutsDict): string {
  switch (g) {
    case "Fat Loss":        return w.goalFatLoss;
    case "Muscle Gain":     return w.goalMuscleGain;
    case "Strength":        return w.goalStrength;
    case "Endurance":       return w.goalEndurance;
    case "Mobility":        return w.goalMobility;
    case "General Fitness": return w.goalGeneralFitness;
    default:                return g ?? "";
  }
}

function difficultyLabel(d: WorkoutDifficulty | null, w: WorkoutsDict): string {
  switch (d) {
    case "Beginner":     return w.difficultyBeginner;
    case "Intermediate": return w.difficultyIntermediate;
    case "Advanced":     return w.difficultyAdvanced;
    default:             return d ?? "";
  }
}

function dayLabel(name: string, w: WorkoutsDict): string {
  const map: Record<string, string> = {
    Monday:    w.dayMon,
    Tuesday:   w.dayTue,
    Wednesday: w.dayWed,
    Thursday:  w.dayThu,
    Friday:    w.dayFri,
    Saturday:  w.daySat,
    Sunday:    w.daySun,
  };
  return map[name] ?? name;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkoutDetailPage() {
  const { success: showToast } = useToast();
  const { dict } = useDictionary();
  const t = dict.workouts.detail;
  const w = dict.workouts;
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<RoutineExercise | null>(null);
  const [videoExercise, setVideoExercise] = useState<VideoExercise | null>(null);

  // ── Load workout ──
  const loadWorkout = useCallback(async () => {
    const supabase = createClient();

    // JOIN con exercises para traer image_url y video_url.
    // workout_exercises.exercise_id es nullable (custom exercises), por eso LEFT JOIN.
    const { data, error } = await supabase
      .from("workouts")
      .select(`
        id, name, description, goal, difficulty, duration,
        workout_days (
          id, day_name, sort_order,
          workout_exercises (
            id, exercise_id, exercise_name, sets, reps, rest_seconds, notes, sort_order,
            exercise:exercises ( image_url, video_url )
          )
        )
      `)
      .eq("id", params.id)
      .single();

    if (!error && data) {
      const sortedDays = (data.workout_days || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((day: any) => ({
          ...day,
          workout_exercises: (day.workout_exercises || [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((ex: any) => ({
              id: ex.id,
              exercise_id: ex.exercise_id,
              exercise_name: ex.exercise_name,
              sets: ex.sets,
              reps: ex.reps,
              rest_seconds: ex.rest_seconds,
              notes: ex.notes,
              sort_order: ex.sort_order,
              // Supabase devuelve "exercise" como array u objeto según la relación.
              // Normalizamos a valores planos.
              image_url: Array.isArray(ex.exercise)
                ? (ex.exercise[0]?.image_url ?? null)
                : (ex.exercise?.image_url ?? null),
              video_url: Array.isArray(ex.exercise)
                ? (ex.exercise[0]?.video_url ?? null)
                : (ex.exercise?.video_url ?? null),
            })),
        }));

      setWorkout({
        id: data.id,
        name: data.name,
        description: data.description,
        goal: data.goal as WorkoutGoal | null,
        difficulty: data.difficulty as WorkoutDifficulty | null,
        duration: data.duration,
        workout_days: sortedDays,
      });
    }

    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  // ── Delete workout ──
  async function handleDelete() {
    const supabase = createClient();
    const { error } = await supabase.from("workouts").delete().eq("id", params.id);
    if (!error) {
      router.push("/workouts");
    }
  }

  // ── Update exercise ──
  async function handleUpdateExercise(
    exerciseId: string,
    updates: { sets: number; reps: number; rest_seconds: number; notes?: string | null }
  ) {
    const supabase = createClient();
    const { error } = await supabase
      .from("workout_exercises")
      .update(updates)
      .eq("id", exerciseId);

    if (error) {
      showToast(`Error: ${error.message}`);
      return;
    }
    await loadWorkout();
  }

  async function handleSaveFromModal(updates: {
    sets: number;
    reps: number;
    rest_seconds: number;
    notes: string | null;
  }) {
    if (!editingExercise) return;
    const id = editingExercise.id;
    setEditingExercise(null);
    await handleUpdateExercise(id, updates);
  }

  // ── Reorder exercises ──
  async function handleReorderExercises(dayId: string, orderedIds: string[]) {
    if (!workout) return;
    const supabase = createClient();

    const updates = orderedIds.map((id, index) =>
      supabase
        .from("workout_exercises")
        .update({ sort_order: index })
        .eq("id", id)
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      showToast(`Error: ${failed.error.message}`);
      return;
    }

    await loadWorkout();
  }

  // ── Duplicate workout ──
  async function handleDuplicate() {
    if (!workout) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: newWorkout } = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        name: `${workout.name} (Copy)`,
        description: workout.description,
        goal: workout.goal,
        difficulty: workout.difficulty,
        duration: workout.duration,
        is_template: false,
        is_planner_copy: false,
      })
      .select("id")
      .single();

    if (!newWorkout) return;

    for (const day of workout.workout_days) {
      const { data: newDay } = await supabase
        .from("workout_days")
        .insert({
          workout_id: newWorkout.id,
          user_id: user.id,
          day_name: day.day_name,
          sort_order: day.sort_order,
        })
        .select("id")
        .single();

      if (!newDay) continue;

      if (day.workout_exercises.length > 0) {
        const exerciseInserts = day.workout_exercises.map((ex) => ({
          workout_day_id: newDay.id,
          user_id: user.id,
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          sets: ex.sets,
          reps: ex.reps,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes,
          sort_order: ex.sort_order,
        }));

        await supabase.from("workout_exercises").insert(exerciseInserts);
      }
    }

    showToast(t.toastDuplicated);
    router.push(`/workouts/${newWorkout.id}`);
  }

  // ── Add exercise ──
  async function handleAddExercise(exercise: ExercisePickerItem) {
    if (!pickerDayId || !workout) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const day = workout.workout_days.find((d) => d.id === pickerDayId);
    const nextOrder = day?.workout_exercises.length ?? 0;

    const { error } = await supabase.from("workout_exercises").insert({
      workout_day_id: pickerDayId,
      user_id: user.id,
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      sets: 3,
      reps: 10,
      rest_seconds: 60,
      sort_order: nextOrder,
    });

    if (error) {
      showToast(`Error: ${error.message}`);
      return;
    }

    setPickerDayId(null);
    await loadWorkout();
  }

  // ── Remove exercise ──
  async function handleRemoveExercise(exerciseId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("workout_exercises")
      .delete()
      .eq("id", exerciseId);

    if (error) {
      showToast(`Error: ${error.message}`);
      return;
    }

    await loadWorkout();
  }

  // ── "Ejercicios clave": primeros 4 únicos por sort_order global ──
  function getKeyExercises(): WorkoutExercise[] {
    if (!workout) return [];
    const seen = new Set<string>();
    const result: WorkoutExercise[] = [];
    for (const day of workout.workout_days) {
      for (const ex of day.workout_exercises) {
        const key = ex.exercise_id ?? ex.exercise_name;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(ex);
        if (result.length >= 4) return result;
      }
    }
    return result;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <PageLoader text={t.loading} />;
  }

  if (!workout) {
    return (
      <div className="flex flex-col gap-6">
        <Link href="/workouts" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
          {t.backToWorkouts}
        </Link>
        <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 bg-white">
          <p className="text-sm text-zinc-400">{t.notFound}</p>
        </div>
      </div>
    );
  }

  const totalExercises = workout.workout_days.reduce((s, d) => s + d.workout_exercises.length, 0);
  const keyExercises = getKeyExercises();
  const keyExercisesExtra = totalExercises - keyExercises.length;

  return (
    <>
      <div className="flex flex-col gap-6">
        <Link href="/workouts" className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900">
          {t.backToWorkouts}
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{workout.name}</h1>

            {/* Badges de objetivo + nivel */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {workout.goal && (
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${goalColor(workout.goal)}`}>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clipRule="evenodd" />
                  </svg>
                  {goalLabel(workout.goal, w)}
                </span>
              )}
              {workout.difficulty && (
                <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${difficultyColor(workout.difficulty)}`}>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M15.5 2A1.5 1.5 0 0 0 14 3.5V5h-1V3.5a1.5 1.5 0 0 0-3 0V5h-1V3.5a1.5 1.5 0 0 0-3 0V5H5V3.5a1.5 1.5 0 0 0-3 0v13A1.5 1.5 0 0 0 3.5 18h13a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 16.5 2h-1ZM5 7h10v9H5V7Z" />
                  </svg>
                  {difficultyLabel(workout.difficulty, w)}
                </span>
              )}
            </div>

            {/* Meta con iconos */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-zinc-500">
              {workout.duration && (
                <span className="inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
                  </svg>
                  {workout.duration} min
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
                </svg>
                {workout.workout_days.length} días
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400" aria-hidden="true">
                  <path d="M10 2a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5A.75.75 0 0 1 10 2ZM5.75 8a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5A.75.75 0 0 1 5.75 8ZM14.25 8a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5a.75.75 0 0 1 .75-.75Z" />
                </svg>
                {totalExercises} ejercicios
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {totalExercises > 0 ? (
              <Link
                href={`/training/start?workout=${workout.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                  <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" />
                </svg>
                {t.startWorkout}
              </Link>
            ) : (
              <span
                title={t.startDisabledTooltip}
                className="cursor-not-allowed rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-400"
              >
                {t.startWorkout}
              </span>
            )}
            <button
              type="button"
              onClick={handleDuplicate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M7 3.5A1.5 1.5 0 0 1 8.5 2h5A1.5 1.5 0 0 1 15 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 7 12.5v-9Z" />
                <path d="M5 6.5A1.5 1.5 0 0 0 3.5 8v8A1.5 1.5 0 0 0 5 17.5h5A1.5 1.5 0 0 0 11.5 16H8.5A2.5 2.5 0 0 1 6 13.5V6.5H5Z" />
              </svg>
              {dict.common.duplicate}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41 41 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5Z" clipRule="evenodd" />
              </svg>
              {dict.common.delete}
            </button>
          </div>
        </div>

        {/* Enfoque del programa (description) */}
        {workout.description && (
          <div className="flex items-start gap-3 rounded-xl border border-success-light bg-success-light/40 p-4">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-success" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-2a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clipRule="evenodd" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-900">{t.focusTitle}</p>
              <p className="mt-0.5 text-sm text-zinc-600">{workout.description}</p>
            </div>
          </div>
        )}

        {/* Ejercicios clave */}
        {keyExercises.length > 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400" aria-hidden="true">
                <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401Z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-semibold text-zinc-900">{t.keyExercisesTitle}</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {keyExercises.map((ex) => (
                <div key={ex.id} className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (ex.video_url) {
                        setVideoExercise({ name: ex.exercise_name, video_url: ex.video_url });
                      }
                    }}
                    disabled={!ex.video_url}
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-zinc-100 shadow-sm transition-transform hover:scale-105 disabled:hover:scale-100 disabled:cursor-default"
                    aria-label={ex.exercise_name}
                  >
                    {ex.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ex.image_url} alt={ex.exercise_name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl">💪</span>
                    )}
                  </button>
                  <span className="max-w-[70px] truncate text-center text-[11px] font-medium text-zinc-600">
                    {ex.exercise_name}
                  </span>
                </div>
              ))}
              {keyExercisesExtra > 0 && (
                <div className="flex h-14 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 px-3 text-xs font-semibold text-zinc-500">
                  +{keyExercisesExtra} {t.keyExercisesMore}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Workout Days */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workout.workout_days.map((day) => (
            <RoutineDayCard
              key={day.id}
              dayName={dayLabel(day.day_name, w)}
              exercises={day.workout_exercises}
              labels={{
                restDay: t.restDay,
                rest: "Descanso",
                addExercise: t.addExercise,
                removeExercise: t.removeExercise,
                editExercise: t.editExercise,
                exercisesCount: t.exercisesCount,
              }}
              onAddExercise={() => setPickerDayId(day.id)}
              onRemoveExercise={handleRemoveExercise}
              onUpdateExercise={handleUpdateExercise}
              onOpenEditModal={(ex) => setEditingExercise(ex)}
              onReorderExercises={(orderedIds) => handleReorderExercises(day.id, orderedIds)}
              onOpenVideo={(ex) => {
                if (ex.video_url) {
                  setVideoExercise({ name: ex.exercise_name, video_url: ex.video_url });
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* Exercise Picker Modal */}
      {pickerDayId && (
        <ExercisePicker
          labels={{
            title: t.pickerExerciseTitle,
            searchPlaceholder: t.pickerExerciseSearch,
            noMatch: t.pickerExerciseNoMatch,
            countSummary: t.pickerExerciseCount,
            all: t.pickerExerciseAll,
            createCta: t.createExerciseCta,
            createTitle: t.createExerciseTitle,
            createName: t.createExerciseName,
            createNamePlaceholder: t.createExerciseNamePlaceholder,
            createCategory: t.createExerciseCategory,
            createMuscle: t.createExerciseMuscle,
            createEquipment: t.createExerciseEquipment,
            createDifficulty: t.createExerciseDifficulty,
            createDescription: t.createExerciseDescription,
            createDescriptionPlaceholder: t.createExerciseDescriptionPlaceholder,
            createSave: t.createExerciseSave,
            createCancel: t.createExerciseCancel,
            createErrorName: t.createExerciseErrorName,
            createErrorGeneric: t.createExerciseErrorGeneric,
            createBack: t.createExerciseBack,
          }}
          onSelect={handleAddExercise}
          onClose={() => setPickerDayId(null)}
        />
      )}

      {/* Exercise Edit Modal */}
      {editingExercise && (
        <ExerciseEditModal
          exercise={editingExercise}
          labels={{
            title: t.editExerciseTitle,
            sets: t.editSets,
            reps: t.editReps,
            rest: t.editRest,
            notes: t.editNotes,
            notesPlaceholder: t.editNotesPlaceholder,
            save: t.editSave,
            cancel: t.editCancel,
          }}
          onSave={handleSaveFromModal}
          onClose={() => setEditingExercise(null)}
        />
      )}

      {/* Exercise Video Modal */}
      {videoExercise && (
        <ExerciseVideoModal
          name={videoExercise.name}
          videoUrl={videoExercise.video_url}
          onClose={() => setVideoExercise(null)}
        />
      )}
    </>
  );
}
