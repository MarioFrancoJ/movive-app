"use client";

import { useState } from "react";

export interface ExerciseEditModalProps {
  exercise: {
    id: string;
    exercise_name: string;
    sets: number;
    reps: number;
    rest_seconds: number;
    notes: string | null;
  };
  labels: {
    title: string;
    sets: string;
    reps: string;
    rest: string;
    notes: string;
    notesPlaceholder: string;
    save: string;
    cancel: string;
  };
  onSave: (updates: {
    sets: number;
    reps: number;
    rest_seconds: number;
    notes: string | null;
  }) => void;
  onClose: () => void;
}

export default function ExerciseEditModal({
  exercise,
  labels,
  onSave,
  onClose,
}: ExerciseEditModalProps) {
  const [sets, setSets] = useState(String(exercise.sets));
  const [reps, setReps] = useState(String(exercise.reps));
  const [rest, setRest] = useState(String(exercise.rest_seconds));
  const [notes, setNotes] = useState(exercise.notes ?? "");

  function commit() {
    const nSets = Math.max(1, parseInt(sets, 10) || 1);
    const nReps = Math.max(1, parseInt(reps, 10) || 1);
    const nRest = Math.max(0, parseInt(rest, 10) || 0);
    onSave({
      sets: nSets,
      reps: nReps,
      rest_seconds: nRest,
      notes: notes.trim() === "" ? null : notes.trim(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-900">{exercise.exercise_name}</h2>
            <p className="text-xs text-zinc-400">{labels.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={labels.cancel}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">{labels.sets}</label>
            <input
              type="number"
              min={1}
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">{labels.reps}</label>
            <input
              type="number"
              min={1}
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">{labels.rest}</label>
            <input
              type="number"
              min={0}
              value={rest}
              onChange={(e) => setRest(e.target.value)}
              className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-zinc-600">{labels.notes}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={labels.notesPlaceholder}
            rows={3}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            onClick={commit}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover"
          >
            {labels.save}
          </button>
        </div>
      </div>
    </div>
  );
}
