"use client";

import { useState, useEffect } from "react";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExerciseOption {
  id: string;
  name: string;
  muscle_group: string;
}

interface BuilderExercise {
  tempId: string;
  exerciseId: string;
  name: string;
  sets: number;
  reps: number;
  restSeconds: number;
  notes: string;
}

interface SavedWorkout {
  id: string;
  name: string;
  exerciseCount: number;
  createdAt: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkoutBuilderView() {
  const { dict } = useDictionary();
  const nt = dict.workouts.new;
  const wb = dict.training.workoutBuilder;
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [workoutName, setWorkoutName] = useState("My Workout");
  const [selectedExercises, setSelectedExercises] = useState<BuilderExercise[]>([]);
  const [history, setHistory] = useState<SavedWorkout[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // ── Load exercises + user workouts from Supabase ──────────────────────────

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Load exercise options for dropdown
      const { data: exerciseData } = await supabase
        .from("exercises")
        .select("id, name, muscle_group")
        .order("name");

      if (exerciseData) {
        setExercises(exerciseData);
      }

      // Load user's saved workouts (non-template)
      const { data: workoutData } = await supabase
        .from("workouts")
        .select("id, name, created_at, workout_days(workout_exercises(id))")
        .eq("user_id", user.id)
        .eq("is_template", false)
        .order("created_at", { ascending: false });

      if (workoutData) {
        setHistory(
          workoutData.map((w) => ({
            id: w.id,
            name: w.name,
            exerciseCount: w.workout_days?.reduce(
              (sum: number, d: { workout_exercises: { id: string }[] }) => sum + (d.workout_exercises?.length || 0), 0
            ) || 0,
            createdAt: new Date(w.created_at).toLocaleDateString("en-US", {
              year: "numeric", month: "short", day: "numeric",
            }),
          }))
        );
      }

      setLoading(false);
    }

    loadData();
  }, []);

  // ── Exercise Management ───────────────────────────────────────────────────

  function handleAddExercise(exerciseId: string) {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    const newExercise: BuilderExercise = {
      tempId: crypto.randomUUID(),
      exerciseId: ex.id,
      name: ex.name,
      sets: 3,
      reps: 10,
      restSeconds: 60,
      notes: "",
    };

    setSelectedExercises((prev) => [...prev, newExercise]);
  }

  function handleRemoveExercise(tempId: string) {
    setSelectedExercises((prev) => prev.filter((e) => e.tempId !== tempId));
  }

  function handleExerciseChange(tempId: string, field: "sets" | "reps" | "restSeconds", value: number) {
    setSelectedExercises((prev) =>
      prev.map((ex) => (ex.tempId === tempId ? { ...ex, [field]: value } : ex))
    );
  }

  // ── Save Workout to Supabase ──────────────────────────────────────────────

  async function handleSave() {
    if (selectedExercises.length === 0) return;
    setError("");
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError(dict.common.errorNotAuthenticated);
      setSaving(false);
      return;
    }

    // 1. Create workout
    const { data: workout, error: workoutErr } = await supabase
      .from("workouts")
      .insert({
        user_id: user.id,
        name: workoutName.trim() || "My Workout",
        is_template: false,
        duration: selectedExercises.length * 10, // rough estimate
      })
      .select("id")
      .single();

    if (workoutErr || !workout) {
      setError(nt.errorCreating.replace("{msg}", workoutErr?.message || "unknown"));
      setSaving(false);
      return;
    }

    // 2. Create a single workout_day
    const { data: day, error: dayErr } = await supabase
      .from("workout_days")
      .insert({
        workout_id: workout.id,
        user_id: user.id,
        day_name: "Workout",
        sort_order: 0,
      })
      .select("id")
      .single();

    if (dayErr || !day) {
      setError(nt.errorCreatingDay.replace("{msg}", dayErr?.message || "unknown"));
      setSaving(false);
      return;
    }

    // 3. Create workout_exercises
    const exerciseInserts = selectedExercises.map((ex, i) => ({
      workout_day_id: day.id,
      user_id: user.id,
      exercise_id: ex.exerciseId,
      exercise_name: ex.name,
      sets: ex.sets,
      reps: ex.reps,
      rest_seconds: ex.restSeconds,
      notes: ex.notes || null,
      sort_order: i,
    }));

    const { error: exErr } = await supabase
      .from("workout_exercises")
      .insert(exerciseInserts);

    if (exErr) {
      setError(nt.errorSavingExercises.replace("{msg}", exErr.message));
      setSaving(false);
      return;
    }

    // Success — update local state
    setHistory((prev) => [
      {
        id: workout.id,
        name: workoutName.trim() || "My Workout",
        exerciseCount: selectedExercises.length,
        createdAt: new Date().toLocaleDateString("en-US", {
          year: "numeric", month: "short", day: "numeric",
        }),
      },
      ...prev,
    ]);

    setSelectedExercises([]);
    setWorkoutName("My Workout");
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // ── Delete Workout ────────────────────────────────────────────────────────

  async function handleDeleteWorkout(workoutId: string) {
    const supabase = createClient();
    const { error: delErr } = await supabase
      .from("workouts")
      .delete()
      .eq("id", workoutId);

    if (!delErr) {
      setHistory((prev) => prev.filter((w) => w.id !== workoutId));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageLoader text={wb.loading} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{wb.title}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {wb.subtitle}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3" role="alert">
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {/* Workout name + exercise selector */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-64">
          <label htmlFor="workout-name" className="mb-1.5 block text-sm font-medium text-zinc-700">
            {wb.workoutName}
          </label>
          <input
            id="workout-name"
            type="text"
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          />
        </div>

        <div className="w-64">
          <label htmlFor="add-exercise" className="mb-1.5 block text-sm font-medium text-zinc-700">
            {wb.addExercise}
          </label>
          <select
            id="add-exercise"
            value=""
            onChange={(e) => {
              handleAddExercise(e.target.value);
              e.target.value = "";
            }}
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          >
            <option value="" disabled>{wb.selectExercise}</option>
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {wb.exerciseOption.replace("{name}", ex.name).replace("{muscle}", ex.muscle_group)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected exercises */}
      {selectedExercises.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-zinc-200 bg-white shadow-sm">
          <p className="text-sm text-zinc-400">{wb.emptyExercises}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {selectedExercises.map((ex, exIndex) => (
            <div key={ex.tempId} className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
                    {exIndex + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-zinc-900">{ex.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveExercise(ex.tempId)}
                  className="text-xs font-medium text-zinc-400 transition-colors hover:text-red-600"
                >
                  {dict.common.remove}
                </button>
              </div>

              {/* Sets/Reps/Rest config */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-500">{nt.sets}</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={ex.sets}
                    onChange={(e) => handleExerciseChange(ex.tempId, "sets", parseInt(e.target.value) || 1)}
                    className="h-8 w-16 rounded border border-zinc-200 px-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-500">{nt.reps}</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={ex.reps}
                    onChange={(e) => handleExerciseChange(ex.tempId, "reps", parseInt(e.target.value) || 1)}
                    className="h-8 w-16 rounded border border-zinc-200 px-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-200"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-zinc-500">{nt.restS}</label>
                  <input
                    type="number"
                    min={0}
                    max={600}
                    step={15}
                    value={ex.restSeconds}
                    onChange={(e) => handleExerciseChange(ex.tempId, "restSeconds", parseInt(e.target.value) || 0)}
                    className="h-8 w-20 rounded border border-zinc-200 px-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-200"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save button */}
      {selectedExercises.length > 0 && (
        <div className="flex items-center gap-4">
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? dict.common.saving : wb.saveWorkout}
          </Button>
          {saved && (
            <span className="text-sm font-medium text-success">{wb.savedNotice}</span>
          )}
        </div>
      )}

      {/* Saved workouts history */}
      {history.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-6 py-4">
            <p className="text-sm font-semibold text-zinc-700">
              {wb.savedWorkoutsCount.replace("{n}", String(history.length))}
            </p>
          </div>
          <ul className="divide-y divide-zinc-100">
            {history.map((w) => (
              <li key={w.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{w.name}</p>
                  <p className="text-xs text-zinc-400">
                    {wb.exerciseSuffix.replace("{n}", String(w.exerciseCount))} · {w.createdAt}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteWorkout(w.id)}
                  className="text-xs font-medium text-zinc-400 transition-colors hover:text-red-600"
                >
                  {dict.common.delete}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
