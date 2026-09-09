"use client";

import { useState, useCallback } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { ToastProvider } from "@/components/ui/Toast";
import { SandboxProvider } from "@/contexts/SandboxContext";
import SandboxBanner from "@/components/ui/SandboxBanner";
import { DictionaryProvider } from "@/lib/i18n/DictionaryProvider";
import type { Dictionary } from "@/lib/i18n/getDictionary";
import type { Locale } from "@/lib/i18n/config";

interface AppShellProps {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}

export default function AppShell({ locale, dict, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <DictionaryProvider dict={dict} locale={locale}>
      <ToastProvider>
        <SandboxProvider>
          {/* h-dvh (not h-screen) avoids the mobile 100vh overflow that made the
              body scroll in addition to <main> — guaranteeing a single scroll.
              min-h-0 lets the flex child shrink so only <main> scrolls. */}
          <div className="flex h-dvh overflow-hidden bg-zinc-50">
            <Sidebar open={sidebarOpen} onClose={handleSidebarClose} />
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <SandboxBanner />
              <Topbar locale={locale} onMenuToggle={handleMenuToggle} />
              <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
            </div>
          </div>
        </SandboxProvider>
      </ToastProvider>
    </DictionaryProvider>
  );
}
