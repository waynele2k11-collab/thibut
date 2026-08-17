import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

export default async function AdminSellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const seller = await prisma.creatorProfile.findUnique({
    where: { id },
    include: {
      user: true,
      designs: { take: 5, orderBy: { createdAt: "desc" } }
    }
  });

  if (!seller) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <Link href="/admin/sellers" className="inline-flex items-center text-sm font-label-caps uppercase text-[#A09D96] hover:text-[#111111] transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sellers
      </Link>

      <div>
        <h1 className="font-display-md text-display-sm text-[#111111] mb-2">{seller.displayName}</h1>
        <p className="font-body text-[#A09D96]">@{seller.slug}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">Profile</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">User Account</span>
                <span className="col-span-2 text-sm text-[#B3261E] hover:underline">
                  <Link href={`/admin/users/${seller.userId}`}>{seller.user.email}</Link>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">Bio</span>
                <span className="col-span-2 text-sm text-[#111111]">{seller.bio || "None provided"}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">Joined</span>
                <span className="col-span-2 text-sm text-[#111111]">{format(new Date(seller.createdAt), "PPP")}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">Stripe Status (Read-Only)</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">Connected Account ID</span>
                <span className="col-span-2 text-sm text-[#111111] font-mono">{seller.stripeAccountId || "Not connected"}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">Charges Enabled</span>
                <span className="col-span-2 text-sm text-[#A09D96]">Mock: Yes</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="text-sm font-medium text-[#4A4844]">Payouts Enabled</span>
                <span className="col-span-2 text-sm text-[#A09D96]">Mock: Yes</span>
              </div>
            </div>
          </div>

          <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
             <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">Recent Designs</h2>
             {seller.designs.length > 0 ? (
              <div className="space-y-4">
                {seller.designs.map(design => (
                  <div key={design.id} className="flex items-center justify-between py-2 border-b border-[#E5E0D8] last:border-0">
                    <div>
                      <Link href={`/admin/art/${design.id}`} className="text-sm font-medium text-[#B3261E] hover:underline">
                        {design.title}
                      </Link>
                      <p className="text-xs text-[#A09D96]">{format(new Date(design.createdAt), "PPP")}</p>
                    </div>
                    <span className="text-sm font-medium">{design.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#A09D96] italic">No designs found.</p>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">Seller Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#4A4844]">Current Status</span>
                <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                  seller.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 
                  seller.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {seller.status}
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-[#FFF5F5] border border-[#FEE2E2] rounded-xl p-6">
            <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#B3261E] mb-6">Admin Actions</h2>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 rounded-lg transition-colors">
                Approve Creator
              </button>
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors">
                Restrict Creator
              </button>
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-[#B3261E] hover:bg-[#FEE2E2] rounded-lg transition-colors">
                Suspend Creator
              </button>
              <button className="w-full text-left px-4 py-2 text-sm font-medium text-[#4A4844] hover:bg-[#EAE4DA] rounded-lg transition-colors">
                Add Internal Note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
