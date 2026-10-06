"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState, useRef } from "react";
import ExercisePreviewPopover from "./ExercisePreviewPopover";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SortableExercise {
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

export interface SortableExerciseRowProps {
  exercise: SortableExercise;
  labels: {
    rest: string;
    editExercise: string;
    removeExercise: string;
    // Popover
    popMuscles: string;
    popCategory: string;
    popDifficulty: string;
    popWatchVideo: string;
    popNoVideo: string;
  };
  onUpdate?: (
    exerciseId: string,
    updates: { sets: number; reps: number; rest_seconds: number }
  ) => void;
  onRemove?: (exerciseId: string) => void;
  onOpenEditModal?: (exercise: SortableExercise) => void;
  onOpenDetail?: (exercise: SortableExercise) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SortableExerciseRow({
  exercise,
  labels,
  onUpdate,
  onRemove,
  onOpenEditModal,
  onOpenDetail,
}: SortableExerciseRowProps) {
  const [editing, setEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: exercise.id, disabled: editing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasVideo = !!exercise.video_url;

  // ── Hover handlers (solo desktop) ──
  function handleMouseEnter() {
    if (editing) return;
    hoverTimer.current = setTimeout(() => setShowPreview(true), 250);
  }

  function handleMouseLeave() {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    setShowPreview(false);
  }

  // ── Click en thumbnail → modal ──
  function handleThumbnailClick() {
    onOpenDetail?.(exercise);
  }

  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        (rowRef as any).current = node;
      }}
      style={style}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={[
        "group relative flex items-start gap-3 rounded-lg transition-shadow",
        isDragging ? "opacity-50 shadow-lg z-10 relative bg-white" : "",
      ].join(" ")}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
        title="Arrastra para reordenar"
        className="mt-3 flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded text-zinc-300 transition-colors hover:bg-zinc-100 hover:text-zinc-600 active:cursor-grabbing"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M7 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM7 10a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM5.5 17.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 4a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM14.5 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM16 15a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        </svg>
      </button>

      {/* Thumbnail — click abre modal */}
      <button
        type="button"
        onClick={handleThumbnailClick}
        aria-label={`${exercise.exercise_name} — ver detalle`}
        className="relative flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-zinc-100 transition-transform hover:scale-105"
      >
        {exercise.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={exercise.image_url}
            alt={exercise.exercise_name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-2xl">💪</span>
        )}
        {hasVideo && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-white drop-shadow" aria-hidden="true">
              <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" />
            </svg>
          </span>
        )}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1 pt-1">
        {editing ? (
          <InlineEditor
            exercise={exercise}
            labels={labels}
            onSave={(next) => {
              onUpdate?.(exercise.id, next);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <p className="text-sm font-medium text-zinc-900">{exercise.exercise_name}</p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              disabled={!onUpdate}
              className="mt-0.5 block text-left text-xs text-zinc-500 transition-colors hover:text-zinc-800 disabled:cursor-default disabled:hover:text-zinc-500"
            >
              {exercise.sets}×{exercise.reps} · {labels.rest} {exercise.rest_seconds}s
            </button>
            {exercise.notes && (
              <p className="mt-1 text-xs text-zinc-400">{exercise.notes}</p>
            )}
          </>
        )}
      </div>

      {/* Actions (hover) */}
      {!editing && (
        <div className="mt-1 flex shrink-0 items-center gap-1">
          {onOpenEditModal && (
            <button
              type="button"
              onClick={() => onOpenEditModal(exercise)}
              aria-label={`${labels.editExercise} ${exercise.exercise_name}`}
              className="rounded-md p-1 text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
                <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
              </svg>
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(exercise.id)}
              aria-label={`${labels.removeExercise} ${exercise.exercise_name}`}
              className="rounded-md p-1 text-zinc-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Hover preview popover (desktop) */}
      {showPreview && !editing && !isDragging && (
        <ExercisePreviewPopover
          name={exercise.exercise_name}
          imageUrl={exercise.image_url ?? null}
          videoUrl={exercise.video_url ?? null}
          muscleGroup={exercise.muscle_group ?? null}
          category={exercise.category ?? null}
          difficulty={exercise.difficulty ?? null}
          labels={{
            muscles: labels.popMuscles,
            category: labels.popCategory,
            difficulty: labels.popDifficulty,
            watchVideo: labels.popWatchVideo,
            noVideo: labels.popNoVideo,
          }}
        />
      )}
    </div>
  );
}

// ── Inline editor ─────────────────────────────────────────────────────────────

function InlineEditor({
  exercise,
  labels,
  onSave,
  onCancel,
}: {
  exercise: SortableExercise;
  labels: { rest: string };
  onSave: (next: { sets: number; reps: number; rest_seconds: number }) => void;
  onCancel: () => void;
}) {
  const [sets, setSets] = useState(String(exercise.sets));
  const [reps, setReps] = useState(String(exercise.reps));
  const [rest, setRest] = useState(String(exercise.rest_seconds));

  function commit() {
    const nSets = Math.max(1, parseInt(sets, 10) || 1);
    const nReps = Math.max(1, parseInt(reps, 10) || 1);
    const nRest = Math.max(0, parseInt(rest, 10) || 0);
    onSave({ sets: nSets, reps: nReps, rest_seconds: nRest });
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { e.preventDefault(); onCancel(); }
  }

  return (
    <div>
      <p className="text-sm font-medium text-zinc-900">{exercise.exercise_name}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs" onKeyDown={onKey}>
        <input
          type="number"
          min={1}
          value={sets}
          onChange={(e) => setSets(e.target.value)}
          autoFocus
          className="h-7 w-14 rounded-md border border-zinc-300 bg-white px-2 text-center text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />
        <span className="text-zinc-400">×</span>
        <input
          type="number"
          min={1}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="h-7 w-14 rounded-md border border-zinc-300 bg-white px-2 text-center text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />
        <span className="text-zinc-400">·</span>
        <input
          type="number"
          min={0}
          value={rest}
          onChange={(e) => setRest(e.target.value)}
          className="h-7 w-16 rounded-md border border-zinc-300 bg-white px-2 text-center text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none"
        />
        <span className="text-zinc-400">s</span>
        <button
          type="button"
          onClick={commit}
          className="ml-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-white hover:bg-primary-hover"
        >
          OK
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-[11px] font-medium text-zinc-500 hover:text-zinc-900"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
