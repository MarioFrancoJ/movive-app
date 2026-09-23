"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoutineExercise {
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
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoutineDayCard({ exercises, labels }: RoutineDayCardProps) {
  if (exercises.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-zinc-400">{labels.restDay}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4">
        {exercises.map((ex, i) => (
          <div key={i}>
            <p className="text-sm font-medium text-zinc-900">{ex.exercise_name}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {ex.sets}×{ex.reps} • {labels.rest} {ex.rest_seconds}s
            </p>
            {ex.notes && (
              <p className="mt-1 text-xs text-zinc-400">{ex.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
