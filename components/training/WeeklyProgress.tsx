"use client";

import NavIcon from "@/components/ui/NavIcon";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeeklyProgressProps {
  workoutsCompleted: number;
  totalTimeMinutes: number;
  currentStreak: number;
  labels: {
    title: string;
    subtitle: string;
    workoutsCompleted: string;
    workoutsCompletedSub: string;
    totalTime: string;
    totalTimeSub: string;
    currentStreak: string;
    currentStreakSub: string;
  };
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeeklyProgress({
  workoutsCompleted,
  totalTimeMinutes,
  currentStreak,
  labels,
  className = "",
}: WeeklyProgressProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Section header — sin card */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900">{labels.title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{labels.subtitle}</p>
      </div>

      {/* KPIs — cards sueltas, SIN card contenedor, como Meal Planner */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Workouts Completed */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-4 text-center shadow-sm">
          <NavIcon name="workout-complete.svg" className="h-5 w-5 text-success" aria-hidden="true" />
          <p className="mt-2 text-2xl font-bold leading-none text-zinc-900">
            {workoutsCompleted}
          </p>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {labels.workoutsCompleted}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{labels.workoutsCompletedSub}</p>
        </div>

        {/* Total Time */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-4 text-center shadow-sm">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-blue-600" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
          </svg>
          <p className="mt-2 text-2xl font-bold leading-none text-zinc-900">
            {formatDuration(totalTimeMinutes)}
          </p>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {labels.totalTime}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{labels.totalTimeSub}</p>
        </div>

        {/* Current Streak */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white px-4 py-4 text-center shadow-sm">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-orange-500" aria-hidden="true">
            <path fillRule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039.278.352.594.672.943.954.332.269.786-.049.773-.476a5.977 5.977 0 0 1 .572-2.759 6.026 6.026 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.967 6.967 0 0 0 13.5 4.938ZM14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.876-3.384l-.022-.11a4.001 4.001 0 0 1 7.898.494Z" clipRule="evenodd" />
          </svg>
          <p className="mt-2 text-2xl font-bold leading-none text-zinc-900">
            {currentStreak}
          </p>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {labels.currentStreak}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{labels.currentStreakSub}</p>
        </div>
      </div>
    </div>
  );
}
