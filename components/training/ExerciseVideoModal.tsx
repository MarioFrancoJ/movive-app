"use client";

import { useEffect } from "react";

export interface ExerciseVideoModalProps {
  name: string;
  videoUrl: string;
  onClose: () => void;
}

export default function ExerciseVideoModal({
  name,
  videoUrl,
  onClose,
}: ExerciseVideoModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-black"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>

        <video
          src={videoUrl}
          controls
          autoPlay
          loop
          playsInline
          className="h-auto max-h-[80vh] w-full"
        />

        <div className="border-t border-white/10 bg-black/90 px-4 py-3">
          <p className="text-sm font-semibold text-white">{name}</p>
        </div>
      </div>
    </div>
  );
}
