"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import EventModal, { type CalendarEvent, type EventFormData } from "@/components/calendar/EventModal";
import PageLoader from "@/components/ui/PageLoader";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";
import { planEntryDate, readSlot, type PlanSlotValue } from "@/lib/nutrition";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

type CalendarDict = ReturnType<typeof useDictionary>["dict"]["calendar"];

// Abbreviated weekday labels (Mon…Sun) built from the calendar dict slice.
// The header labels are pure display; the grid uses date math, not these strings.
function buildWeekdays(t: CalendarDict): string[] {
  return [t.weekdayMon, t.weekdayTue, t.weekdayWed, t.weekdayThu, t.weekdayFri, t.weekdaySat, t.weekdaySun];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayActivity {
  workouts: { name: string; duration: number | null; status: string }[];
  mealsCount: number;
  weight: number | null;
  hasPhoto: boolean;
  waterMl: number | null;
  waterGoalMl: number | null;
  supplements: string[];
  plannedMeals: { recipeId: string; slot: string; name: string; servings: number }[];
}

type ActivityMap = Record<string, DayActivity>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function getMonthStartPadding(year: number, month: number): number {
  const firstDay = new Date(year, month, 1).getDay();
  return firstDay === 0 ? 6 : firstDay - 1;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function buildTimestamp(date: string, time: string, allDay: boolean): string {
  if (allDay) return `${date}T00:00:00`;
  return `${date}T${time}:00`;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month, 1).toISOString().slice(0, 10);
  const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

const TYPE_ICONS: Record<string, string> = {
  custom: "📌",
  workout: "💪",
  meal: "🍽️",
  measurement: "📏",
  goal: "🎯",
  water: "💧",
  supplements: "💊",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { toast: globalToast } = useToast();
  const { dict } = useDictionary();
  const t = dict.calendar;
  const weekdays = useMemo(() => buildWeekdays(t), [t]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [activities, setActivities] = useState<ActivityMap>({});
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // ── Load Events + Activities for visible month ────────────────────────────

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { start, end } = getMonthRange(year, month);

    // Load calendar events (all — not range-limited for upcoming section)
    const { data: eventData } = await supabase
      .from("calendar_events")
      .select("id, title, description, event_type, start_date, end_date, all_day, color")
      .order("start_date", { ascending: true });

    if (eventData) setEvents(eventData as CalendarEvent[]);

    // Load activities for visible month only
    const [sessionsRes, mealsRes, weightRes, photosRes, waterRes, suppRes, plansRes] = await Promise.all([
      supabase
        .from("training_sessions")
        .select("date, workout_name, duration_minutes, status")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end)
        .eq("status", "Completed")
        .eq("is_sandbox", false),
      supabase
        .from("meal_logs")
        .select("date")
        .gte("date", start)
        .lte("date", end)
        .eq("is_sandbox", false),
      supabase
        .from("weight_entries")
        .select("date, weight_kg")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end)
        .eq("is_sandbox", false),
      supabase
        .from("progress_photos")
        .select("upload_date")
        .eq("user_id", user.id)
        .gte("upload_date", start)
        .lte("upload_date", end)
        .eq("is_sandbox", false),
      // Water + supplement logs. These tables have no is_sandbox column
      // (migration 00009), so they are NOT filtered by it.
      supabase
        .from("water_logs")
        .select("date, intake_ml, goal_ml")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end),
      supabase
        .from("supplement_logs")
        .select("date, taken")
        .eq("user_id", user.id)
        .gte("date", start)
        .lte("date", end),
      // Meal plans whose week overlaps the visible month. plan_data is a
      // JSONB blob mapping day -> slot -> recipe id; we resolve those to
      // concrete dates so planned meals show up on the calendar.
      supabase
        .from("meal_plans")
        .select("week_start_date, plan_data")
        .eq("user_id", user.id)
        .lte("week_start_date", end)
        .gte("week_end_date", start),
    ]);

    // Build activity map
    const map: ActivityMap = {};

    function ensureDay(dateStr: string): DayActivity {
      if (!map[dateStr]) {
        map[dateStr] = {
          workouts: [],
          mealsCount: 0,
          weight: null,
          hasPhoto: false,
          waterMl: null,
          waterGoalMl: null,
          supplements: [],
          plannedMeals: [],
        };
      }
      return map[dateStr];
    }

    if (sessionsRes.data) {
      for (const s of sessionsRes.data) {
        const day = ensureDay(s.date);
        day.workouts.push({
          name: s.workout_name || "Workout",
          duration: s.duration_minutes,
          status: s.status,
        });
      }
    }

    if (mealsRes.data) {
      for (const m of mealsRes.data) {
        const day = ensureDay(m.date);
        day.mealsCount++;
      }
    }

    if (weightRes.data) {
      for (const w of weightRes.data) {
        const day = ensureDay(w.date);
        day.weight = w.weight_kg;
      }
    }

    if (photosRes.data) {
      for (const p of photosRes.data) {
        const day = ensureDay(p.upload_date);
        day.hasPhoto = true;
      }
    }

    // Water: only surface days with actual intake (intake_ml > 0)
    if (waterRes.data) {
      for (const w of waterRes.data) {
        const intake = w.intake_ml ?? 0;
        if (intake <= 0) continue;
        const day = ensureDay(w.date);
        day.waterMl = intake;
        day.waterGoalMl = w.goal_ml ?? null;
      }
    }

    // Supplements: only surface days with at least one supplement taken
    if (suppRes.data) {
      for (const s of suppRes.data) {
        const taken = Array.isArray(s.taken) ? (s.taken as unknown[]).filter((t): t is string => typeof t === "string") : [];
        if (taken.length === 0) continue;
        const day = ensureDay(s.date);
        day.supplements = taken;
      }
    }

    // Planned meals: resolve each plan's day/slot -> recipe id -> date + name.
    if (plansRes.data && plansRes.data.length > 0) {
      // Collect every recipe id referenced across the plans in view.
      const entries: { date: string; slot: string; recipeId: string; servings: number }[] = [];
      for (const p of plansRes.data) {
        const weekStart = p.week_start_date as string;
        const planData = (p.plan_data as Record<string, Record<string, PlanSlotValue>>) || {};
        for (const [dayName, slots] of Object.entries(planData)) {
          const date = planEntryDate(weekStart, dayName);
          if (!date || date < start || date > end) continue;
          for (const [slot, rawValue] of Object.entries(slots || {})) {
            const entry = readSlot(rawValue);
            if (entry) entries.push({ date, slot, recipeId: entry.recipeId, servings: entry.servings });
          }
        }
      }

      if (entries.length > 0) {
        const uniqueIds = Array.from(new Set(entries.map((e) => e.recipeId)));
        const { data: recipeRows } = await supabase
          .from("recipes")
          .select("id, name")
          .in("id", uniqueIds);
        const nameById = new Map<string, string>(
          (recipeRows || []).map((r) => [r.id, r.name])
        );

        for (const e of entries) {
          const name = nameById.get(e.recipeId);
          if (!name) continue; // recipe removed — skip stale reference
          const day = ensureDay(e.date);
          day.plannedMeals.push({ recipeId: e.recipeId, slot: e.slot, name, servings: e.servings });
        }
      }
    }

    setActivities(map);
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── CRUD Operations ───────────────────────────────────────────────────────

  async function handleCreateEvent(formData: EventFormData) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const startDate = buildTimestamp(formData.start_date, formData.start_time, formData.all_day);
    const endDate = formData.end_date
      ? buildTimestamp(formData.end_date, formData.end_time, formData.all_day)
      : null;

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        user_id: user.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        event_type: formData.event_type,
        start_date: startDate,
        end_date: endDate,
        all_day: formData.all_day,
        color: formData.color,
      })
      .select("id, title, description, event_type, start_date, end_date, all_day, color")
      .single();

    if (error) {
      showToast(t.toastCreateError.replace("{msg}", String(error.message)), "error");
      return;
    }

    if (data) {
      setEvents((prev) => [...prev, data as CalendarEvent].sort(
        (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
      ));
      showToast(t.toastCreated, "success");
    }
  }

  async function handleUpdateEvent(formData: EventFormData) {
    if (!editingEvent) return;
    const supabase = createClient();

    const startDate = buildTimestamp(formData.start_date, formData.start_time, formData.all_day);
    const endDate = formData.end_date
      ? buildTimestamp(formData.end_date, formData.end_time, formData.all_day)
      : null;

    const { data, error } = await supabase
      .from("calendar_events")
      .update({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        event_type: formData.event_type,
        start_date: startDate,
        end_date: endDate,
        all_day: formData.all_day,
        color: formData.color,
      })
      .eq("id", editingEvent.id)
      .select("id, title, description, event_type, start_date, end_date, all_day, color")
      .single();

    if (error) {
      showToast(t.toastUpdateError.replace("{msg}", String(error.message)), "error");
      return;
    }

    if (data) {
      setEvents((prev) =>
        prev.map((e) => (e.id === data.id ? (data as CalendarEvent) : e))
          .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
      );
      showToast(t.toastUpdated, "success");
    }
  }

  async function handleDeleteEvent() {
    if (!editingEvent) return;
    const supabase = createClient();

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", editingEvent.id);

    if (error) {
      showToast(t.toastDeleteError.replace("{msg}", String(error.message)), "error");
      return;
    }

    setEvents((prev) => prev.filter((e) => e.id !== editingEvent.id));
    showToast(t.toastDeleted, "success");
  }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(message: string, type: "success" | "error") {
    globalToast(message, type);
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToday() {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  }

  // ── Modal handlers ────────────────────────────────────────────────────────

  function openCreateModal() {
    setEditingEvent(null);
    setModalMode("create");
    setModalOpen(true);
  }

  function openEditModal(event: CalendarEvent) {
    setEditingEvent(event);
    setModalMode("edit");
    setModalOpen(true);
  }

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingEvent(null);
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────

  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const padding = useMemo(() => getMonthStartPadding(year, month), [year, month]);
  const today = useMemo(() => new Date(), []);

  const eventsForSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((e) => isSameDay(new Date(e.start_date), selectedDate));
  }, [events, selectedDate]);

  const activityForSelectedDate = useMemo((): DayActivity | null => {
    if (!selectedDate) return null;
    return activities[toDateKey(selectedDate)] || null;
  }, [activities, selectedDate]);

  function getEventsForDay(day: Date): CalendarEvent[] {
    return events.filter((e) => isSameDay(new Date(e.start_date), day));
  }

  function getActivityForDay(day: Date): DayActivity | null {
    return activities[toDateKey(day)] || null;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <PageLoader text={t.loading} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{t.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
        >
          {t.newEvent}
        </button>
      </div>

      {/* Upcoming events — above calendar for immediate relevance */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">{t.upcomingEvents}</h3>
        {events.filter((e) => new Date(e.start_date) >= today).length === 0 ? (
          <div className="flex h-16 items-center justify-center">
            <p className="text-sm text-zinc-400">{t.noUpcoming}</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-50">
            {events
              .filter((e) => new Date(e.start_date) >= today)
              .slice(0, 5)
              .map((event) => (
                <li key={event.id} className="flex items-center gap-3 py-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: event.color || "#6b7280" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900 truncate">{event.title}</p>
                    <p className="text-xs text-zinc-400">
                      {new Date(event.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {!event.all_day && ` at ${formatTime(event.start_date)}`}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-300">
                    {TYPE_ICONS[event.event_type] || "📌"}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </div>

      {/* Month navigation + Calendar grid (grouped together, no gap between nav and grid) */}
      <div className="flex flex-col gap-0">
        <div className="flex items-center justify-between rounded-t-xl border border-zinc-200 bg-white px-5 py-3">
          <button type="button" onClick={prevMonth} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label="Previous month">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>
          </button>

          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-zinc-900">
              {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </h2>
            <button type="button" onClick={goToday} className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200">
              {t.today}
            </button>
          </div>

          <button type="button" onClick={nextMonth} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" aria-label="Next month">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
          </button>
        </div>
      </div>

      {/* Calendar grid + sidebar */}
      <div className="-mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Calendar grid */}
        <div className="rounded-b-xl border border-t-0 border-zinc-200 bg-white p-4 shadow-sm">
          {/* Weekday headers */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {weekdays.map((day) => (
              <div key={day} className="py-2 text-center text-xs font-semibold text-zinc-400">
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {/* Padding */}
            {Array.from({ length: padding }).map((_, i) => (
              <div key={`pad-${i}`} className="h-20 rounded-lg" />
            ))}

            {/* Days */}
            {days.map((day) => {
              const dayEvents = getEventsForDay(day);
              const dayActivity = getActivityForDay(day);
              const isToday = isSameDay(day, today);
              const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
              const hasActivity = dayActivity && (
                dayActivity.workouts.length > 0 ||
                dayActivity.mealsCount > 0 ||
                dayActivity.weight !== null ||
                dayActivity.hasPhoto ||
                dayActivity.waterMl !== null ||
                dayActivity.supplements.length > 0 ||
                dayActivity.plannedMeals.length > 0
              );

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={[
                    "flex h-20 flex-col items-start rounded-lg border p-1.5 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-zinc-50"
                      : isToday
                      ? "border-blue-200 bg-blue-50/50"
                      : "border-transparent hover:border-zinc-200 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday ? "bg-primary text-white" : "text-zinc-700",
                    ].join(" ")}
                  >
                    {day.getDate()}
                  </span>

                  {/* Activity indicators */}
                  <div className="flex flex-wrap gap-0.5 text-xs leading-none">
                    {dayActivity?.workouts.length ? (
                      <span title={t.tipWorkout}>💪</span>
                    ) : null}
                    {dayActivity?.mealsCount ? (
                      <span title={t.tipMealsLogged}>🍽️</span>
                    ) : null}
                    {dayActivity?.weight !== null && dayActivity?.weight !== undefined ? (
                      <span title={t.tipWeightRecorded}>⚖️</span>
                    ) : null}
                    {dayActivity?.hasPhoto ? (
                      <span title={t.tipProgressPhoto}>📸</span>
                    ) : null}
                    {dayActivity?.waterMl ? (
                      <span title={t.tipWaterLogged}>💧</span>
                    ) : null}
                    {dayActivity?.supplements.length ? (
                      <span title={t.tipSupplementsTaken}>💊</span>
                    ) : null}
                    {dayActivity?.plannedMeals.length ? (
                      <span title={t.tipPlannedMeal}>🗓️</span>
                    ) : null}
                  </div>

                  {/* Event dots */}
                  {dayEvents.length > 0 && (
                    <div className="mt-auto flex gap-0.5">
                      {dayEvents.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: ev.color || "#6b7280" }}
                        />
                      ))}
                      {dayEvents.length > 3 && (
                        <span className="text-xs text-zinc-400">+{dayEvents.length - 3}</span>
                      )}
                    </div>
                  )}

                  {/* Empty indicator for days with no activity and no events */}
                  {!hasActivity && dayEvents.length === 0 && !isToday && (
                    <span />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar: selected day detail */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">
              {selectedDate ? formatDate(selectedDate) : t.selectDay}
            </h3>
            {selectedDate && (
              <button
                type="button"
                onClick={openCreateModal}
                className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
              >
                {t.add}
              </button>
            )}
          </div>

          {!selectedDate ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-zinc-400">{t.clickDay}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Activity section */}
              {activityForSelectedDate && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.activity}</p>

                  {/* Workouts */}
                  {activityForSelectedDate.workouts.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                      <span className="text-sm">💪</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-blue-900">{w.name}</p>
                        <p className="text-xs text-blue-600">
                          {w.duration ? `${w.duration} min` : t.durationNA}
                          {w.status !== "Completed" && ` · ${w.status}`}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Meals */}
                  {activityForSelectedDate.mealsCount > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
                      <span className="text-sm">🍽️</span>
                      <p className="text-xs font-medium text-amber-900">
                        {t.mealsLoggedCount.replace("{n}", String(activityForSelectedDate.mealsCount))}
                      </p>
                    </div>
                  )}

                  {/* Weight */}
                  {activityForSelectedDate.weight !== null && (
                    <div className="flex items-center gap-2 rounded-lg bg-success-light px-3 py-2">
                      <span className="text-sm">⚖️</span>
                      <p className="text-xs font-medium text-success">
                        {activityForSelectedDate.weight} kg
                      </p>
                    </div>
                  )}

                  {/* Photo */}
                  {activityForSelectedDate.hasPhoto && (
                    <div className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2">
                      <span className="text-sm">📸</span>
                      <p className="text-xs font-medium text-purple-900">
                        {t.progressPhotoUploaded}
                      </p>
                    </div>
                  )}

                  {/* Water */}
                  {activityForSelectedDate.waterMl !== null && (
                    <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2">
                      <span className="text-sm">💧</span>
                      <p className="text-xs font-medium text-sky-900">
                        {activityForSelectedDate.waterGoalMl !== null &&
                        activityForSelectedDate.waterMl >= activityForSelectedDate.waterGoalMl
                          ? t.waterGoalReached.replace("{n}", String(activityForSelectedDate.waterMl))
                          : t.water.replace("{n}", String(activityForSelectedDate.waterMl))}
                      </p>
                    </div>
                  )}

                  {/* Supplements */}
                  {activityForSelectedDate.supplements.length > 0 && (
                    <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-3 py-2">
                      <span className="text-sm">💊</span>
                      <p className="text-xs font-medium text-indigo-900">
                        {t.supplements.replace("{list}", activityForSelectedDate.supplements.join(", "))}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Planned meals (from the Meal Planner — an intention, not a log) */}
              {activityForSelectedDate && activityForSelectedDate.plannedMeals.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.plannedMeals}</p>
                    <Link href="/nutrition/meal-planner" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                      {t.openPlanner}
                    </Link>
                  </div>
                  {activityForSelectedDate.plannedMeals.map((pm, i) => (
                    <Link
                      key={i}
                      href={`/nutrition/recipes/${pm.recipeId}`}
                      className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
                    >
                      <span className="text-sm">🗓️</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-rose-900">
                          {pm.name}{pm.servings > 1 ? ` ×${pm.servings}` : ""}
                        </p>
                        <p className="text-xs text-rose-500">{t.slotPlanned.replace("{slot}", pm.slot)}</p>
                      </div>
                      <span className="shrink-0 text-rose-400" aria-hidden="true">›</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Calendar events section */}
              {eventsForSelectedDate.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">{t.scheduledEvents}</p>
                  {eventsForSelectedDate.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => openEditModal(event)}
                      className="flex w-full items-start gap-3 rounded-lg border border-zinc-100 p-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                    >
                      <span
                        className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: event.color || "#6b7280" }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-900 truncate">{event.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {TYPE_ICONS[event.event_type] || "📌"} {event.event_type}
                          {!event.all_day && ` · ${formatTime(event.start_date)}`}
                          {event.all_day && ` · ${t.allDay}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!activityForSelectedDate && eventsForSelectedDate.length === 0 && (
                <div className="flex h-32 flex-col items-center justify-center gap-2">
                  <span className="text-2xl">📅</span>
                  <p className="text-sm text-zinc-400">{t.noActivityDay}</p>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-1 text-xs font-medium text-zinc-900 hover:underline"
                  >
                    {t.scheduleEvent}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSave={modalMode === "create" ? handleCreateEvent : handleUpdateEvent}
        onDelete={modalMode === "edit" ? handleDeleteEvent : undefined}
        event={editingEvent}
        mode={modalMode}
      />
    </div>
  );
}
