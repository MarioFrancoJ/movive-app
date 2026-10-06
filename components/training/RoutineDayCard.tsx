"use client";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import SortableExerciseRow from "./SortableExerciseRow";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RoutineExercise {
  id: string;
  exercise_name: string;
  sets: number;
  reps: number;
  rest_seconds: number;
  notes: string | null;
  sort_order: number;
  image_url?: string | null;
  video_url?: string | null;
  muscle_group?: string | null;
  category?: string | null;
  difficulty?: string | null;
}

export interface RoutineDayCardProps {
  dayName?: string;
  exercises: RoutineExercise[];
  labels: {
    restDay: string;
    rest: string;
    addExercise: string;
    removeExercise: string;
    editExercise: string;
    exercisesCount?: string;
    // Popover labels
    popMuscles?: string;
    popCategory?: string;
    popDifficulty?: string;
    popWatchVideo?: string;
    popNoVideo?: string;
  };
  onAddExercise?: () => void;
  onRemoveExercise?: (exerciseId: string) => void;
  onUpdateExercise?: (
    exerciseId: string,
    updates: { sets: number; reps: number; rest_seconds: number }
  ) => void;
  onOpenEditModal?: (exercise: RoutineExercise) => void;
  onReorderExercises?: (orderedIds: string[]) => void;
  onOpenDetail?: (exercise: RoutineExercise) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RoutineDayCard({
  dayName,
  exercises,
  labels,
  onAddExercise,
  onRemoveExercise,
  onUpdateExercise,
  onOpenEditModal,
  onReorderExercises,
  onOpenDetail,
}: RoutineDayCardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = exercises.findIndex((e) => e.id === active.id);
    const newIndex = exercises.findIndex((e) => e.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(exercises, oldIndex, newIndex);
    onReorderExercises?.(reordered.map((e) => e.id));
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      {/* Header de la card: día + count */}
      {dayName && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-base font-bold text-zinc-900">{dayName}</p>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-500">
            {exercises.length} {labels.exercisesCount ?? "ejercicios"}
          </span>
        </div>
      )}

      {exercises.length === 0 ? (
        <p className="text-sm text-zinc-400">{labels.restDay}</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={exercises.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-3">
              {exercises.map((ex) => (
                <SortableExerciseRow
                  key={ex.id}
                  exercise={ex}
                  labels={{
                    rest: labels.rest,
                    editExercise: labels.editExercise,
                    removeExercise: labels.removeExercise,
                    popMuscles: labels.popMuscles ?? "Músculos",
                    popCategory: labels.popCategory ?? "Categoría",
                    popDifficulty: labels.popDifficulty ?? "Dificultad",
                    popWatchVideo: labels.popWatchVideo ?? "Ver video",
                    popNoVideo: labels.popNoVideo ?? "Sin video",
                  }}
                  onUpdate={onUpdateExercise}
                  onRemove={onRemoveExercise}
                  onOpenEditModal={onOpenEditModal}
                  onOpenDetail={onOpenDetail}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
