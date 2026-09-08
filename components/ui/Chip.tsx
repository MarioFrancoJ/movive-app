"use client";

import type { ReactNode } from "react";

/**
 * Chip — the single source of truth for interactive selection chips and
 * segmented controls across Movive (day/slot pickers, filters, single/multi
 * selection, visual tabs).
 *
 * The canonical visual language is the one established by `MealPlanModal`
 * (day + meal-slot chips): a squared `rounded-golden-md` radius, `text-golden-xs`
 * `font-semibold`, primary-filled active state and a ringed white inactive
 * state. This component freezes that language so no screen re-invents a
 * "pill" (`rounded-full`) or ad-hoc variant.
 *
 * Accessibility:
 * - `selectionMode="multi"` (default) → renders `aria-pressed` (toggle/filter).
 * - `selectionMode="single"` → renders `role="radio"` + `aria-checked`
 *   (one-of-many). Wrap a group of single chips in a container with
 *   `role="radiogroup"` and an `aria-label`.
 *
 * Purely presentational: it owns styling only, never state. Callers keep all
 * logic, i18n and handlers.
 */
interface ChipProps {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  /** How the active state is exposed to assistive tech. Default: "multi". */
  selectionMode?: "multi" | "single";
  disabled?: boolean;
  /** Native title tooltip (used by the day chips for the full weekday name). */
  title?: string;
  /** Let a chip stretch to fill an equal-width segmented row (e.g. day picker). */
  fill?: boolean;
  /** Extra layout-only classes (widths, grid placement). No visual overrides. */
  className?: string;
}

// Frozen visual DNA — matches MealPlanModal's day/slot chips exactly.
const BASE =
  "inline-flex min-h-[44px] items-center justify-center rounded-golden-md px-golden-1 text-golden-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed sm:min-h-[38px]";
const ACTIVE = "bg-primary text-white";
const INACTIVE = "bg-white text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-100";

export default function Chip({
  children,
  active,
  onClick,
  selectionMode = "multi",
  disabled = false,
  title,
  fill = false,
  className = "",
}: ChipProps) {
  const a11y =
    selectionMode === "single"
      ? { role: "radio" as const, "aria-checked": active }
      : { "aria-pressed": active };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      {...a11y}
      className={[BASE, active ? ACTIVE : INACTIVE, fill ? "flex-1" : "", className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}
