import type { User } from "@prisma/client";

interface Props {
  user: User;
}

export function AdminHeader({ user }: Props) {
  return (
    <header className="h-20 bg-surface-container-lowest border-b border-surface-variant flex items-center justify-between px-8 sticky top-0 z-10">
      <div id="admin-header-context" className="flex items-center gap-4" />

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-label-caps text-label-caps uppercase text-on-surface">
            {user.name || "Admin"}
          </p>
          <p className="font-body-md text-xs text-on-surface-variant">
            {user.email}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center font-headline-sm text-base text-secondary">
          {user.name ? user.name.charAt(0).toUpperCase() : "A"}
        </div>
      </div>
    </header>
  );
}
