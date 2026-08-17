import { User } from "@prisma/client";

interface Props {
  user: User;
}

export function AdminHeader({ user }: Props) {
  return (
    <header className="h-20 bg-[#FCFAF6] border-b border-[#E5E0D8] flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        {/* Breadcrumb or title context can go here */}
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-label-caps text-sm text-[#111111]">{user.name || "Admin"}</p>
          <p className="text-xs text-[#A09D96]">{user.email}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#EAE4DA] border border-[#D5D0C8] flex items-center justify-center font-display-md text-[#B3261E]">
          {user.name ? user.name.charAt(0).toUpperCase() : "A"}
        </div>
      </div>
    </header>
  );
}
