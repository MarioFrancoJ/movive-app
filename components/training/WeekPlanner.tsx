"use client";

import { useState, useMemo } from "react";
import DayCard, { type DayName, type DayVariant } from "./DayCard";
import WeekDayHeader from "@/components/ui/WeekDayHeader";
// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeekPlannerProps {
  labels: {
    title: string;
    prevWeek: string;
    nextWeek: string;
    today: string;
    currentWeek: string;
    goToCurrentWeek: string;
    addWorkout: string;
    restDay: string;
    planned: string;
    completed: string;
    min: string;
  };
  weekdayLabels: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS: DayName[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function shiftWeek(monday: Date, weeks: number): Date {
  const d = new Date(monday);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function formatWeekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = monday.toLocaleDateString("en-US", opts);
  const endStr = sunday.toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}, ${sunday.getFullYear()}`;
}

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

  function goPrev() { setMonday((m) => shiftWeek(m, -1)); }
  function goNext() { setMonday((m) => shiftWeek(m, 1)); }
  function goToday() { setMonday(getMonday(new Date())); }

  const getVariant = (_day: DayName): DayVariant => "empty";

  return (
    <div className="flex flex-col gap-4">
      {/* ── Week navigation ── */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={goPrev}
          aria-label={labels.prevWeek}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          <span className="hidden sm:inline">{labels.prevWeek}</span>
        </button>

        <div className="flex items-center gap-2 text-center">
          <span className="text-sm font-semibold text-zinc-900">{weekRange}</span>
          {isCurrentWeek ? (
            <span className="rounded-full bg-success-light px-2 py-0.5 text-xs font-medium text-success">
              {labels.currentWeek}
            </span>
          ) : (
            <button
              type="button"
              onClick={goToday}
              className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
              </svg>
              {labels.goToCurrentWeek}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={goNext}
          aria-label={labels.nextWeek}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
        >
          <span className="hidden sm:inline">{labels.nextWeek}</span>
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

     {/* Header row: shared WeekDayHeader component */}
<div className="grid grid-cols-7 gap-3 px-1 pb-2">
  {DAYS.map((day, i) => (
    <WeekDayHeader
      key={day}
      dayLabel={weekdayLabels[i] ?? day.slice(0, 3)}
      dateLabel={formatDayDate(dayDates[i])}
      // menu + onMenuToggle + menuOpen: reserved for future day actions
    />
  ))}
</div>

          {/* Cards row */}
          <div className="grid grid-cols-7 gap-3">
            {DAYS.map((day) => (
              <DayCard
                key={day}
                day={day}
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
      </div>
    </div>
  );
}
