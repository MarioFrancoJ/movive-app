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

// ── Helpers (exported so callers can reuse them) ──────────────────────────────

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
}

export default function WorkoutCard({ workout, href, t }: WorkoutCardProps) {
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
