"use client";

import Link from "next/link";
import NavIcon from "@/components/ui/NavIcon";
import KpiCard from "@/components/ui/KpiCard";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NextWorkoutInfo {
  workoutName: string;
  /** Ya traducido: "Hoy", "Mañana", "Jueves", etc. */
  dayLabel: string;
}

export interface WeeklyProgressProps {
  workoutsCompleted: number;
  workoutsPlanned: number;
  totalTimeMinutes: number;
  currentStreak: number;
  nextWorkout: NextWorkoutInfo | null;
  labels: {
    title: string;
    subtitle: string;
    workoutsCompleted: string;
    workoutsCompletedSub: string;      // "Esta semana"
    workoutsCompletedPct: string;      // "{n}% completado"
    totalTime: string;
    totalTimeSub: string;
    currentStreak: string;
    currentStreakSub: string;
    nextWorkout: string;               // "Próximo entrenamiento"
    nextWorkoutNone: string;           // "Sin entrenamiento planificado"
    nextWorkoutCta: string;            // "Planificar entrenamiento"
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
  workoutsPlanned,
  totalTimeMinutes,
  currentStreak,
  nextWorkout,
  labels,
  className = "",
}: WeeklyProgressProps) {
  // Adherencia semanal
  const pct = workoutsPlanned > 0
    ? Math.round((workoutsCompleted / workoutsPlanned) * 100)
    : 0;

  const completedValue = `${workoutsCompleted} / ${workoutsPlanned}`;
  const completedSub = labels.workoutsCompletedPct.replace("{n}", String(pct));

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Section header */}
      <div>
        <h2 className="text-lg font-bold text-zinc-900">{labels.title}</h2>
        <p className="mt-1 text-sm text-zinc-400">{labels.subtitle}</p>
      </div>

      {/* KPIs — 4 cards en línea */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<NavIcon name="workout-complete.svg" className="h-5 w-5 text-success" />}
          label={labels.workoutsCompleted}
          value={completedValue}
          sub={completedSub}
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

        {/* KPI 4 — Próximo entrenamiento (con variante CTA si no hay) */}
        {nextWorkout ? (
          <KpiCard
            icon={
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-purple-600">
                <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" />
              </svg>
            }
            label={labels.nextWorkout}
            value={nextWorkout.workoutName}
            sub={nextWorkout.dayLabel}
          />
        ) : (
          <Link
            href="/workouts"
            className="group flex items-center gap-golden-3 rounded-golden-lg border border-dashed border-zinc-300 bg-white px-golden-3 py-golden-2 shadow-sm transition-all hover:border-zinc-400 hover:bg-zinc-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-golden-md bg-zinc-100 text-golden-md">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-zinc-400">
                <path d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-golden-xs font-bold uppercase tracking-widest text-zinc-400">
                {labels.nextWorkout}
              </p>
              <p className="mt-golden-1 truncate text-golden-base font-bold text-zinc-900">
                {labels.nextWorkoutNone}
              </p>
              <p className="truncate text-golden-xs text-zinc-500">
                {labels.nextWorkoutCta}
              </p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
