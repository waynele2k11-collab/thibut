import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { requireAdmin } from "@/utils/admin/auth";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thi Bút Admin",
  description: "Internal Operations Console",
  robots: { index: false, follow: false }
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enforce ADMIN role on the server for all routes under /admin
  const user = await requireAdmin();

  return (
    <div className="flex h-screen bg-[#FCFAF6] font-body text-[#111111]">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <AdminHeader user={user} />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
