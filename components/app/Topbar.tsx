"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/config";
import LanguageMenu from "@/components/i18n/LanguageMenu";
import NotificationPanel from "./NotificationPanel";
import SearchPanel from "./SearchPanel";
import { createClient } from "@/lib/supabase/client";
import { useSandbox } from "@/contexts/SandboxContext";
import { useDictionary } from "@/lib/i18n/DictionaryProvider";

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-zinc-400" aria-hidden="true">
      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path fillRule="evenodd" d="M4 8a6 6 0 1 1 12 0c0 1.887.454 3.665 1.257 5.234a.75.75 0 0 1-.515 1.076 32.903 32.903 0 0 1-3.256.508 3.5 3.5 0 0 1-6.972 0 32.91 32.91 0 0 1-3.256-.508.75.75 0 0 1-.515-1.076A11.448 11.448 0 0 0 4 8Zm6 7.5a2 2 0 0 1-1.95-1.557 33.54 33.54 0 0 0 3.9 0A2 2 0 0 1 10 15.5Z" clipRule="evenodd" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
    </svg>
  );
}

// ── Sandbox Toggle ────────────────────────────────────────────────────────────

function SandboxToggle() {
  const { dict } = useDictionary();
  const t = dict.topbar;
  const { isSandbox, toggleSandbox } = useSandbox();
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    await toggleSandbox();
    setToggling(false);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={toggling}
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold transition-colors",
        isSandbox
          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200",
      ].join(" ")}
      title={isSandbox ? t.exitSandbox : t.enterSandbox}
    >
      <span className="relative flex h-3 w-6 items-center rounded-full bg-current/20">
        <span
          className={[
            "absolute h-2.5 w-2.5 rounded-full transition-all duration-200",
            isSandbox ? "left-3 bg-amber-600" : "left-0.5 bg-zinc-400",
          ].join(" ")}
        />
      </span>
      {isSandbox ? t.sandboxOn : t.sandbox}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface TopbarProps {
  locale: Locale;
  onMenuToggle?: () => void;
}

export default function Topbar({ locale, onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const { dict } = useDictionary();
  const t = dict.topbar;
  const { isSuperAdmin, role } = useSandbox();
  const [unread, setUnread] = useState(0);
  const [userInitial, setUserInitial] = useState("U");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const name = user.user_metadata?.name || user.email || "";
      setUserInitial(name.charAt(0).toUpperCase() || "U");

      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "Unread");

      setUnread(count || 0);
    }
    loadData();

    // Keyboard shortcut: "/" to open search
    function handleSlash(e: KeyboardEvent) {
      if (e.key === "/" && !searchOpen && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handleSlash);
    return () => document.removeEventListener("keydown", handleSlash);
  }, [searchOpen]);

  function toggleNotifications() {
    setNotificationsOpen((prev) => !prev);
  }

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false);
  }, []);

  const handleUnreadCountChange = useCallback((count: number) => {
    setUnread(count);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-100 bg-white px-4 md:px-6">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {/* Hamburger - mobile only */}
        <button
          type="button"
          onClick={onMenuToggle}
          aria-label={dict.nav.openMenu}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 md:hidden"
        >
          <IconMenu />
        </button>

        {/* Search trigger */}
        <div className="relative hidden sm:block">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-64 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 pl-3 pr-3 text-sm text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-white"
          >
            <IconSearch />
            <span>{t.searchPlaceholder}</span>
            <kbd className="ml-auto rounded border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-xs text-zinc-400">/</kbd>
          </button>
          <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
        </div>

        {/* Mobile search button */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label={dict.common.search}
          className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 sm:hidden"
        >
          <IconSearch />
        </button>
        {/* Mobile search panel */}
        <div className="sm:hidden">
          <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
        </div>
      </div>

      {/* Right actions */}
<div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2 md:gap-3">
  {/* Language switcher - hidden on small mobile */}
  <div className="hidden sm:block">
    <LanguageMenu currentLocale={locale} />
  </div>

  {/* Notifications */}
  <div className="relative">
    <button
      type="button"
      onClick={toggleNotifications}
      aria-label={t.notifications}
      aria-expanded={notificationsOpen}
      className={[
        "relative rounded-lg p-1.5 sm:p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300",
        notificationsOpen ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900",
      ].join(" ")}
    >
      <IconBell />
      {unread > 0 && (
        <span aria-label={`${unread} unread`} className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>

    <NotificationPanel isOpen={notificationsOpen} onClose={closeNotifications} onUnreadCountChange={handleUnreadCountChange} />
  </div>

  {/* SuperAdmin badge + Sandbox toggle */}
  {isSuperAdmin && (
    <div className="flex items-center gap-1 sm:gap-2">
      {/* Badge: icon only on small screens, full text on larger */}
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-bold text-purple-700 sm:px-2">
        <span>⚡</span>
        <span className="hidden sm:inline">{t.superAdmin}</span>
      </span>
      <SandboxToggle />
    </div>
  )}

  {/* User avatar */}
  <Link
    href="/profile"
    aria-label={t.openProfile}
    title={t.profile}
    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
  >
    {userInitial}
  </Link>

  {/* Logout - hidden on mobile, shows on desktop */}
  <button
    type="button"
    onClick={handleLogout}
    aria-label={t.signOut}
    className="hidden rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 md:block"
  >
    {t.signOut}
  </button>
</div>
    </header>
  );
}
