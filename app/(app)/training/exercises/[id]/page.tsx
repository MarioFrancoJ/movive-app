"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type Difficulty = "Beginner" | "Intermediate" | "Advanced";
type ExerciseCategory = "Strength" | "Calisthenics" | "Cardio" | "Mobility" | "Flexibility";
type MuscleGroup = "Chest" | "Back" | "Shoulders" | "Biceps" | "Triceps" | "Forearms" | "Core" | "Glutes" | "Quadriceps" | "Hamstrings" | "Calves" | "Full Body";

type ExercisesDict = ReturnType<typeof useDictionary>["dict"]["training"]["exercises"];
type WorkoutsDict = ReturnType<typeof useDictionary>["dict"]["workouts"];

interface Exercise {
  id: string;
  name: string;
  description: string;
  category: string;
  muscleGroup: string;
  equipment: string;
  difficulty: Difficulty;
  instructions: string[];
  tips: string[];
  commonMistakes: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function difficultyColor(d: Difficulty): string {
  switch (d) {
    case "Beginner":     return "bg-success-light text-success";
    case "Intermediate": return "bg-amber-50 text-amber-700";
    case "Advanced":     return "bg-red-50 text-red-700";
  }
}

// Localized labels. English values stay the logic keys (match the DB enums);
// the dictionary maps them to the display language. Unknown values fall back
// to the raw value so nothing ever renders blank.
function categoryLabel(category: string, t: ExercisesDict): string {
  switch (category as ExerciseCategory) {
    case "Strength":     return t.categoryStrength;
    case "Calisthenics": return t.categoryCalisthenics;
    case "Cardio":       return t.categoryCardio;
    case "Mobility":     return t.categoryMobility;
    case "Flexibility":  return t.categoryFlexibility;
    default:             return category;
  }
}

function muscleLabel(muscle: string, t: ExercisesDict): string {
  return t.muscles[muscle as MuscleGroup] ?? muscle;
}

function difficultyLabel(d: Difficulty, w: WorkoutsDict): string {
  switch (d) {
    case "Beginner":     return w.difficultyBeginner;
    case "Intermediate": return w.difficultyIntermediate;
    case "Advanced":     return w.difficultyAdvanced;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExerciseDetailPage() {
  const { dict } = useDictionary();
  const t = dict.training.exerciseDetail;
  const et = dict.training.exercises;
  const w = dict.workouts;
  const params = useParams<{ id: string }>();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadExercise() {
      const supabase = createClient();
      const { data } = await supabase
        .from("exercises")
        .select("id, name, description, category, muscle_group, equipment, difficulty, instructions, tips, common_mistakes")
        .eq("id", params.id)
        .single();

      if (data) {
        setExercise({
          id: data.id,
          name: data.name,
          description: data.description || "",
          category: data.category,
          muscleGroup: data.muscle_group,
          equipment: data.equipment,
          difficulty: data.difficulty as Difficulty,
          instructions: Array.isArray(data.instructions) ? data.instructions as string[] : [],
          tips: Array.isArray(data.tips) ? data.tips as string[] : [],
          commonMistakes: Array.isArray(data.common_mistakes) ? data.common_mistakes as string[] : [],
        });
      }
      setLoading(false);
    }
    loadExercise();
  }, [params.id]);

  if (loading) {
    return (
      <PageLoader text={t.loading} />
    );
  }

  if (!exercise) {
    return (
      <div className="flex flex-col gap-6">
        <Link href="/training/exercises" className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 hover:text-zinc-900">
          {t.backToExercises}
        </Link>
        <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 bg-white">
          <p className="text-sm text-zinc-400">{t.notFound}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link href="/training/exercises" className="inline-flex items-center gap-1 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900">
        {t.backToExercises}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{exercise.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">{exercise.description}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{categoryLabel(exercise.category, et)}</span>
          <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">{muscleLabel(exercise.muscleGroup, et)}</span>
          <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">{exercise.equipment}</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${difficultyColor(exercise.difficulty)}`}>{difficultyLabel(exercise.difficulty, w)}</span>
        </div>
      </div>

      {/* Image/Video placeholder */}
      <div className="flex h-48 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50">
        <div className="flex flex-col items-center gap-2 text-zinc-400">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-10 w-10" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <path d="m9.5 9 5 3-5 3V9Z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs font-medium">{t.demonstration}</span>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Instructions */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">{t.instructions}</h2>
          {exercise.instructions.length > 0 ? (
            <ol className="flex flex-col gap-3">
              {exercise.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-zinc-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{i + 1}</span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-zinc-400">{t.noInstructions}</p>
          )}
        </div>

        {/* Tips */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">{t.tips}</h2>
          {exercise.tips.length > 0 ? (
            <ul className="flex flex-col gap-2.5">
              {exercise.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-700">
                  <span className="mt-0.5 text-success">✓</span>
                  {tip}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-400">{t.noTips}</p>
          )}
        </div>
      </div>

      {/* Common Mistakes */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-zinc-400">{t.commonMistakes}</h2>
        {exercise.commonMistakes.length > 0 ? (
          <ul className="flex flex-col gap-2.5">
            {exercise.commonMistakes.map((mistake, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-700">
                <span className="mt-0.5 text-red-500">✗</span>
                {mistake}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-400">{t.noData}</p>
        )}
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-zinc-900">{exercise.equipment}</p>
          <p className="text-xs text-zinc-400">{t.equipment}</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-zinc-900">{difficultyLabel(exercise.difficulty, w)}</p>
          <p className="text-xs text-zinc-400">{t.difficulty}</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-zinc-900">{categoryLabel(exercise.category, et)}</p>
          <p className="text-xs text-zinc-400">{t.category}</p>
        </div>
      </div>

      {/* Add to Workout */}
      <div>
        <Link href="/training/workout-builder"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
          {t.addToWorkout}
        </Link>
      </div>
    </div>
  );
}
