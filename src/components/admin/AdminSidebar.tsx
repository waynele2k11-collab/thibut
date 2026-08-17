"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  UserSquare2, 
  Palette, 
  Store,
  BookOpen,
  LogOut,
  Settings,
  ShieldAlert,
  CreditCard,
  Image as ImageIcon,
  Type
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const navItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Fonts", href: "/admin/fonts", icon: Type },
    { name: "Users", href: "/admin/users", icon: Users },
    { name: "Sellers", href: "/admin/sellers", icon: UserSquare2 },
    { name: "Art", href: "/admin/art", icon: Palette },
    { name: "Presets", href: "/admin/background-presets", icon: ImageIcon },
    { name: "Calligraphy", href: "/admin/ai/calligraphy", icon: Palette },
    { name: "Knowledge", href: "/admin/knowledge", icon: BookOpen },
    { name: "Gallery", href: "/admin/gallery", icon: Store },
    { name: "Orders", href: "/admin/orders", icon: CreditCard },
    { name: "Finance", href: "/admin/finance", icon: CreditCard },
    // Mock future routes to show layout
    { name: "Moderation", href: "#", icon: ShieldAlert, disabled: true },
    { name: "Settings", href: "#", icon: Settings, disabled: true },
  ];

  return (
    <div className="w-64 bg-[#F4EFE6] border-r border-[#E5E0D8] flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-[#E5E0D8]">
        <Link href="/admin" className="font-display-md text-xl tracking-wide text-[#111111]">
          THI BÚT <span className="text-[#B3261E]">ADMIN</span>
        </Link>
      </div>

      <nav className="flex-1 py-6 flex flex-col gap-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          if (item.disabled) {
            return (
              <div 
                key={item.name} 
                className="flex items-center gap-3 px-6 py-3 text-[#A09D96] cursor-not-allowed"
                title="Coming soon"
              >
                <Icon className="w-5 h-5 opacity-50" />
                <span className="font-label-caps text-sm uppercase">{item.name}</span>
              </div>
            );
          }

          return (
            <Link 
              key={item.name} 
              href={item.href}
              className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                isActive 
                  ? "bg-[#EAE4DA] text-[#B3261E] border-r-4 border-[#B3261E]" 
                  : "text-[#4A4844] hover:bg-[#EAE4DA]/50 hover:text-[#111111]"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-label-caps text-sm uppercase tracking-wider">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#E5E0D8]">
        <button 
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3 text-[#4A4844] hover:bg-[#EAE4DA] hover:text-[#111111] transition-colors rounded-lg"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-label-caps text-sm uppercase">Log Out</span>
        </button>
      </div>
    </div>
  );
}
