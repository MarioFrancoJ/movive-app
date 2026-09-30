"use client";

import NavIcon from "@/components/ui/NavIcon";

export type DayName = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
export type DayVariant = "empty" | "planned" | "completed" | "rest";

export interface DayCardProps {
  day: DayName;
  variant: DayVariant;
  workoutName?: string;
  duration?: number;
  exerciseCount?: number;
  difficulty?: string | null;
  activeDaysLabel?: string;
  labels: {
    addWorkout: string;
    restDay: string;
    planned: string;
    completed: string;
    min: string;
    exercisesSuffix?: string;
    verRutina?: string;
    removeFromPlanner?: string;
  };
  onClick?: () => void;
  onRemove?: () => void;
}

const VARIANT_STYLES: Record<DayVariant, string> = {
  empty:     "border-dashed border-zinc-300 bg-white hover:border-zinc-400 hover:bg-zinc-50",
  planned:   "border-solid border-blue-200 bg-blue-50 hover:border-blue-300",
  completed: "border-solid border-success-light bg-success-light",
  rest:      "border-solid border-zinc-200 bg-zinc-50",
};

function difficultyPill(d: string | null | undefined): string {
  switch (d) {
    case "Beginner":     return "bg-success-light text-success";
    case "Intermediate": return "bg-amber-100 text-amber-700";
    case "Advanced":     return "bg-red-100 text-red-700";
    default:             return "bg-zinc-100 text-zinc-600";
  }
}

export default function DayCard({
  day,
  variant,
  workoutName,
  duration,
  exerciseCount,
  difficulty,
  activeDaysLabel,
  labels,
  onClick,
  onRemove,
}: DayCardProps) {
  const interactive = typeof onClick === "function";
  const showRemove = (variant === "planned" || variant === "completed") && typeof onRemove === "function";
  const showHoverCta = variant === "planned" && !!labels.verRutina;

  const cardClasses = [
    "relative flex min-h-[140px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border p-4 text-center transition-all",
    VARIANT_STYLES[variant],
    interactive ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" : "",
  ].join(" ");

  const content = (
    <>
      {variant === "empty" && (
        <>
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-zinc-400" aria-hidden="true">
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
            className={["h-5 w-5", variant === "completed" ? "text-success" : "text-blue-600"].join(" ")}
            aria-hidden="true"
          />

          <span className="text-xs font-semibold text-zinc-900 line-clamp-2">
            {workoutName ?? ""}
          </span>

          {activeDaysLabel && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {activeDaysLabel}
            </span>
          )}

          <span className="text-[11px] text-zinc-500">
            {typeof exerciseCount === "number" && exerciseCount > 0 && (
              <>{exerciseCount} {labels.exercisesSuffix ?? "ex"} · </>
            )}
            {typeof duration === "number" && duration > 0 && (
              <>{duration} {labels.min}</>
            )}
          </span>

          {difficulty && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${difficultyPill(difficulty)}`}>
              {difficulty}
            </span>
          )}

          <span
            className={[
              "mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              variant === "completed" ? "bg-white/60 text-success" : "bg-white/60 text-blue-700",
            ].join(" ")}
          >
            {variant === "completed" ? labels.completed : labels.planned}
          </span>
        </>
      )}
    </>
  );

  const hoverCta = showHoverCta ? (
    <span
      className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center rounded-b-xl bg-blue-600/90 py-1.5 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100"
      aria-hidden="true"
    >
      {labels.verRutina}
    </span>
  ) : null;

  return (
    <div className="group relative">
      {interactive ? (
        <button type="button" onClick={onClick} aria-label={day} className={cardClasses}>
          {content}
          {hoverCta}
        </button>
      ) : (
        <div role="group" className={cardClasses}>
          {content}
        </div>
      )}

           {/* X para quitar del planner — mismo estilo que Meal Planner */}
      {showRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          aria-label={labels.removeFromPlanner ?? "Remove from planner"}
          title={labels.removeFromPlanner ?? "Remove from planner"}
          className="absolute right-1.5 top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
