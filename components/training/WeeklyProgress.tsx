"use client";

import NavIcon from "@/components/ui/NavIcon";
import KpiCard from "@/components/ui/KpiCard";

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
      {/* Section header */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900">{labels.title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{labels.subtitle}</p>
      </div>

      {/* KPIs — using the unified KpiCard component */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          icon={<NavIcon name="workout-complete.svg" className="h-5 w-5 text-success" />}
          label={labels.workoutsCompleted}
          value={String(workoutsCompleted)}
          sub={labels.workoutsCompletedSub}
        />
        <KpiCard
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-blue-600">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
            </svg>
          }
          label={labels.totalTime}
          value={formatDuration(totalTimeMinutes)}
          sub={labels.totalTimeSub}
        />
        <KpiCard
          icon={
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-orange-500">
              <path fillRule="evenodd" d="M13.5 4.938a7 7 0 1 1-9.006 1.737c.202-.257.59-.218.793.039.278.352.594.672.943.954.332.269.786-.049.773-.476a5.977 5.977 0 0 1 .572-2.759 6.026 6.026 0 0 1 2.486-2.665c.247-.14.55-.016.677.238A6.967 6.967 0 0 0 13.5 4.938ZM14 12a4 4 0 0 1-4 4c-1.913 0-3.52-1.398-3.876-3.384l-.022-.11a4.001 4.001 0 0 1 7.898.494Z" clipRule="evenodd" />
            </svg>
          }
          label={labels.currentStreak}
          value={String(currentStreak)}
          sub={labels.currentStreakSub}
        />
      </div>
    </div>
  );
}
