"use client";

import { useState, useEffect, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DropdownMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  /** Optional leading icon (svg or emoji). */
  icon?: React.ReactNode;
  /** Optional destructive style (red). */
  destructive?: boolean;
}

export interface DropdownMenuProps {
  /** Trigger content (text + optional chevron). */
  trigger: React.ReactNode;
  items: DropdownMenuItem[];
  /** Alignment of the panel. Defaults to right. */
  align?: "left" | "right";
  /** Extra classes for the trigger button. */
  triggerClassName?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DropdownMenu({
  trigger,
  items,
  align = "right",
  triggerClassName = "",
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {open && (
        <div
          role="menu"
          className={[
            "absolute top-full z-30 mt-1 w-56 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          ].join(" ")}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={[
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                item.destructive
                  ? "text-red-600 hover:bg-red-50"
                  : "text-zinc-700 hover:bg-zinc-50",
              ].join(" ")}
            >
              {item.icon && <span className="flex h-4 w-4 shrink-0 items-center justify-center">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
