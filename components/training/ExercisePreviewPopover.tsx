"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExercisePreviewPopoverProps {
  name: string;
  imageUrl: string | null;
  videoUrl: string | null;
  muscleGroup: string | null;
  category: string | null;
  difficulty: string | null;
  labels: {
    muscles: string;
    category: string;
    difficulty: string;
    watchVideo: string;
    noVideo: string;
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExercisePreviewPopover({
  name,
  imageUrl,
  videoUrl,
  muscleGroup,
  category,
  difficulty,
  labels,
}: ExercisePreviewPopoverProps) {
  const hasVideo = !!videoUrl;

  return (
    <div
      className="pointer-events-none absolute left-full top-1/2 z-30 ml-2 w-64 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white shadow-xl"
      role="tooltip"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video w-full overflow-hidden rounded-t-xl bg-zinc-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-zinc-300">
            💪
          </div>
        )}
        {hasVideo && (
          <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            ▶ {labels.watchVideo}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold text-zinc-900">{name}</p>

        <div className="mt-2 flex flex-wrap gap-1">
          {muscleGroup && (
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
              {muscleGroup}
            </span>
          )}
          {category && (
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
              {category}
            </span>
          )}
          {difficulty && (
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
              {difficulty}
            </span>
          )}
        </div>

        {!hasVideo && (
          <p className="mt-2 text-[10px] text-zinc-400">{labels.noVideo}</p>
        )}
      </div>
    </div>
  );
}
