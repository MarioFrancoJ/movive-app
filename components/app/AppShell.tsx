"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();

  const handleMenuToggle = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  // Red de seguridad: limpiar el body al cambiar de ruta.
  // Evita que el body quede con overflow:hidden después de usar un modal/bottom sheet.
  useEffect(() => {
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.height = "";
  }, [pathname]);

  return (
    <DictionaryProvider dict={dict} locale={locale}>
      <ToastProvider>
        <SandboxProvider>
          <div className="flex h-full w-full overflow-hidden bg-zinc-50">
            <Sidebar open={sidebarOpen} onClose={handleSidebarClose} />
            <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
              <SandboxBanner />
              <Topbar locale={locale} onMenuToggle={handleMenuToggle} />
              <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="mx-auto w-full max-w-[1800px] px-4 py-4 sm:px-6 md:px-8 md:py-6 lg:px-12 xl:px-16 2xl:px-24">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </SandboxProvider>
      </ToastProvider>
    </DictionaryProvider>
  );
}
