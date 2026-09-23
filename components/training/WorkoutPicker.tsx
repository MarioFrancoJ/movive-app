"use client";

import { useState, useEffect, useMemo, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkoutPickerItem {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  difficulty: string | null;
  duration: number | null;
  exerciseCount: number;
}

export interface WorkoutPickerProps {
  workouts: WorkoutPickerItem[];
  dayLabel: string;
  labels: {
    title: string;
    searchPlaceholder: string;
    noMatch: string;
    countSummary: string;
    all: string;
  };
  onSelect: (workoutId: string) => void;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function goalBadgeColor(goal: string | null): string {
  switch (goal) {
    case "Strength":     return "bg-purple-50 text-purple-700";
    case "Hypertrophy":  return "bg-blue-50 text-blue-700";
    case "Calisthenics": return "bg-teal-50 text-teal-700";
    case "Mobility":     return "bg-emerald-50 text-emerald-700";
    case "Fat Loss":     return "bg-rose-50 text-rose-700";
    case "Endurance":    return "bg-orange-50 text-orange-700";
    default:             return "bg-zinc-100 text-zinc-600";
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WorkoutPicker({
  workouts,
  dayLabel,
  labels,
  onSelect,
  onClose,
}: WorkoutPickerProps) {
  const [query, setQuery] = useState("");
  const [goalFilter, setGoalFilter] = useState<string>("All");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const goals = useMemo(
    () => Array.from(new Set(workouts.map((w) => w.goal).filter(Boolean) as string[])),
    [workouts]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workouts.filter((w) => {
      const matchesQuery = !q || w.name.toLowerCase().includes(q);
      const matchesGoal = goalFilter === "All" || w.goal === goalFilter;
      return matchesQuery && matchesGoal;
    });
  }, [workouts, query, goalFilter]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header + search */}
        <div className="border-b border-zinc-100 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-zinc-900">{labels.title}</h2>
              <p className="text-xs text-zinc-400">{dayLabel}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
          <div className="relative">
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={labels.searchPlaceholder}
              className="h-11 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200 sm:h-10"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(["All", ...goals] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGoalFilter(g)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  goalFilter === g
                    ? "bg-primary text-white"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
                ].join(" ")}
              >
                {g === "All" ? labels.all : g}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-400">
              {labels.noMatch.replace("{query}", query)}
            </p>
          ) : (
            <ul className="flex flex-col">
              {filtered.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(w.id)}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-zinc-50"
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">
                      🏋️
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900">
                        {w.name}
                      </span>
                      {w.description && (
                        <span className="block truncate text-xs text-zinc-400">
                          {w.description}
                        </span>
                      )}
                      <span className="mt-0.5 block text-xs text-zinc-400">
                        {w.exerciseCount} ex · {w.duration ?? 0} min
                      </span>
                    </span>
                    {w.goal && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${goalBadgeColor(w.goal)}`}>
                        {w.goal}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-zinc-100 px-4 py-2 text-center text-xs text-zinc-400">
          {labels.countSummary
            .replace("{x}", String(filtered.length))
            .replace("{y}", String(workouts.length))}
        </div>
      </div>
    </div>
  );
}
