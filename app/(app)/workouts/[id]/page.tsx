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
            id, exercise_id, exercise_name, sets, reps, rest_seconds, notes, sort_order
          )
        )
      `)
      .eq("id", params.id)
      .single();

    if (!error && data) {
      const sortedDays = (data.workout_days || [])
        .sort((a: WorkoutDay, b: WorkoutDay) => a.sort_order - b.sort_order)
        .map((day: WorkoutDay) => ({
          ...day,
          workout_exercises: (day.workout_exercises || [])
            .sort((a: WorkoutExercise, b: WorkoutExercise) => a.sort_order - b.sort_order),
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

  // ── Duplicate workout ──
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

  // ── Add exercise to a day ──
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

  // ── Remove exercise from a day ──
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

  return (
    <>
      <div className="flex flex-col gap-6">
        <Link href="/workouts" className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900">
          {t.backToWorkouts}
        </Link>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{workout.name}</h1>
            {workout.description && <p className="mt-1 text-sm text-zinc-500">{workout.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {workout.goal && <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${goalColor(workout.goal)}`}>{goalLabel(workout.goal, w)}</span>}
              {workout.difficulty && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${difficultyColor(workout.difficulty)}`}>{difficultyLabel(workout.difficulty, w)}</span>}
              {workout.duration && <span className="text-xs text-zinc-400">{workout.duration} min</span>}
              <span className="text-xs text-zinc-400">{totalExercises} exercises</span>
              <span className="text-xs text-zinc-400">{workout.workout_days.length} days</span>
            </div>
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

        {/* Workout Days */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workout.workout_days.map((day) => (
            <div key={day.id} className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-zinc-900">{dayLabel(day.day_name, w)}</p>
                            <RoutineDayCard
                exercises={day.workout_exercises}
                labels={{
                  restDay: t.restDay,
                  rest: "Descanso",
                  addExercise: t.addExercise,
                  removeExercise: t.removeExercise,
                  editExercise: t.editExercise,
                }}
                onAddExercise={() => setPickerDayId(day.id)}
                onRemoveExercise={handleRemoveExercise}
                onUpdateExercise={handleUpdateExercise}
                onOpenEditModal={(ex) => setEditingExercise(ex)}
              />
            </div>
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
    </>
  );
}
