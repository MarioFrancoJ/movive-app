import type { Metadata } from "next";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";
import AdminGuard from "@/components/admin/AdminGuard";
import AuthGuard from "@/components/auth/AuthGuard";
import { DictionaryProvider } from "@/lib/i18n/DictionaryProvider";
import { getLocaleCookie } from "@/lib/i18n/actions";
import { getDictionary } from "@/lib/i18n/getDictionary";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Admin",
  };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocaleCookie();
  const dict = await getDictionary(locale);

  return (
    <AuthGuard>
      <AdminGuard>
        <DictionaryProvider dict={dict} locale={locale}>
          <div className="flex h-screen overflow-hidden bg-zinc-50">
            <AdminSidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
              <AdminTopbar />
              <main className="flex-1 overflow-y-auto p-6">{children}</main>
            </div>
          </div>
        </DictionaryProvider>
      </AdminGuard>
    </AuthGuard>
  );
}
