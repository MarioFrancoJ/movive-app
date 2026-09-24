"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import DayCard, { type DayName, type DayVariant } from "./DayCard";
import WeekDayHeader from "@/components/ui/WeekDayHeader";
import WorkoutPicker, { type WorkoutPickerItem } from "./WorkoutPicker";
import ApplyTemplateModal from "./ApplyTemplateModal";
import { createClient } from "@/lib/supabase/client";
import { applyTemplateToPlanner, type PlannerMode } from "@/lib/training/planner";
import { useToast } from "@/components/ui/Toast";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeekPlannerProps {
  workouts: WorkoutPickerItem[];
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
    applyTemplate: string;
    picker: {
      title: string;
      searchPlaceholder: string;
      noMatch: string;
      countSummary: string;
      all: string;
    };
    confirm: {
      title: string;
      message: string;
      replace: string;
      fillEmpty: string;
      cancel: string;
    };
  };
  weekdayLabels: string[];
}

interface PlannerAssignment {
  day_of_week: DayName;
  workout_id: string;
  workout_name: string;
  workout_duration: number | null;
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

function mondayKey(monday: Date): string {
  return monday.toISOString().slice(0, 10);
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

export default function WeekPlanner({ workouts, labels, weekdayLabels }: WeekPlannerProps) {
  const { success: showToast } = useToast();
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));
  const [assignments, setAssignments] = useState<PlannerAssignment[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<DayName | null>(null);
  const [globalPickerOpen, setGlobalPickerOpen] = useState(false);
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  const isCurrentWeek = useMemo(() => {
    const today = getMonday(new Date());
    return today.getTime() === monday.getTime();
  }, [monday]);

  const weekRange = useMemo(() => formatWeekRange(monday), [monday]);
  const weekStart = useMemo(() => mondayKey(monday), [monday]);

  const dayDates = useMemo(() => {
    return DAYS.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [monday]);

  // ── Fetch planner assignments for the current week ──
  const loadWeek = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setWeekLoading(true);
    const { data: plannerRows, error } = await supabase
  .from("training_planner")
  .select("day_of_week, workout_id")
  .eq("user_id", user.id)
  .eq("week_start_date", weekStart);

if (error) {
  console.error("[WeekPlanner] planner fetch error:", error);
  setAssignments([]);
  setWeekLoading(false);
  return;
}

if (!plannerRows || plannerRows.length === 0) {
  setAssignments([]);
  setWeekLoading(false);
  return;
}

const workoutIds = plannerRows.map((r) => r.workout_id);
const { data: workoutRows, error: workoutError } = await supabase
  .from("workouts")
  .select("id, name, duration")
  .in("id", workoutIds);

if (workoutError) {
  console.error("[WeekPlanner] workouts fetch error:", workoutError);
  setAssignments([]);
  setWeekLoading(false);
  return;
}

const workoutMap = new Map((workoutRows ?? []).map((w) => [w.id, w]));
const mapped: PlannerAssignment[] = plannerRows.map((row) => {
  const w = workoutMap.get(row.workout_id);
  return {
    day_of_week: row.day_of_week as DayName,
    workout_id: row.workout_id,
    workout_name: w?.name ?? "Workout",
    workout_duration: w?.duration ?? null,
  };
});

setAssignments(mapped);
    setWeekLoading(false);
  }, [weekStart]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  // ── Week navigation ──
  function goPrev() { setMonday((m) => shiftWeek(m, -1)); }
  function goNext() { setMonday((m) => shiftWeek(m, 1)); }
  function goToday() { setMonday(getMonday(new Date())); }

  // ── Day helpers ──
  function getAssignment(day: DayName): PlannerAssignment | undefined {
    return assignments.find((a) => a.day_of_week === day);
  }

  function getVariant(day: DayName): DayVariant {
    return getAssignment(day) ? "planned" : "empty";
  }

  // ── Apply template handler ──
  async function runApply(templateId: string, mode: PlannerMode) {
    const res = await applyTemplateToPlanner(templateId, weekStart, mode);
    if (!res.ok) {
      showToast(`Error: ${res.error ?? "UNKNOWN"}`);
      return;
    }
    await loadWeek();
    showToast(`${res.plannerRowsCreated ?? 0} days assigned`);
  }

  // Cuando el picker selecciona un template
  async function handleTemplateSelected(templateId: string) {
    setGlobalPickerOpen(false);
    setPickerTarget(null);

    // Si la semana está vacía → aplica directo "replace"
    if (assignments.length === 0) {
      await runApply(templateId, "replace");
    } else {
      // Si ya hay workouts → abrir modal de confirmación
      setPendingTemplateId(templateId);
    }
  }

  async function handleModalConfirm(mode: PlannerMode) {
    if (!pendingTemplateId) return;
    const id = pendingTemplateId;
    setPendingTemplateId(null);
    await runApply(id, mode);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Week navigation ── */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={goPrev}
          aria-label={labels.prevWeek}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
          </svg>
          <span className="hidden sm:inline">{labels.prevWeek}</span>
        </button>

        <div className="flex items-center gap-2 text-center">
          <span className="text-sm font-semibold text-zinc-900">{weekRange}</span>
          {weekLoading && <span className="text-xs text-zinc-400">…</span>}
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
              {labels.goToCurrentWeek}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={goNext}
          aria-label={labels.nextWeek}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
        >
          <span className="hidden sm:inline">{labels.nextWeek}</span>
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* ── Apply Template button ── */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setGlobalPickerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {labels.applyTemplate}
        </button>
      </div>

      {/* ── Days grid ── */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 gap-3 px-1 pb-2">
            {DAYS.map((day, i) => (
              <WeekDayHeader
                key={day}
                dayLabel={weekdayLabels[i] ?? day.slice(0, 3)}
                dateLabel={formatDayDate(dayDates[i])}
              />
            ))}
          </div>

                    <div className="grid grid-cols-7 gap-3">
            {DAYS.map((day) => {
              const a = getAssignment(day);
              const isPlanned = !!a;
              const variant = getVariant(day);

              return (
                <DayCard
                  key={day}
                  day={day}
                  variant={variant}
                  workoutName={a?.workout_name}
                  duration={a?.workout_duration ?? undefined}
                  onClick={() => {
                    if (isPlanned && a) {
                      // Navega al detalle del workout copia
                      window.location.href = `/workouts/${a.workout_id}`;
                    } else {
                      // Día vacío → abre picker
                      setPickerTarget(day);
                    }
                  }}
                  labels={{
                    addWorkout: labels.addWorkout,
                    restDay: labels.restDay,
                    planned: labels.planned,
                    completed: labels.completed,
                    min: labels.min,
                  }}
                  menu={
                    isPlanned && a ? (
                      <PlannerDayMenu
                        day={day}
                        workoutName={a.workout_name}
                        labels={{
                          replace: labels.confirm?.replace ?? "Replace",
                          remove: labels.removeFromPlanner ?? "Remove from planner",
                        }}
                        onReplace={() => {
                          setPickerTarget(day);
                        }}
                        onRemove={async () => {
                          await removeAssignment(day);
                        }}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Picker modal (global) ── */}
      {globalPickerOpen && (
        <WorkoutPicker
          workouts={workouts}
          dayLabel=""
          labels={labels.picker}
          onSelect={handleTemplateSelected}
          onClose={() => setGlobalPickerOpen(false)}
        />
      )}

      {/* ── Picker modal (per-day) ── */}
      {pickerTarget && (
        <WorkoutPicker
          workouts={workouts}
          dayLabel={pickerTarget}
          labels={labels.picker}
          onSelect={handleTemplateSelected}
          onClose={() => setPickerTarget(null)}
        />
      )}

      {/* ── Confirm modal (solo si la semana tiene workouts) ── */}
      {pendingTemplateId && (
        <ApplyTemplateModal
          labels={labels.confirm}
          onReplace={() => handleModalConfirm("replace")}
          onFillEmpty={() => handleModalConfirm("fill_empty")}
          onCancel={() => setPendingTemplateId(null)}
        />
      )}
    </div>
  );
}
