"use client";

export interface ApplyTemplateModalProps {
  labels: {
    title: string;
    message: string;
    replace: string;
    fillEmpty: string;
    cancel: string;
  };
  onReplace: () => void;
  onFillEmpty: () => void;
  onCancel: () => void;
}

export default function ApplyTemplateModal({
  labels,
  onReplace,
  onFillEmpty,
  onCancel,
}: ApplyTemplateModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-lg font-bold text-zinc-900">{labels.title}</h2>
        <p className="mb-5 text-sm text-zinc-500">{labels.message}</p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onReplace}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {labels.replace}
          </button>
          <button
            type="button"
            onClick={onFillEmpty}
            className="w-full rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            {labels.fillEmpty}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
          >
            {labels.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
