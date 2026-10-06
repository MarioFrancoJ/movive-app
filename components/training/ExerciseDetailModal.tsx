"use client";

import { useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExerciseDetail {
  name: string;
  image_url: string | null;
  video_url: string | null;
  muscle_group: string | null;
  category: string | null;
  difficulty: string | null;
}

export interface ExerciseDetailModalProps {
  exercise: ExerciseDetail;
  labels: {
    close: string;
    watchVideo: string;
    noVideo: string;
    muscles: string;
    category: string;
    difficulty: string;
  };
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function muscleLabel(value: string | null): string {
  if (!value) return "—";
  // Reusamos el mapa de training.exercises.muscles en el padre.
  return value;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExerciseDetailModal({
  exercise,
  labels,
  onClose,
}: ExerciseDetailModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hasVideo = !!exercise.video_url;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={exercise.name}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button flotante */}
        <button
          type="button"
          onClick={onClose}
          aria-label={labels.close}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-zinc-600 shadow-sm transition-colors hover:bg-white hover:text-zinc-900"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>

        {/* Media */}
        <div className="relative aspect-video w-full shrink-0 bg-zinc-900">
          {hasVideo ? (
            <video
              src={exercise.video_url!}
              controls
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-contain"
            />
          ) : exercise.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={exercise.image_url}
              alt={exercise.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-6xl">
              💪
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">{exercise.name}</h2>

          <div className="flex flex-wrap gap-1.5">
            {exercise.muscle_group && (
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                {muscleLabel(exercise.muscle_group)}
              </span>
            )}
            {exercise.category && (
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                {exercise.category}
              </span>
            )}
            {exercise.difficulty && (
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700">
                {exercise.difficulty}
              </span>
            )}
          </div>

          {!hasVideo && (
            <p className="text-xs text-zinc-400">{labels.noVideo}</p>
          )}
        </div>
      </div>
    </div>
  );
}
