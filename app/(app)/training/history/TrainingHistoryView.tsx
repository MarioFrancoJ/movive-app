"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import PageLoader from "@/components/ui/PageLoader";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

type StatusDict = ReturnType<typeof useDictionary>["dict"]["training"]["status"];

type FilterPeriod = "today" | "week" | "month" | "all";
type SessionStatus = "Completed" | "Cancelled" | "Abandoned" | "In Progress";

interface SetDetail {
  setNumber: number;
  completedReps: number;
  completedWeight: number;
  completed: boolean;
}

interface ExerciseDetail {
  exerciseName: string;
  sets: SetDetail[];
}

interface SessionRow {
  id: string;
  date: string;
  workout_name: string | null;
  duration_minutes: number | null;
  status: SessionStatus;
  exerciseCount: number;
  completedSets: number;
  totalSets: number;
  exercises: ExerciseDetail[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDateCutoff(filter: FilterPeriod): string | null {
  const now = new Date();
  switch (filter) {
    case "today": return now.toISOString().split("T")[0];
    case "week": { const d = new Date(now); d.setDate(now.getDate() - 7); return d.toISOString().split("T")[0]; }
    case "month": { const d = new Date(now); d.setDate(now.getDate() - 30); return d.toISOString().split("T")[0]; }
    default: return null;
  }
}

function statusBadge(status: SessionStatus, statusDict: StatusDict) {
  switch (status) {
    case "Completed":
      return { bg: "bg-success-light text-success", label: statusDict.completed };
    case "Cancelled":
      return { bg: "bg-red-50 text-red-700", label: statusDict.cancelled };
    case "Abandoned":
      return { bg: "bg-zinc-100 text-zinc-600", label: statusDict.abandoned };
    default:
      return { bg: "bg-amber-50 text-amber-700", label: statusDict.inProgress };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TrainingHistoryView() {
  const { dict } = useDictionary();
  const t = dict.training.history;
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [filter, setFilter] = useState<FilterPeriod>("all");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("training_sessions")
        .select(`
          id, date, workout_name, duration_minutes, status,
          session_exercise_logs(
            exercise_name, sort_order,
            session_set_logs(set_number, completed_reps, completed_weight, completed)
          )
        `)
        .eq("user_id", user.id)
        .neq("status", "In Progress")
        .order("date", { ascending: false });

      if (data) {
        setSessions(data.map((s) => {
          const logs = (s.session_exercise_logs || [])
            .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order);

          const exercises: ExerciseDetail[] = logs.map((ex: { exercise_name: string; session_set_logs: { set_number: number; completed_reps: number | null; completed_weight: number | null; completed: boolean }[] }) => ({
            exerciseName: ex.exercise_name,
            sets: (ex.session_set_logs || [])
              .sort((a: { set_number: number }, b: { set_number: number }) => a.set_number - b.set_number)
              .map((set) => ({
                setNumber: set.set_number,
                completedReps: set.completed_reps || 0,
                completedWeight: Number(set.completed_weight) || 0,
                completed: set.completed,
              })),
          }));

          const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
          const completedSets = exercises.reduce((sum, ex) => sum + ex.sets.filter((set) => set.completed).length, 0);

          return {
            id: s.id,
            date: s.date,
            workout_name: s.workout_name,
            duration_minutes: s.duration_minutes,
            status: s.status as SessionStatus,
            exerciseCount: exercises.length,
            completedSets,
            totalSets,
            exercises,
          };
        }));
      }

      setLoading(false);
    }

    loadHistory();
  }, []);

  const filtered = useMemo(() => {
    const cutoff = getDateCutoff(filter);
    if (!cutoff) return sessions;
    return sessions.filter((s) => s.date >= cutoff);
  }, [sessions, filter]);

  const filters: { label: string; value: FilterPeriod }[] = [
    { label: dict.common.filterToday, value: "today" },
    { label: dict.common.filterThisWeek, value: "week" },
    { label: dict.common.filterThisMonth, value: "month" },
    { label: dict.common.filterAllTime, value: "all" },
  ];

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  if (loading) {
    return <PageLoader text={t.loading} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t.sessionCount.replace("{n}", String(filtered.length))}
          </p>
        </div>
        <Link href="/training/start" className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover">
          {dict.training.startWorkout}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 w-fit">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={[
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300",
              filter === f.value ? "bg-primary text-white shadow-sm" : "text-zinc-500 hover:text-zinc-900",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Sessions list */}
      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-zinc-200 bg-white">
          <p className="text-sm text-zinc-400">{t.noSessions}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((s) => {
            const isExpanded = expandedId === s.id;
            const badge = statusBadge(s.status, dict.training.status);

            return (
              <div
                key={s.id}
                className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Row header — clickable to expand */}
                <button
                  type="button"
                  onClick={() => toggleExpand(s.id)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-zinc-50"
                >
                  {/* Chevron */}
                  <svg
                    className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-zinc-900">
                        {s.workout_name || t.customWorkout}
                      </p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                      <span>
                        {new Date(s.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                      <span>{s.duration_minutes || 0} min</span>
                      <span>{s.exerciseCount} exercise{s.exerciseCount !== 1 ? "s" : ""}</span>
                      <span>{s.completedSets}/{s.totalSets} sets</span>
                    </div>
                  </div>

                  {/* Detail link */}
                  <Link
                    href={`/training/session/${s.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-100"
                  >
                    {dict.common.details} →
                  </Link>
                </button>

                {/* Accordion content — exercise breakdown */}
                {isExpanded && (
                  <div className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-4">
                    {s.exercises.length === 0 ? (
                      <p className="text-xs text-zinc-400">{t.noExerciseData}</p>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {s.exercises.map((ex, exIdx) => {
                          const exCompletedSets = ex.sets.filter((set) => set.completed).length;
                          return (
                            <div key={exIdx} className="rounded-lg border border-zinc-200 bg-white p-3">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-zinc-900">{ex.exerciseName}</p>
                                <span className="text-xs text-zinc-400">
                                  {exCompletedSets}/{ex.sets.length} sets
                                </span>
                              </div>
                              {/* Set details */}
                              <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                                {ex.sets.map((set) => (
                                  <div
                                    key={set.setNumber}
                                    className={[
                                      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs",
                                      set.completed
                                        ? "bg-success-light text-success"
                                        : "bg-zinc-50 text-zinc-500",
                                    ].join(" ")}
                                  >
                                    <span className="font-semibold">{t.setLabel.replace("{n}", String(set.setNumber))}</span>
                                    <span className="text-zinc-400">·</span>
                                    <span>{set.completedReps} reps</span>
                                    {set.completedWeight > 0 && (
                                      <>
                                        <span className="text-zinc-400">·</span>
                                        <span>{set.completedWeight} kg</span>
                                      </>
                                    )}
                                    {set.completed && (
                                      <svg className="ml-auto h-3.5 w-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                      </svg>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
