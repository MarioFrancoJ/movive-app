"use client";

import { useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WeekDayHeaderProps {
  /** Localized abbreviated day label (Lun, Mar, Mié…). */
  dayLabel: string;
  /** Short date label (Sep 14). */
  dateLabel: string;
  /** Optional menu content rendered inside a ⋮ popover. */
  menu?: React.ReactNode;
  /** Whether the menu is currently open (controlled by parent). */
  menuOpen?: boolean;
  /** Callback to toggle the menu open state. */
  onMenuToggle?: () => void;
  /** Callback to close the menu (fired on outside click / Escape). */
  onMenuClose?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WeekDayHeader({
  dayLabel,
  dateLabel,
  menu,
  menuOpen = false,
  onMenuToggle,
  onMenuClose,
}: WeekDayHeaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMenu = Boolean(menu) && typeof onMenuToggle === "function";

  // Close menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen || !hasMenu) return;

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onMenuClose?.();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onMenuClose?.();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen, hasMenu, onMenuClose]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-start justify-between gap-1 px-1 pb-1"
    >
      {/* Day + date — aligned left */}
      <div className="flex flex-col">
        <span className="text-sm font-bold tracking-tight text-zinc-800">
          {dayLabel}
        </span>
        <span className="mt-0.5 text-xs font-normal text-zinc-400">
          {dateLabel}
        </span>
      </div>

      {/* Optional ⋮ menu trigger */}
      {hasMenu && (
        <>
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label={`${dayLabel} options`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M10 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM10 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM11.5 15.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
            </svg>
          </button>
          {menuOpen && menu}
        </>
      )}
    </div>
  );
}
