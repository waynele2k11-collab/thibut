import { adminPath } from "@/lib/admin-path";
import Link from "next/link";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/utils/admin/auth";

export default async function AdminUsersPage() {
  // Each page checks access itself; the layout is not a security boundary.
  await requireAdmin();

  const users = await prisma.user.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      roles: { include: { role: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline-md text-headline-md text-primary mb-2">
          Users
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Manage platform accounts.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low border-b border-surface-variant">
              <tr>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  User
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Email
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Status
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Roles
                </th>
                <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-surface-container-low transition-colors motion-reduce:transition-none"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={adminPath(`/users/${user.id}`)}
                      className="font-medium text-secondary hover:underline"
                    >
                      {user.name || "Unknown"}
                    </Link>
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface-variant">
                    {user.email}
                  </td>
                  <td className="px-6 py-4">
                    <Badge
                      variant={user.status === "ACTIVE" ? "default" : "outline"}
                    >
                      {user.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface">
                    {user.roles.map((r) => r.role.code).join(", ") || "USER"}
                  </td>
                  <td className="px-6 py-4 font-body-md text-sm text-on-surface-variant">
                    {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center font-body-md text-body-md text-on-surface-variant"
                  >
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
