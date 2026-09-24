"use client";

import NavIcon from "@/components/ui/NavIcon";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
export type DayVariant = "empty" | "planned" | "completed" | "rest";

export interface DayCardProps {
  day: DayName;
  variant: DayVariant;
  workoutName?: string;
  duration?: number;
  labels: {
    addWorkout: string;
    restDay: string;
    planned: string;
    completed: string;
    min: string;
    replaceWorkout?: string;
    removeWorkout?: string;
  };
  onClick?: () => void;
  /** Menú de acciones secundarias (solo cuando planned/completed). */
  menu?: React.ReactNode;
}

// ── Variant styles ────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<DayVariant, string> = {
  empty:     "border-dashed border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50",
  planned:   "border-solid border-blue-200 bg-blue-50 hover:border-blue-300",
  completed: "border-solid border-success-light bg-success-light",
  rest:      "border-solid border-zinc-200 bg-zinc-50",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DayCard({
  day,
  variant,
  workoutName,
  duration,
  labels,
  onClick,
  menu,
}: DayCardProps) {
  const interactive = typeof onClick === "function";
  const showMenu = (variant === "planned" || variant === "completed") && !!menu;

  const baseClasses = [
    "group relative flex min-h-[100px] w-full flex-col items-center justify-center gap-2 rounded-xl border p-4 text-center transition-all",
    VARIANT_STYLES[variant],
    interactive ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" : "",
  ].join(" ");

  const content = (
    <>
      {variant === "empty" && (
        <>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-6 w-6 text-zinc-400"
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
    </>
  );

  return (
    <div
      role={interactive ? "button" : "group"}
      tabIndex={interactive ? 0 : -1}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={day}
      className={baseClasses}
    >
      {content}

      {/* Menú secundario (···) — aparece en hover cuando hay menu y el variant lo permite */}
      {showMenu && (
        <div
          className="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {menu}
        </div>
      )}
    </div>
  );
}
