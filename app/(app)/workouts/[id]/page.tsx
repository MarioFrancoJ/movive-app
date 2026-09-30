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
type ExerciseCategory = "Strength" | "Calisthenics" | "Cardio" | "Mobility" | "Flexibility";

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
  category: ExerciseCategory | null;
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

interface RoutineStats {
  strengthPct: number;
  cardioPct: number;
  caloriesMin: number;
  caloriesMax: number;
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

/** Redondea un porcentaje al múltiplo de 5 más cercano (entre 0 y 100). */
function roundTo5(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n / 5) * 5));
}

/** Calcula los stats de la rutina a partir de los ejercicios. */
function computeRoutineStats(
  workout: WorkoutDetail,
  totalExercises: number
): RoutineStats {
  if (totalExercises === 0) {
    return { strengthPct: 0, cardioPct: 0, caloriesMin: 0, caloriesMax: 0 };
  }

  // Fuerza vs Cardio — ponderado por sets.
  let strengthSets = 0;
  let cardioSets = 0;
  for (const day of workout.workout_days) {
    for (const ex of day.workout_exercises) {
      const sets = Math.max(1, ex.sets || 1);
      if (ex.category === "Cardio") {
        cardioSets += sets;
      } else if (
        ex.category === "Strength" ||
        ex.category === "Calisthenics"
      ) {
        strengthSets += sets;
      }
      // Mobility / Flexibility no suman a Fuerza ni Cardio.
    }
  }
  const totalCategorized = strengthSets + cardioSets;
  const strengthPct = totalCategorized > 0
    ? roundTo5((strengthSets / totalCategorized) * 100)
    : 0;
  const cardioPct = totalCategorized > 0
    ? 100 - strengthPct
    : 0;

  // Calorías — MET por categoría dominante × duración × peso base (70 kg).
  const duration = workout.duration ?? 30;
  let met = 6.0; // mixta por defecto
  if (cardioPct >= 60) met = 8.0;
  else if (strengthPct >= 60) met = 5.0;
  else if (cardioPct <= 20 && strengthPct <= 20) met = 3.0;

  const baseKcal = Math.round((duration * met * 70) / 60);
  const caloriesMin = Math.round(baseKcal * 0.85);
  const caloriesMax = Math.round(baseKcal * 1.15);

  return { strengthPct, cardioPct, caloriesMin, caloriesMax };
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

    const { data, error } = await supabase
      .from("workouts")
      .select(`
        id, name, description, goal, difficulty, duration,
        workout_days (
          id, day_name, sort_order,
          workout_exercises (
            id, exercise_id, exercise_name, sets, reps, rest_seconds, notes, sort_order,
            exercise:exercises ( image_url, video_url, category )
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
            .map((ex: any) => {
              const exData = Array.isArray(ex.exercise)
                ? ex.exercise[0]
                : ex.exercise;
              return {
                id: ex.id,
                exercise_id: ex.exercise_id,
                exercise_name: ex.exercise_name,
                sets: ex.sets,
                reps: ex.reps,
                rest_seconds: ex.rest_seconds,
                notes: ex.notes,
                sort_order: ex.sort_order,
                image_url: exData?.image_url ?? null,
                video_url: exData?.video_url ?? null,
                category: (exData?.category ?? null) as ExerciseCategory | null,
              };
            }),
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
  const stats = computeRoutineStats(workout, totalExercises);

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

            {/* Badges objetivo + nivel (sin iconos) */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {workout.goal && (
                <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${goalColor(workout.goal)}`}>
                  {goalLabel(workout.goal, w)}
                </span>
              )}
              {workout.difficulty && (
                <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${difficultyColor(workout.difficulty)}`}>
                  {difficultyLabel(workout.difficulty, w)}
                </span>
              )}
            </div>

            {/* Meta (sin iconos, separado por ·) */}
            <p className="mt-3 text-sm text-zinc-500">
              {[
                workout.duration ? `${workout.duration} min` : null,
                `${workout.workout_days.length} ${t.daysSuffix ?? "días"}`,
                `${totalExercises} ${t.exercisesSuffixShort ?? "ejercicios"}`,
              ].filter(Boolean).join(" · ")}
            </p>

            {/* Descripción como texto plano */}
            {workout.description && (
              <p className="mt-3 max-w-2xl text-sm text-zinc-600">{workout.description}</p>
            )}

            {/* CTA protagonista */}
            <div className="mt-5">
              {totalExercises > 0 ? (
                <Link
                  href={`/training/start?workout=${workout.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover"
                >
                  {t.startWorkout}
                </Link>
              ) : (
                <span
                  title={t.startDisabledTooltip}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-100 px-6 py-3 text-sm font-semibold text-zinc-400"
                >
                  {t.startWorkout}
                </span>
              )}
            </div>
          </div>

          {/* Duplicar / Eliminar — sin iconos */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDuplicate}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              {dict.common.duplicate}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
            >
              {dict.common.delete}
            </button>
          </div>
        </div>

        {/* Grid 2 columnas: Ejercicios clave + Estadísticas */}
        {(keyExercises.length > 0 || totalExercises > 0) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

            {/* Estadísticas de la rutina */}
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400" aria-hidden="true">
                  <path d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm8-6a.75.75 0 0 1 .75.75v5.19l3.72 3.72a.75.75 0 0 1-1.06 1.06l-3.5-3.5a.75.75 0 0 1-.22-.53V4.75A.75.75 0 0 1 10 4Z" />
                </svg>
                <p className="text-sm font-semibold text-zinc-900">{t.statsTitle}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-zinc-50 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                    <span aria-hidden="true">💪</span>
                    {t.statsStrength}
                  </div>
                  <p className="mt-1 text-lg font-bold text-zinc-900">{stats.strengthPct}%</p>
                </div>
                <div className="rounded-lg bg-zinc-50 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                    <span aria-hidden="true">❤️</span>
                    {t.statsCardio}
                  </div>
                  <p className="mt-1 text-lg font-bold text-zinc-900">{stats.cardioPct}%</p>
                </div>
                <div className="rounded-lg bg-zinc-50 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                    <span aria-hidden="true">🔥</span>
                    {t.statsCalories}
                  </div>
                  <p className="mt-1 text-lg font-bold text-zinc-900">
                    {stats.caloriesMin}–{stats.caloriesMax}
                  </p>
                </div>
                <div className="rounded-lg bg-zinc-50 p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
                    <span aria-hidden="true">🎯</span>
                    {t.statsLevel}
                  </div>
                  <p className="mt-1 text-lg font-bold text-zinc-900">
                    {workout.difficulty ? difficultyLabel(workout.difficulty, w) : "—"}
                  </p>
                </div>
              </div>
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
