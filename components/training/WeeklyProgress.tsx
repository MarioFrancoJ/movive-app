"use client";

import NavIcon from "@/components/ui/NavIcon";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeeklyProgressProps {
  /** Number of completed training sessions this week. */
  workoutsCompleted: number;
  /** Total training time this week, in minutes. */
  totalTimeMinutes: number;
  /** Current consecutive-day workout streak. */
  currentStreak: number;
  /** Localized labels passed in from the parent. */
  labels: {
    title: string;               // "Weekly Progress"
    subtitle: string;            // "This week's training summary"
    workoutsCompleted: string;   // "Completed"
    totalTime: string;           // "Total Time"
    currentStreak: string;       // "Day Streak"
    dayPlural: string;           // "Day" (used as "Day Streak")
  };
  className?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format minutes → "3h 15m" | "45m" | "0m". */
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
    <div className={`rounded-xl border border-zinc-200 bg-white p-5 shadow-sm ${className}`}>
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-zinc-900">{labels.title}</h2>
        <p className="mt-0.5 text-xs text-zinc-400">{labels.subtitle}</p>
      </div>

      {/* KPIs — 3 columns, responsive to 1 column on mobile */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Workouts Completed */}
        <div className="flex items-center gap-3 rounded-lg bg-zinc-50 px-4 py-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm"
            aria-hidden="true"
          >
            <NavIcon name="workout-complete.svg" className="h-4 w-4 text-success" />
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-none text-zinc-900">
              {workoutsCompleted}
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-400">
              {labels.workoutsCompleted}
            </p>
          </div>
        </div>

        {/* Total Time */}
        <div className="flex items-center gap-3 rounded-lg bg-zinc-50 px-4 py-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm"
            aria-hidden="true"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-blue-600">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-none text-zinc-900">
              {formatDuration(totalTimeMinutes)}
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-400">
              {labels.totalTime}
            </p>
          </div>
        </div>

        {/* Current Streak */}
        <div className="flex items-center gap-3 rounded-lg bg-zinc-50 px-4 py-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm"
            aria-hidden="true"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-orange-500">
              <path fillRule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039.278.352.594.672.943.954.332.269.786-.049.773-.476a5.977 5.977 0 0 1 .572-2.759 6.026 6.026 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.967 6.967 0 0 0 13.5 4.938ZM14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.876-3.384l-.022-.11a4.001 4.001 0 0 1 7.898.494Z" clipRule="evenodd" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-lg font-bold leading-none text-zinc-900">
              {currentStreak}
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-400">
              {labels.currentStreak}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
