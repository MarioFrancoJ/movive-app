"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoutineExercise {
  id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  rest_seconds: number;
  notes: string | null;
  sort_order: number;
}

export interface RoutineDayCardProps {
  exercises: RoutineExercise[];
  labels: {
    restDay: string;
    rest: string;
    addExercise: string;
    removeExercise: string;
  };
  onAddExercise?: () => void;
  onRemoveExercise?: (exerciseId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoutineDayCard({
  exercises,
  labels,
  onAddExercise,
  onRemoveExercise,
}: RoutineDayCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      {exercises.length === 0 ? (
        <p className="text-sm text-zinc-400">{labels.restDay}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {exercises.map((ex) => (
            <div key={ex.id} className="group flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">{ex.exercise_name}</p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {ex.sets}×{ex.reps} • {labels.rest} {ex.rest_seconds}s
                </p>
                {ex.notes && (
                  <p className="mt-1 text-xs text-zinc-400">{ex.notes}</p>
                )}
              </div>
              {onRemoveExercise && (
                <button
                  type="button"
                  onClick={() => onRemoveExercise(ex.id)}
                  aria-label={`${labels.removeExercise} ${ex.exercise_name}`}
                  className="shrink-0 rounded-md p-1 text-zinc-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {onAddExercise && (
        <button
          type="button"
          onClick={onAddExercise}
          className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z" />
          </svg>
          {labels.addExercise}
        </button>
      )}
    </div>
  );
}
