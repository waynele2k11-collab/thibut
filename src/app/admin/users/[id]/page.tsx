import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: { include: { role: true } },
      creator: true,
      orders: { take: 5, orderBy: { createdAt: "desc" } }
    }
  });

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <Link href="/admin/users" className="inline-flex items-center text-sm font-label-caps uppercase text-[#A09D96] hover:text-[#111111] transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Users
      </Link>

      <div>
        <h1 className="font-display-md text-display-sm text-[#111111] mb-2">{user.name || "Unknown User"}</h1>
        <p className="font-body text-[#A09D96]">{user.email}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">Profile Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">ID</span>
                <span className="col-span-2 text-sm text-[#111111] font-mono">{user.id}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">Joined</span>
                <span className="col-span-2 text-sm text-[#111111]">{format(new Date(user.createdAt), "PPP")}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">Creator Profile</span>
                <span className="col-span-2 text-sm text-[#111111]">
                  {user.creator ? (
                    <Link href={`/admin/sellers/${user.creator.id}`} className="text-[#B3261E] hover:underline">
                      {user.creator.displayName}
                    </Link>
                  ) : "None"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">Recent Orders</h2>
            {user.orders.length > 0 ? (
              <div className="space-y-4">
                {user.orders.map(order => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b border-[#E5E0D8] last:border-0">
                    <div>
                      <p className="text-sm font-medium text-[#111111]">{order.id}</p>
                      <p className="text-xs text-[#A09D96]">{format(new Date(order.createdAt), "PPP")}</p>
                    </div>
                    <span className="text-sm font-medium">{order.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#A09D96] italic">No orders found.</p>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">Access & Roles</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#4A4844]">Status</span>
                <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                  user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {user.status}
                </span>
              </div>
              <div className="pt-4 border-t border-[#E5E0D8]">
                <span className="text-sm font-medium text-[#4A4844] block mb-2">Current Roles</span>
                <div className="flex flex-wrap gap-2">
                  {user.roles.length > 0 ? user.roles.map(r => (
                    <span key={r.roleId} className="px-2 py-1 bg-[#EAE4DA] text-xs font-label-caps uppercase rounded-md text-[#111111]">
                      {r.role.code}
                    </span>
                  )) : (
                    <span className="px-2 py-1 bg-[#EAE4DA] text-xs font-label-caps uppercase rounded-md text-[#111111]">USER</span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-[#FFF5F5] border border-[#FEE2E2] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#B3261E] mb-6">Admin Actions</h2>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-[#B3261E] hover:bg-[#FEE2E2] rounded-lg transition-colors">
                Suspend User
              </button>
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-[#4A4844] hover:bg-[#EAE4DA] rounded-lg transition-colors">
                Force Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
