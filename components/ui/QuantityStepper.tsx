"use client";

/**
 * QuantityStepper — shared numeric selector rendered as [−] value [+].
 *
 * Single source of truth for portion/quantity selection across Movive
 * (recipe detail, meal-plan assignments, meal logging). Replaces bare
 * `<input type="number">` controls so every flow shares the same touch
 * targets, spacing and radius tokens.
 *
 * Design notes:
 * - Touch target ≥ 44px on mobile (`h-11 w-11`), condensing to 36px on ≥sm.
 * - `min` / `max` are configurable; buttons disable at the bounds.
 * - Accessible: `aria-label`s on both buttons, the value is `aria-live`
 *   so screen readers announce changes, and a hidden `<output>` exposes
 *   the current value bound to the group's `aria-label`.
 * - Radius: uses the design system's `rounded-golden-md` token.
 *
 * Purely presentational — it never mutates data itself, only calls
 * `onChange` with the clamped next value. Business logic stays in callers.
 */
interface QuantityStepperProps {
  value: number;
  onChange: (next: number) => void;
  /** Lower bound (inclusive). Defaults to 1. */
  min?: number;
  /** Upper bound (inclusive). Defaults to Infinity (no cap). */
  max?: number;
  /** Increment applied per button press. Defaults to 1. */
  step?: number;
  /** Accessible label for the whole control (e.g. "Servings"). */
  ariaLabel: string;
  /** Accessible label for the decrement button. */
  decrementLabel: string;
  /** Accessible label for the increment button. */
  incrementLabel: string;
  disabled?: boolean;
}

export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  ariaLabel,
  decrementLabel,
  incrementLabel,
  disabled = false,
}: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;

  function decrement() {
    if (disabled) return;
    onChange(Math.max(min, value - step));
  }
  function increment() {
    if (disabled) return;
    onChange(Math.min(max, value + step));
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex items-center rounded-golden-md ring-1 ring-inset ring-zinc-200"
    >
      <button
        type="button"
        onClick={decrement}
        disabled={disabled || atMin}
        aria-label={decrementLabel}
        className="flex h-11 w-11 items-center justify-center rounded-l-golden-md text-golden-base font-bold text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-30 disabled:hover:bg-transparent sm:h-9 sm:w-9"
      >
        −
      </button>
      <output
        aria-live="polite"
        className="w-10 text-center text-golden-sm font-semibold text-zinc-900 sm:w-8"
      >
        {value}
      </output>
      <button
        type="button"
        onClick={increment}
        disabled={disabled || atMax}
        aria-label={incrementLabel}
        className="flex h-11 w-11 items-center justify-center rounded-r-golden-md text-golden-base font-bold text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-30 disabled:hover:bg-transparent sm:h-9 sm:w-9"
      >
        +
      </button>
    </div>
  );
}
