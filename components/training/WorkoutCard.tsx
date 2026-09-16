"use client";

import Link from "next/link";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type WorkoutsDict = ReturnType<typeof useDictionary>["dict"]["workouts"];

export type WorkoutGoal = "Fat Loss" | "Muscle Gain" | "Strength" | "Endurance" | "Mobility" | "General Fitness";
export type WorkoutDifficulty = "Beginner" | "Intermediate" | "Advanced";

export interface WorkoutItem {
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

export function difficultyColor(d: WorkoutDifficulty | null): string {
  switch (d) {
    case "Beginner":     return "bg-success-light text-success";
    case "Intermediate": return "bg-amber-50 text-amber-700";
    case "Advanced":     return "bg-red-50 text-red-700";
    default:             return "bg-zinc-100 text-zinc-600";
  }
}

export function goalColor(g: WorkoutGoal | null): string {
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

export function goalLabel(g: WorkoutGoal | null, t: WorkoutsDict): string {
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

export function difficultyLabel(d: WorkoutDifficulty | null, t: WorkoutsDict): string {
  switch (d) {
    case "Beginner":     return t.difficultyBeginner;
    case "Intermediate": return t.difficultyIntermediate;
    case "Advanced":     return t.difficultyAdvanced;
    default:             return d ?? "";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

interface WorkoutCardProps {
  workout: WorkoutItem;
  href: string;
  t: WorkoutsDict;
  /** Optional handler for the "Edit" action (currently visual-only). */
  onEdit?: () => void;
}

export default function WorkoutCard({ workout, href, t, onEdit }: WorkoutCardProps) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Body */}
      <Link href={href} className="flex flex-1 flex-col p-5">
        {/* Title + difficulty badge */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 line-clamp-2">{workout.name}</h3>
          {workout.difficulty && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${difficultyColor(workout.difficulty)}`}>
              {difficultyLabel(workout.difficulty, t)}
            </span>
          )}
        </div>

        {/* Description */}
        {workout.description && (
          <p className="mb-3 text-xs text-zinc-400 line-clamp-2">{workout.description}</p>
        )}

        {/* Meta — category + exercises + duration */}
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
          {workout.goal && (
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${goalColor(workout.goal)}`}>
              {goalLabel(workout.goal, t)}
            </span>
          )}
          <span className="text-xs text-zinc-400">
            {workout.exerciseCount} {t.exerciseSuffixShort ?? "ex."}
          </span>
          {workout.duration && <span className="text-xs text-zinc-400">{workout.duration} {t.unitMin}</span>}
        </div>
      </Link>

      {/* Actions */}
      <div className="flex items-stretch gap-2 border-t border-zinc-100 p-3">
        <Link
          href={href}
          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
        >
          {t.view ?? "View"}
        </Link>
        <button
          type="button"
          onClick={onEdit}
          disabled={!onEdit}
          className="inline-flex min-h-[40px] flex-1 items-center justify-center rounded-lg bg-primary px-3 text-xs font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t.edit ?? "Edit"}
        </button>
      </div>
    </div>
  );
}
