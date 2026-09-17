"use client";

import NavIcon from "@/components/ui/NavIcon";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
export type DayVariant = "empty" | "planned" | "completed" | "rest";

export interface DayCardProps {
  day: DayName;
  date: string;
  dayLabel: string;
  variant: DayVariant;
  workoutName?: string;
  duration?: number;
  labels: {
    addWorkout: string;
    restDay: string;
    planned: string;
    completed: string;
    min: string;
  };
  onClick?: () => void;
}

// ── Variant styles ────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<DayVariant, string> = {
  empty:     "border-dashed border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50",
  planned:   "border-solid border-blue-200 bg-blue-50",
  completed: "border-solid border-success-light bg-success-light",
  rest:      "border-solid border-zinc-200 bg-zinc-50",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DayCard({
  day,
  date,
  dayLabel,
  variant,
  workoutName,
  duration,
  labels,
  onClick,
}: DayCardProps) {
  const interactive = typeof onClick === "function";

  const baseClasses = [
    "flex min-h-[140px] w-full flex-col rounded-xl border p-5 text-left transition-all",
    VARIANT_STYLES[variant],
    interactive ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" : "",
  ].join(" ");

  const content = (
    <>
      {/* Header: day + date */}
      <div className="flex flex-col">
        <span className="text-sm font-bold uppercase tracking-widest text-zinc-700">{dayLabel}</span>
        <span className="mt-0.5 text-xs text-zinc-400">{date}</span>
      </div>

      {/* Body */}
      <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-2 text-center">
        {variant === "empty" && (
  <>
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-8 w-8 text-zinc-300"
      aria-hidden="true"
    >
      <path d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z" />
    </svg>
    <span className="text-xs font-medium text-zinc-500">{labels.addWorkout}</span>
  </>
)}

        {variant === "rest" && (
          <>
            <NavIcon name="rest-day.svg" className="h-6 w-6 text-zinc-500" aria-hidden="true" />
            <span className="text-xs font-semibold text-zinc-600">{labels.restDay}</span>
          </>
        )}

        {(variant === "planned" || variant === "completed") && (
          <>
            <NavIcon
              name={variant === "completed" ? "workout-complete.svg" : "workout-planned.svg"}
              className={[
                "h-6 w-6",
                variant === "completed" ? "text-success" : "text-blue-600",
              ].join(" ")}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-zinc-900 line-clamp-2">
              {workoutName ?? ""}
            </span>
            {typeof duration === "number" && duration > 0 && (
              <span className="text-[11px] text-zinc-500">
                {duration} {labels.min}
              </span>
            )}
            <span
              className={[
                "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                variant === "completed"
                  ? "bg-white/60 text-success"
                  : "bg-white/60 text-blue-700",
              ].join(" ")}
            >
              {variant === "completed" ? labels.completed : labels.planned}
            </span>
          </>
        )}
      </div>
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={baseClasses}>
        {content}
      </button>
    );
  }

  return (
    <div className={baseClasses} role="group" aria-label={`${dayLabel} ${date}`}>
      {content}
    </div>
  );
}
