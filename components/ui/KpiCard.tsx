"use client";

import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KpiCardProps {
  /** Optional emoji or icon element. Rendered inside a leading square. */
  icon?: React.ReactNode;
  /** Uppercase label above the value. Required. */
  label: string;
  /** Primary value (number + unit). Required. */
  value: string;
  /** Optional small text below the value. */
  sub?: string;
  /** Optional destination URL — makes the whole card clickable. */
  href?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function KpiCard({ icon, label, value, sub, href }: KpiCardProps) {
  const inner = (
    <>
      {icon && (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-golden-md bg-zinc-100 text-golden-md">
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-golden-xs font-bold uppercase tracking-widest text-zinc-400">
          {label}
        </p>
        <p className="mt-golden-1 truncate text-golden-base font-bold text-zinc-900">
          {value}
        </p>
        {sub && <p className="truncate text-golden-xs text-zinc-400">{sub}</p>}
      </div>
      {href && (
        <svg
          className="h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      )}
    </>
  );

  // Clickable variant — wraps in a Link and adds hover + group class.
  if (href) {
    return (
      <Link
        href={href}
        className="group flex items-center gap-golden-3 rounded-golden-lg border border-zinc-200 bg-white px-golden-3 py-golden-2 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-300"
      >
        {inner}
      </Link>
    );
  }

  // Non-clickable variant — plain div.
  return (
    <div className="flex items-center gap-golden-3 rounded-golden-lg border border-zinc-200 bg-white px-golden-3 py-golden-2 shadow-sm">
      {inner}
    </div>
  );
}
