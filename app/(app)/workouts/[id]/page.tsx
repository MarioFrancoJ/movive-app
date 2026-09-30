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
import StrengthCardioBar from "@/components/training/StrengthCardioBar";
import type { RoutineExercise } from "@/components/training/RoutineDayCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkoutsDict = ReturnType<typeof useDictionary>["dict"]["workouts"];
type TrainingDict = ReturnType<typeof useDictionary>["dict"]["training"];

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
  muscle_group: string | null;
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

function muscleLabel(muscle: string, training: TrainingDict): string {
  const map = training.exercises.muscles as Record<string, string>;
  return map[muscle] ?? muscle;
}

function roundTo5(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n / 5) * 5));
}

function objectivesForGoal(goal: WorkoutGoal | null): string[] {
  switch (goal) {
    case "Fat Loss":
      return ["Pérdida de grasa", "Resistencia cardiovascular", "Acondicionamiento físico"];
    case "Muscle Gain":
      return ["Hipertrofia", "Fuerza", "Acondicionamiento"];
    case "Strength":
      return ["Fuerza máxima", "Potencia", "Acondicionamiento"];
    case "Endurance":
      return ["Resistencia cardiovascular", "Capacidad aeróbica", "Acondicionamiento"];
    case "Mobility":
      return ["Flexibilidad", "Movilidad articular", "Prevención de lesiones"];
    case "General Fitness":
      return ["Equilibrio general", "Salud cardiovascular", "Fuerza funcional"];
    default:
      return [];
  }
}

function expectedResultsForGoal(goal: WorkoutGoal | null): string[] {
  switch (goal) {
    case "Fat Loss":
      return [
        "Mayor gasto calórico",
        "Mejora de la resistencia cardiovascular",
        "Entrenamiento de cuerpo completo",
        "Sesiones rápidas y efectivas",
      ];
    case "Muscle Gain":
      return [
        "Aumento de masa muscular",
        "Mayor fuerza progresiva",
        "Mejor composición corporal",
        "Progresión sostenida",
      ];
    case "Strength":
      return [
        "Incremento de fuerza máxima",
        "Mejor control neuromuscular",
        "Mayor potencia",
        "Base sólida de progresión",
      ];
    case "Endurance":
      return [
        "Mayor capacidad aeróbica",
        "Mejor resistencia cardiovascular",
        "Recuperación más rápida",
        "Mayor energía diaria",
      ];
    case "Mobility":
      return [
        "Mayor rango de movimiento",
        "Menos rigidez articular",
        "Mejor postura",
        "Prevención de lesiones",
      ];
    case "General Fitness":
      return [
        "Mejor salud general",
        "Mayor energía",
        "Composición corporal equilibrada",
        "Menos riesgo de lesión",
      ];
    default:
      return [];
  }
}

function getTopMuscles(workout: WorkoutDetail, max = 6): string[] {
  const counts = new Map<string, number>();
  for (const day of workout.workout_days) {
    for (const ex of day.workout_exercises) {
      if (!ex.muscle_group) continue;
      counts.set(ex.muscle_group, (counts.get(ex.muscle_group) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([m]) => m);
}

function getStrengthCardioPct(workout: WorkoutDetail): { strength: number; cardio: number } {
  let strengthSets = 0;
  let cardioSets = 0;
  for (const day of workout.workout_days) {
    for (const ex of day.workout_exercises) {
      const sets = Math.max(1, ex.sets || 1);
      if (ex.category === "Cardio") cardioSets += sets;
      else if (ex.category === "Strength" || ex.category === "Calisthenics") strengthSets += sets;
    }
  }
  const total = strengthSets + cardioSets;
  if (total === 0) return { strength: 0, cardio: 0 };
  const strength = roundTo5((strengthSets / total) * 100);
  return { strength, cardio: 100 - strength };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkoutDetailPage() {
  const { success: showToast } = useToast();
  const { dict } = useDictionary();
  const t = dict.workouts.detail;
  const w = dict.workouts;
  const training = dict.training;
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  const [editingExercise, setEditingExercise] = useState<RoutineExercise | null>(null);
  const [videoExercise, setVideoExercise] = useState<VideoExercise | null>(null);

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
            exercise:exercises ( image_url, video_url, category, muscle_group )
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
              const exData = Array.isArray(ex.exercise) ? ex.exercise[0] : ex.exercise;
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
                muscle_group: exData?.muscle_group ?? null,
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

  async function handleDelete() {
    const supabase = createClient();
    const { error } = await supabase.from("workouts").delete().eq("id", params.id);
    if (!error) {
      router.push("/workouts");
    }
  }

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
  const objectives = objectivesForGoal(workout.goal);
  const results = expectedResultsForGoal(workout.goal);
  const muscles = getTopMuscles(workout);
  const strengthCardio = getStrengthCardioPct(workout);

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

            <p className="mt-3 text-sm text-zinc-500">
              {[
                workout.duration ? `${workout.duration} min` : null,
                `${workout.workout_days.length} ${t.daysSuffix ?? "días"}`,
                `${totalExercises} ${t.exercisesSuffixShort ?? "ejercicios"}`,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {totalExercises > 0 ? (
              <Link
                href={`/training/start?workout=${workout.id}`}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
              >
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

        {/* Grid 2 columnas: Objetivos + Músculos | Resultados esperados */}
        {(objectives.length > 0 || results.length > 0 || muscles.length > 0) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Izquierda: Objetivos + Músculos */}
            <div className="flex flex-col gap-4">
              {objectives.length > 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-zinc-900">{t.objectivesTitle}</p>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {objectives.map((obj) => (
                      <li key={obj} className="flex items-start gap-2 text-sm text-zinc-700">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" aria-hidden="true" />
                        <span>{obj}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

                            {muscles.length > 0 && (
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-semibold text-zinc-900">{t.musclesTitle}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {muscles.map((m) => (
                      <span
                        key={m}
                        className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                      >
                        {muscleLabel(m, training)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Derecha: Resultados esperados */}
            {results.length > 0 && (
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-zinc-900">{t.resultsTitle}</p>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {results.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-zinc-700">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-zinc-400" aria-hidden="true" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Balance de entrenamiento (Strength/Cardio bar) */}
        <StrengthCardioBar
          strengthPct={strengthCardio.strength}
          cardioPct={strengthCardio.cardio}
          labels={{
            title: t.balanceTitle,
            strength: t.statsStrength,
            cardio: t.statsCardio,
          }}
        />

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
