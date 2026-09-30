"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import DayCard, { type DayName, type DayVariant } from "./DayCard";
import WeekDayHeader from "@/components/ui/WeekDayHeader";
import WorkoutPicker, { type WorkoutPickerItem } from "./WorkoutPicker";
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
    exercisesSuffix: string;
    verRutina: string;
    difficultyLabels: {
      Beginner: string;
      Intermediate: string;
      Advanced: string;
    };
    picker: {
      title: string;
      searchPlaceholder: string;
      noMatch: string;
      countSummary: string;
      all: string;
      goalLabels: {
        FatLoss: string;
        MuscleGain: string;
        Strength: string;
        Endurance: string;
        Mobility: string;
        GeneralFitness: string;
      };
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
  refreshSignal?: number;
}

interface PlannerAssignment {
  day_of_week: DayName;
  workout_id: string;
  workout_name: string;
  workout_duration: number | null;
  workout_difficulty: string | null;
  workout_exerciseCount: number;
  workout_dayNames: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS: DayName[] = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  const sundayBefore = new Date(monday);
  sundayBefore.setDate(monday.getDate() - 1);
  const saturdayAfter = new Date(monday);
  saturdayAfter.setDate(monday.getDate() + 5);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = sundayBefore.toLocaleDateString("en-US", opts);
  const endStr = saturdayAfter.toLocaleDateString("en-US", opts);
  return `${startStr} – ${endStr}, ${saturdayAfter.getFullYear()}`;
}

function formatDayDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function translateDay(day: DayName, weekdayLabels: string[]): string {
  const idx = DAYS.indexOf(day);
  if (idx < 0) return day;
  return weekdayLabels[idx] ?? day;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeekPlanner({ workouts, labels, weekdayLabels, refreshSignal }: WeekPlannerProps) {
  const router = useRouter();
  const { success: showToast } = useToast();
  const [monday, setMonday] = useState<Date>(() => getMonday(new Date()));
  const [assignments, setAssignments] = useState<PlannerAssignment[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<DayName | null>(null);

  // Drag & drop state
  const [dragFrom, setDragFrom] = useState<DayName | null>(null);
  const [dragOver, setDragOver] = useState<DayName | null>(null);

  const isCurrentWeek = useMemo(() => {
    const today = getMonday(new Date());
    return today.getTime() === monday.getTime();
  }, [monday]);

  const weekRange = useMemo(() => formatWeekRange(monday), [monday]);
  const weekStart = useMemo(() => mondayKey(monday), [monday]);

  const dayDates = useMemo(() => {
    const offsetByDay: Record<DayName, number> = {
      Sunday: -1,
      Monday: 0,
      Tuesday: 1,
      Wednesday: 2,
      Thursday: 3,
      Friday: 4,
      Saturday: 5,
    };
    return DAYS.map((day) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + offsetByDay[day]);
      return d;
    });
  }, [monday]);

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
      .select(`
        id, name, duration, difficulty,
        workout_days (
          id, day_name,
          workout_exercises (id)
        )
      `)
      .in("id", workoutIds);

    if (workoutError) {
      console.error("[WeekPlanner] workouts fetch error:", workoutError);
      setAssignments([]);
      setWeekLoading(false);
      return;
    }

    const workoutMap = new Map<string, {
      id: string;
      name: string;
      duration: number | null;
      difficulty: string | null;
      exerciseCount: number;
      dayNames: string[];
    }>();

    for (const w of workoutRows ?? []) {
      const days = w.workout_days ?? [];
      const exerciseCount = days.reduce(
        (sum, d) => sum + ((d.workout_exercises ?? []).length),
        0
      );
      const dayNames = days.map((d) => d.day_name);

      workoutMap.set(w.id, {
        id: w.id,
        name: w.name,
        duration: w.duration,
        difficulty: w.difficulty,
        exerciseCount,
        dayNames,
      });
    }

    const mapped: PlannerAssignment[] = plannerRows.map((row) => {
      const w = workoutMap.get(row.workout_id);
      return {
        day_of_week: row.day_of_week as DayName,
        workout_id: row.workout_id,
        workout_name: w?.name ?? "Workout",
        workout_duration: w?.duration ?? null,
        workout_difficulty: w?.difficulty ?? null,
        workout_exerciseCount: w?.exerciseCount ?? 0,
        workout_dayNames: w?.dayNames ?? [],
      };
    });

    setAssignments(mapped);
    setWeekLoading(false);
  }, [weekStart]);

  useEffect(() => { loadWeek(); }, [loadWeek]);

  useEffect(() => {
    if (refreshSignal === undefined) return;
    loadWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  function goPrev() { setMonday((m) => shiftWeek(m, -1)); }
  function goNext() { setMonday((m) => shiftWeek(m, 1)); }
  function goToday() { setMonday(getMonday(new Date())); }

  function getAssignment(day: DayName): PlannerAssignment | undefined {
    return assignments.find((a) => a.day_of_week === day);
  }

  function getVariant(day: DayName): DayVariant {
    return getAssignment(day) ? "planned" : "empty";
  }

  // ── Move / Swap entre días ──
  async function moveOrSwap(fromDay: DayName, toDay: DayName) {
    if (fromDay === toDay) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const fromAssignment = getAssignment(fromDay);
    const toAssignment = getAssignment(toDay);
    if (!fromAssignment) return;

    // Caso 1: día destino vacío → MOVE
    if (!toAssignment) {
      const { error } = await supabase
        .from("training_planner")
        .update({ day_of_week: toDay })
        .eq("user_id", user.id)
        .eq("week_start_date", weekStart)
        .eq("day_of_week", fromDay);

      if (error) {
        showToast(`Error: ${error.message}`);
        return;
      }
      await loadWeek();
      showToast(`${translateDay(fromDay, weekdayLabels)} → ${translateDay(toDay, weekdayLabels)}`);
      return;
    }

    // Caso 2: día destino ocupado → SWAP
    // Necesitamos borrar ambos e insertar invertidos.
    // (UNIQUE(user, week, day) no permite duplicados intermedios.)
    const tmpFrom = fromAssignment;
    const tmpTo = toAssignment;

    await supabase
      .from("training_planner")
      .delete()
      .eq("user_id", user.id)
      .eq("week_start_date", weekStart)
      .in("day_of_week", [fromDay, toDay]);

    const { error: insertError } = await supabase
      .from("training_planner")
      .insert([
        {
          user_id: user.id,
          week_start_date: weekStart,
          day_of_week: toDay,
          workout_id: tmpFrom.workout_id,
        },
        {
          user_id: user.id,
          week_start_date: weekStart,
          day_of_week: fromDay,
          workout_id: tmpTo.workout_id,
        },
      ]);

    if (insertError) {
      showToast(`Error: ${insertError.message}`);
      return;
    }

    await loadWeek();
    showToast(`${translateDay(fromDay, weekdayLabels)} ⇄ ${translateDay(toDay, weekdayLabels)}`);
  }

  // ── Apply template handler ──
  async function runApply(templateId: string, mode: PlannerMode, targetDay?: DayName) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (targetDay) {
      const res = await applyTemplateToPlanner(templateId, weekStart, "fill_empty");
      if (!res.ok || !res.workoutId) {
        showToast(`Error: ${res.error ?? "UNKNOWN"}`);
        return;
      }

      await supabase
        .from("training_planner")
        .delete()
        .eq("user_id", user.id)
        .eq("week_start_date", weekStart)
        .eq("workout_id", res.workoutId);

      await supabase
        .from("training_planner")
        .delete()
        .eq("user_id", user.id)
        .eq("week_start_date", weekStart)
        .eq("day_of_week", targetDay);

      const { error: insertError } = await supabase
        .from("training_planner")
        .insert({
          user_id: user.id,
          week_start_date: weekStart,
          day_of_week: targetDay,
          workout_id: res.workoutId,
          source_workout_id: templateId,
        });

      if (insertError) {
        showToast(`Error: ${insertError.message}`);
        return;
      }

      await loadWeek();
      showToast(`1 day assigned`);
      return;
    }

    const res = await applyTemplateToPlanner(templateId, weekStart, mode);
    if (!res.ok) {
      showToast(`Error: ${res.error ?? "UNKNOWN"}`);
      return;
    }
    await loadWeek();
    showToast(`${res.plannerRowsCreated ?? 0} days assigned`);
  }

  async function handleTemplateSelected(templateId: string) {
    const targetDay = pickerTarget;
    setPickerTarget(null);
    if (!targetDay) return;
    await runApply(templateId, "replace", targetDay);
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

              const difficultyLabelText = a?.workout_difficulty
                ? (labels.difficultyLabels[a.workout_difficulty as "Beginner" | "Intermediate" | "Advanced"] ?? a.workout_difficulty)
                : null;

              const activeDaysLabel =
                a?.workout_dayNames && a.workout_dayNames.length > 0
                  ? a.workout_dayNames
                      .map((d) => translateDay(d as DayName, weekdayLabels))
                      .join(" · ")
                  : undefined;

              const isDragSource = dragFrom === day;
              const isDropTarget = !!dragFrom && dragOver === day && dragFrom !== day;

              return (
                <DayCard
                  key={day}
                  day={day}
                  variant={variant}
                  workoutName={a?.workout_name}
                  duration={a?.workout_duration ?? undefined}
                  exerciseCount={a?.workout_exerciseCount}
                  difficulty={difficultyLabelText}
                  activeDaysLabel={activeDaysLabel}
                  onClick={() => {
                    if (isPlanned && a) {
                      router.push(`/workouts/${a.workout_id}`);
                    } else {
                      setPickerTarget(day);
                    }
                  }}
                  onRemove={isPlanned ? () => removeAssignment(day) : undefined}
                  draggable={isPlanned}
                  onDragStart={() => setDragFrom(day)}
                  onDragEnd={() => { setDragFrom(null); setDragOver(null); }}
                  onDragOver={(e) => {
                    if (dragFrom && dragFrom !== day) {
                      e.preventDefault();
                      setDragOver(day);
                    }
                  }}
                  onDragLeave={() => {
                    setDragOver((d) => (d === day ? null : d));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragFrom && dragFrom !== day) {
                      moveOrSwap(dragFrom, day);
                    }
                    setDragFrom(null);
                    setDragOver(null);
                  }}
                  isDragging={isDragSource}
                  isDropTarget={isDropTarget}
                  labels={{
                    addWorkout: labels.addWorkout,
                    restDay: labels.restDay,
                    planned: labels.planned,
                    completed: labels.completed,
                    min: labels.min,
                    exercisesSuffix: labels.exercisesSuffix,
                    verRutina: labels.verRutina,
                    removeFromPlanner: labels.removeFromPlanner,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Picker modal (per-day) ── */}
      {pickerTarget && (
        <WorkoutPicker
          workouts={workouts}
          dayLabel={translateDay(pickerTarget, weekdayLabels)}
          labels={labels.picker}
          onSelect={handleTemplateSelected}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </div>
  );
}
