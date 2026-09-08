"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  color: string | null;
}

export interface EventFormData {
  title: string;
  description: string;
  event_type: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  all_day: boolean;
  color: string;
}

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  event?: CalendarEvent | null;
  mode: "create" | "edit";
}

// ── Constants ─────────────────────────────────────────────────────────────────

// Event types — value + icon are stable; the visible label comes from i18n
// (calendar.eventModal.types.<value>). "water" and "supplements" are the two
// new categories. event_type stays a plain string, so no data migration.
type EventTypeKey =
  | "custom"
  | "workout"
  | "meal"
  | "measurement"
  | "goal"
  | "water"
  | "supplements";

const EVENT_TYPES: { value: EventTypeKey; icon: string }[] = [
  { value: "custom", icon: "📌" },
  { value: "workout", icon: "💪" },
  { value: "meal", icon: "🍽️" },
  { value: "measurement", icon: "📏" },
  { value: "goal", icon: "🎯" },
  { value: "water", icon: "💧" },
  { value: "supplements", icon: "💊" },
];

// Colors — value is the stored hex; the label key resolves via i18n
// (calendar.eventModal.colors.<key>).
const COLORS: { value: string; key: "blue" | "green" | "amber" | "red" | "purple" | "pink" | "gray" }[] = [
  { value: "#3b82f6", key: "blue" },
  { value: "#10b981", key: "green" },
  { value: "#f59e0b", key: "amber" },
  { value: "#ef4444", key: "red" },
  { value: "#8b5cf6", key: "purple" },
  { value: "#ec4899", key: "pink" },
  { value: "#6b7280", key: "gray" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toDateInput(isoString: string | null): string {
  if (!isoString) return new Date().toISOString().split("T")[0];
  return isoString.split("T")[0];
}

function toTimeInput(isoString: string | null): string {
  if (!isoString) return "09:00";
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EventModal({ isOpen, onClose, onSave, onDelete, event, mode }: EventModalProps) {
  const { dict } = useDictionary();
  const t = dict.calendar.eventModal;
  const overlayRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState<EventFormData>({
    title: "",
    description: "",
    event_type: "custom",
    start_date: new Date().toISOString().split("T")[0],
    start_time: "09:00",
    end_date: new Date().toISOString().split("T")[0],
    end_time: "10:00",
    all_day: false,
    color: "#3b82f6",
  });

  // Populate form when editing
  useEffect(() => {
    if (event && mode === "edit") {
      setForm({
        title: event.title,
        description: event.description || "",
        event_type: event.event_type,
        start_date: toDateInput(event.start_date),
        start_time: toTimeInput(event.start_date),
        end_date: toDateInput(event.end_date),
        end_time: toTimeInput(event.end_date),
        all_day: event.all_day,
        color: event.color || "#3b82f6",
      });
    } else if (mode === "create") {
      setForm({
        title: "",
        description: "",
        event_type: "custom",
        start_date: new Date().toISOString().split("T")[0],
        start_time: "09:00",
        end_date: new Date().toISOString().split("T")[0],
        end_time: "10:00",
        all_day: false,
        color: "#3b82f6",
      });
    }
    setConfirmDelete(false);
  }, [event, mode, isOpen]);

  // Close on overlay click
  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;

    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (!onDelete) return;
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
    >
      <div className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900">
            {mode === "create" ? t.titleCreate : t.titleEdit}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label={t.close}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="event-title" className="text-sm font-medium text-zinc-700">{t.fieldTitle} *</label>
            <input
              id="event-title"
              type="text"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder={t.fieldTitlePlaceholder}
              required
              className="rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="event-desc" className="text-sm font-medium text-zinc-700">{t.fieldDescription}</label>
            <textarea
              id="event-desc"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder={t.fieldDescriptionPlaceholder}
              rows={2}
              className="rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          {/* Event Type + Color row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="event-type" className="text-sm font-medium text-zinc-700">{t.fieldType}</label>
              <select
                id="event-type"
                value={form.event_type}
                onChange={(e) => setForm((p) => ({ ...p, event_type: e.target.value }))}
                className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              >
                {EVENT_TYPES.map((et) => (
                  <option key={et.value} value={et.value}>{et.icon} {t.types[et.value]}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-zinc-700">{t.fieldColor}</label>
              <div className="flex items-center gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, color: c.value }))}
                    aria-label={t.colors[c.key]}
                    className={[
                      "h-7 w-7 rounded-full transition-transform",
                      form.color === c.value ? "scale-125 ring-2 ring-offset-2 ring-zinc-400" : "hover:scale-110",
                    ].join(" ")}
                    style={{ backgroundColor: c.value }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* All day toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.all_day}
              onChange={(e) => setForm((p) => ({ ...p, all_day: e.target.checked }))}
              className="h-4 w-4 rounded border-zinc-300 accent-zinc-900"
            />
            <span className="text-sm text-zinc-700">{t.allDay}</span>
          </label>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="start-date" className="text-sm font-medium text-zinc-700">{t.startDate}</label>
              <input
                id="start-date"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
                required
                className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            {!form.all_day && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="start-time" className="text-sm font-medium text-zinc-700">{t.startTime}</label>
                <input
                  id="start-time"
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                  className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="end-date" className="text-sm font-medium text-zinc-700">{t.endDate}</label>
              <input
                id="end-date"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
                className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
              />
            </div>

            {!form.all_day && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="end-time" className="text-sm font-medium text-zinc-700">{t.endTime}</label>
                <input
                  id="end-time"
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                  className="rounded-lg border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 flex items-center justify-between">
            <div>
              {mode === "edit" && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className={[
                    "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    confirmDelete
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "text-red-600 hover:bg-red-50",
                  ].join(" ")}
                >
                  {deleting ? t.deleting : confirmDelete ? t.confirmDelete : t.delete}
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={saving || !form.title.trim()}
                className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? t.saving : mode === "create" ? t.create : t.saveChanges}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
