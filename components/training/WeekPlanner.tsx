"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
    removeFromPlanner: string;
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
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const d = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  const router = useRouter();
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
  async function runApply(templateId: string, mode: PlannerMode, targetDay?: DayName) {
    // Si es un día específico, solo aplicamos ese día (no toda la semana)
    // Por ahora, si targetDay existe, forzamos modo "replace" y limpiamos solo ese día.
    if (targetDay) {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Borrar solo ese día
      await supabase
        .from("training_planner")
        .delete()
        .eq("user_id", user.id)
        .eq("week_start_date", weekStart)
        .eq("day_of_week", targetDay);

      // Reutilizamos applyTemplateToPlanner pero con fill_empty (que solo rellena vacíos)
      // y luego filtramos para que solo quede el día objetivo.
      // Simplificación: aplicamos "replace" al template completo y luego borramos los días que no sean targetDay.
      const res = await applyTemplateToPlanner(templateId, weekStart, "replace");
      if (!res.ok) {
        showToast(`Error: ${res.error ?? "UNKNOWN"}`);
        return;
      }

      // Ahora borramos todo menos targetDay
      await supabase
        .from("training_planner")
        .delete()
        .eq("user_id", user.id)
        .eq("week_start_date", weekStart)
        .neq("day_of_week", targetDay);

      await loadWeek();
      showToast(`1 day assigned`);
      return;
    }

    // Sin targetDay: aplicamos a toda la semana
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
    const targetDay = pickerTarget;
    setGlobalPickerOpen(false);
    setPickerTarget(null);

    // Si es un día específico → aplica solo ese día
    if (targetDay) {
      await runApply(templateId, "replace", targetDay);
      return;
    }

    // Si es global y la semana está vacía → aplica directo
    if (assignments.length === 0) {
      await runApply(templateId, "replace");
    } else {
      setPendingTemplateId(templateId);
    }
  }

  async function handleModalConfirm(mode: PlannerMode) {
    if (!pendingTemplateId) return;
    const id = pendingTemplateId;
    setPendingTemplateId(null);
    await runApply(id, mode);
  }

  async function removeAssignment(day: DayName) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("training_planner")
      .delete()
      .eq("user_id", user.id)
      .eq("week_start_date", weekStart)
      .eq("day_of_week", day);

    if (error) {
      showToast(`Error: ${error.message}`);
      return;
    }
    await loadWeek();
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
                      router.push(`/workouts/${a.workout_id}`);
                    } else {
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
                        labels={{
                          replace: labels.confirm?.replace ?? "Replace",
                          remove: labels.removeFromPlanner ?? "Remove from planner",
                        }}
                        onReplace={() => setPickerTarget(day)}
                        onRemove={() => removeAssignment(day)}
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

// ── Day menu (··· button con Reemplazar / Quitar) ─────────────────────────────

function PlannerDayMenu({
  day,
  labels,
  onReplace,
  onRemove,
}: {
  day: DayName;
  labels: { replace: string; remove: string };
  onReplace: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label={`${day} options`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-6 w-6 items-center justify-center rounded-md bg-white/80 text-zinc-500 shadow-sm transition-colors hover:bg-white hover:text-zinc-900"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M10 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM11.5 15.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-7 z-20 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onReplace();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-zinc-400">
              <path d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z" />
            </svg>
            {labels.replace}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onRemove();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-600 transition-colors hover:bg-red-50"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41 41 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5Z" clipRule="evenodd" />
            </svg>
            {labels.remove}
          </button>
        </div>
      )}
    </div>
  );
}
