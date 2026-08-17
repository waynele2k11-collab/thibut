import { MetricCard } from "@/components/admin/MetricCard";
import prisma from "@/lib/prisma";

export default async function AdminDashboard() {
  // Fetch real counts from Prisma
  const [
    totalUsers,
    activeSellers,
    publishedDesigns,
    totalGalleryProducts,
    pendingReviewsCount,
    failedOrdersCount,
    heldPayoutsCount,
    recentDesigns
  ] = await Promise.all([
    prisma.user.count(),
    prisma.creatorProfile.count({ where: { status: "ACTIVE" } }),
    prisma.design.count({ where: { status: "PUBLISHED" } }),
    prisma.designProduct.count({ where: { active: true } }),
    prisma.design.count({ where: { status: "REVIEW" } }),
    prisma.order.count({ where: { fulfillmentStatus: "FAILED" } }),
    prisma.creatorEarning.count({ where: { status: "HELD" } }),
    prisma.design.findMany({ 
      take: 5, 
      orderBy: { createdAt: "desc" },
      include: { creator: true }
    })
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display-md text-display-sm text-[#111111] mb-2">Dashboard</h1>
        <p className="font-body text-[#A09D96]">Operational overview of the Thi Bút platform.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard 
          title="Total Users" 
          value={totalUsers} 
          trend="+12%" 
          trendUp={true} 
        />
        <MetricCard 
          title="Active Sellers" 
          value={activeSellers} 
          trend="+3" 
          trendUp={true} 
        />
        <MetricCard 
          title="Published Designs" 
          value={publishedDesigns} 
        />
        <MetricCard 
          title="Gallery Products" 
          value={totalGalleryProducts} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
          <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">
            Operational Alerts
          </h2>
          <div className="space-y-4">
            {pendingReviewsCount > 0 ? (
              <div className="flex items-center justify-between p-4 bg-[#FFF5F5] border border-[#FEE2E2] rounded-lg">
                <span className="text-[#B3261E] font-medium text-sm">{pendingReviewsCount} artwork submissions awaiting review</span>
                <button className="text-xs font-label-caps uppercase text-[#B3261E] hover:underline">Review</button>
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-100 rounded-lg">
                <span className="text-green-800 font-medium text-sm">No artwork submissions awaiting review.</span>
              </div>
            )}
            
            {failedOrdersCount > 0 && (
              <div className="flex items-center justify-between p-4 bg-[#FFF5F5] border border-[#FEE2E2] rounded-lg">
                <span className="text-[#B3261E] font-medium text-sm">{failedOrdersCount} failed Printful orders</span>
                <button className="text-xs font-label-caps uppercase text-[#B3261E] hover:underline">View</button>
              </div>
            )}

            {heldPayoutsCount > 0 && (
              <div className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <span className="text-yellow-800 font-medium text-sm">{heldPayoutsCount} creator payouts on hold</span>
                <button className="text-xs font-label-caps uppercase text-yellow-800 hover:underline">View</button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl p-6">
           <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96] mb-6">
            Recent Activity
          </h2>
          <div className="space-y-4">
            {recentDesigns.map(design => (
              <div key={design.id} className="flex items-center gap-3 p-3 bg-white border border-[#E5E0D8] rounded-lg">
                <div className="w-2 h-2 rounded-full bg-[#B3261E]"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#111111]">
                    {design.creator.displayName} submitted <span className="font-bold">{design.title}</span>
                  </p>
                  <p className="text-xs text-[#A09D96] mt-0.5">
                    {new Date(design.createdAt).toLocaleDateString()} at {new Date(design.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <span className="text-[10px] font-label-caps uppercase bg-[#F4EFE6] px-2 py-1 rounded text-[#A09D96]">
                  {design.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
