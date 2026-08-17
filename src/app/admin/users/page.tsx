import prisma from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      roles: { include: { role: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-md text-display-sm text-[#111111] mb-2">Users</h1>
          <p className="font-body text-[#A09D96]">Manage platform accounts.</p>
        </div>
      </div>

      <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F4EFE6] border-b border-[#E5E0D8]">
            <tr>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">User</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Email</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Roles</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E0D8]">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-[#F4EFE6]/50 transition-colors">
                <td className="px-6 py-4">
                  <Link href={`/admin/users/${user.id}`} className="font-medium text-[#B3261E] hover:underline">
                    {user.name || "Unknown"}
                  </Link>
                </td>
                <td className="px-6 py-4 text-sm text-[#4A4844]">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                    user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#4A4844]">
                  {user.roles.map(r => r.role.code).join(", ") || "USER"}
                </td>
                <td className="px-6 py-4 text-sm text-[#A09D96]">
                  {format(new Date(user.createdAt), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[#A09D96]">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
