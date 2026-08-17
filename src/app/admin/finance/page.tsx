import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { MetricCard } from "@/components/admin/MetricCard";

export default async function AdminFinancePage() {
  const [
    accounts,
    recentEarnings
  ] = await Promise.all([
    prisma.ledgerAccount.findMany({
      orderBy: { type: "asc" }
    }),
    prisma.creatorEarning.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        creator: true,
        orderItem: {
          include: {
            order: true
          }
        }
      }
    })
  ]);

  // Sum up platform revenue
  const platformAccounts = accounts.filter(a => a.ownerType === "PLATFORM");
  const totalPlatformRevenueMinor = platformAccounts.reduce((sum, acc) => sum + Number(acc.balanceMinor), 0);
  
  // Sum up creator pending payouts
  const creatorAccounts = accounts.filter(a => a.ownerType === "CREATOR");
  const totalCreatorPendingMinor = creatorAccounts.reduce((sum, acc) => sum + Number(acc.balanceMinor), 0);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-md text-display-sm text-[#111111] mb-2">Finance Ledger</h1>
          <p className="font-body text-[#A09D96]">Platform revenue, creator payouts, and ledger accounts.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard 
          title="Platform Revenue (Gross)" 
          value={`$${(totalPlatformRevenueMinor / 100).toFixed(2)}`} 
        />
        <MetricCard 
          title="Pending Creator Payouts" 
          value={`$${(totalCreatorPendingMinor / 100).toFixed(2)}`} 
        />
        <MetricCard 
          title="Active Ledger Accounts" 
          value={accounts.length} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl overflow-hidden">
          <div className="p-6 border-b border-[#E5E0D8]">
             <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96]">
              Ledger Accounts
            </h2>
          </div>
          <table className="w-full text-left">
            <thead className="bg-[#F4EFE6] border-b border-[#E5E0D8]">
              <tr>
                <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Account</th>
                <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E0D8]">
              {accounts.map(acc => (
                <tr key={acc.id} className="hover:bg-[#F4EFE6]/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-[#111111]">{acc.name}</span>
                      <span className="text-[10px] text-[#A09D96] font-mono">{acc.code}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] uppercase font-bold text-[#4A4844]">{acc.type}</span>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">
                    ${(Number(acc.balanceMinor) / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-[#A09D96]">No ledger accounts found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl overflow-hidden">
          <div className="p-6 border-b border-[#E5E0D8]">
             <h2 className="font-label-caps text-sm uppercase tracking-wider text-[#A09D96]">
              Recent Creator Earnings
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {recentEarnings.map(earning => (
              <div key={earning.id} className="flex items-center justify-between p-4 bg-white border border-[#E5E0D8] rounded-lg">
                <div>
                  <p className="text-sm font-medium text-[#111111]">{earning.creator.displayName}</p>
                  <p className="text-xs text-[#A09D96]">Order {earning.orderItem.order.orderNumber} • {format(new Date(earning.createdAt), "MMM d")}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-700">+${(Number(earning.netCreatorMinor) / 100).toFixed(2)}</p>
                  <span className={`inline-flex px-2 py-0.5 mt-1 text-[10px] rounded-full font-medium ${
                    earning.status === 'TRANSFERRED' ? 'bg-green-100 text-green-800' : 
                    earning.status === 'HELD' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {earning.status}
                  </span>
                </div>
              </div>
            ))}
            {recentEarnings.length === 0 && (
              <p className="text-sm text-center text-[#A09D96] py-4">No recent earnings found.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
