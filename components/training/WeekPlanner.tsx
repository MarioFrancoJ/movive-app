"use client";

import { useState, useMemo } from "react";
import DayCard, { type DayName, type DayVariant } from "./DayCard";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeekPlannerProps {
  /** Localized labels passed in from the parent. */
  labels: {
    title: string;
    prevWeek: string;
    nextWeek: string;
    today: string;
    addWorkout: string;
    restDay: string;
    planned: string;
    completed: string;
    min: string;
  };
  /** Weekday abbreviations in order Mon→Sun. */
  weekdayLabels: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS: DayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Monday of the week containing `date`. */
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Shift a date by ±7*n days. */
function shiftWeek(monday: Date, weeks: number): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

/** Format "Apr 21 – Apr 27, 2025" for a Monday→Sunday range. */
function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = monday.toLocaleDateString("en-US", opts);
  const endStr = sunday.toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}, ${sunday.getFullYear()}`;
}

/** Short date label "Apr 21" for a given day. */
function formatDayDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeekPlanner({ labels, weekdayLabels }: WeekPlannerProps) {
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));

  const isCurrentWeek = useMemo(() => {
    const today = getMonday(new Date());
    return today.getTime() === monday.getTime();
  }, [monday]);

  const weekRange = useMemo(() => formatWeekRange(monday), [monday]);

  const dayDates = useMemo(() => {
    return DAYS.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [monday]);

  function goPrev() {
    setMonday((m) => shiftWeek(m, -1));
  }
  function goNext() {
    setMonday((m) => shiftWeek(m, 1));
  }
  function goToday() {
    setMonday(getMonday(new Date()));
  }

  // Placeholder variants — all empty until we add persistence.
  const getVariant = (_day: DayName): DayVariant => "empty";

  return (
    <div className="flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 px-6 py-5">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">{labels.title}</h2>
          <p className="mt-1 text-sm text-zinc-400">{weekRange}</p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={goPrev}
            aria-label={labels.prevWeek}
            title={labels.prevWeek}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
            </svg>
          </button>

          <button
            type="button"
            onClick={goToday}
            disabled={isCurrentWeek}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {labels.today}
          </button>

          <button
            type="button"
            onClick={goNext}
            aria-label={labels.nextWeek}
            title={labels.nextWeek}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {DAYS.map((day, i) => (
          <DayCard
            key={day}
            day={day}
            date={formatDayDate(dayDates[i])}
            dayLabel={weekdayLabels[i] ?? day.slice(0, 3)}
            variant={getVariant(day)}
            labels={{
              addWorkout: labels.addWorkout,
              restDay: labels.restDay,
              planned: labels.planned,
              completed: labels.completed,
              min: labels.min,
            }}
          />
        ))}
      </div>
    </div>
  );
}
