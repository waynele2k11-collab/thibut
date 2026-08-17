import prisma from "@/lib/prisma";
import Link from "next/link";
import { format } from "date-fns";

export default async function AdminSellersPage() {
  const sellers = await prisma.creatorProfile.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      user: true,
      _count: {
        select: { designs: true }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-md text-display-sm text-[#111111] mb-2">Sellers</h1>
          <p className="font-body text-[#A09D96]">Manage creator profiles and onboarding.</p>
        </div>
      </div>

      <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F4EFE6] border-b border-[#E5E0D8]">
            <tr>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Creator</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Stripe Ready</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Designs</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E0D8]">
            {sellers.map((seller) => (
              <tr key={seller.id} className="hover:bg-[#F4EFE6]/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <Link href={`/admin/sellers/${seller.id}`} className="font-medium text-[#B3261E] hover:underline">
                      {seller.displayName}
                    </Link>
                    <span className="text-xs text-[#A09D96]">@{seller.slug}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                    seller.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 
                    seller.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {seller.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                   <span className={`inline-flex px-2 py-1 text-xs rounded-full font-medium ${
                    seller.stripeAccountId ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {seller.stripeAccountId ? "CONNECTED" : "PENDING"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#4A4844]">
                  {seller._count.designs}
                </td>
                <td className="px-6 py-4 text-sm text-[#A09D96]">
                  {format(new Date(seller.createdAt), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
            {sellers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-[#A09D96]">No sellers found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
