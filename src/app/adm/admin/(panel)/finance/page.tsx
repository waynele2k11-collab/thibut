import type { LedgerAccountType } from "@prisma/client";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatUsdMinor } from "@/lib/pricing/quote";
import { requireAdmin } from "@/utils/admin/auth";

const REVENUE_ACCOUNT_TYPES = new Set<LedgerAccountType>([
  "PLATFORM_REVENUE",
  "PLATFORM_AI_REVENUE",
  "PLATFORM_PRODUCT_REVENUE",
  "PLATFORM_MARKETPLACE_REVENUE",
  "AI_REVENUE",
]);

function formatSignedLedgerBalance(balanceMinor: bigint): string {
  if (balanceMinor === 0n) {
    return "$0.00";
  }
  const absFormatted = formatUsdMinor(balanceMinor < 0n ? -balanceMinor : balanceMinor);
  const side = balanceMinor > 0n ? "DR" : "CR";
  return `${absFormatted} ${side}`;
}

export default async function AdminFinancePage() {
  await requireAdmin();

  const [accounts, postingGroups, recentEarnings] = await Promise.all([
    prisma.ledgerAccount.findMany({
      orderBy: { code: "asc" },
    }),
    prisma.ledgerPosting.groupBy({
      by: ["accountId"],
      _sum: {
        amountMinor: true,
      },
    }),
    prisma.creatorEarning.findMany({
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        creator: true,
        orderItem: {
          include: {
            order: true,
          },
        },
      },
    }),
  ]);

  // Derive exact BigInt balances from LedgerPosting sums (INV-009, zero float drift)
  const postingSumByAccountId = new Map<string, bigint>();
  for (const group of postingGroups) {
    postingSumByAccountId.set(group.accountId, group._sum.amountMinor ?? 0n);
  }

  const accountsWithDerivedBalance = accounts.map((acc) => ({
    ...acc,
    derivedBalanceMinor: postingSumByAccountId.get(acc.id) ?? 0n,
  }));

  // Revenue accounts carry credit (negative) postings; negate to obtain positive net revenue
  const totalPlatformRevenueMinor = accountsWithDerivedBalance
    .filter((acc) => REVENUE_ACCOUNT_TYPES.has(acc.type))
    .reduce((sum, acc) => sum + -acc.derivedBalanceMinor, 0n);

  // Creator payable liability accounts carry credit (negative) postings when owed to creators
  const totalCreatorPendingMinor = accountsWithDerivedBalance
    .filter((acc) => acc.type === "CREATOR_PAYABLE" || acc.ownerType === "CREATOR")
    .reduce((sum, acc) => sum + -acc.derivedBalanceMinor, 0n);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-background mb-2">
            Finance Ledger
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Platform revenue, creator payouts, and double-entry ledger accounts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
        <MetricCard
          title="Platform Revenue (Net)"
          value={formatUsdMinor(totalPlatformRevenueMinor)}
        />
        <MetricCard
          title="Pending Creator Payouts"
          value={formatUsdMinor(totalCreatorPendingMinor)}
        />
        <MetricCard
          title="Active Ledger Accounts"
          value={accountsWithDerivedBalance.length}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        <div className="bg-surface-container-lowest border border-surface-variant rounded-lg overflow-hidden">
          <div className="p-6 border-b border-surface-variant">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Ledger Accounts
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-surface-variant">
                <tr>
                  <th className="px-6 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant">
                    Account
                  </th>
                  <th className="px-6 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant">
                    Type
                  </th>
                  <th className="px-6 py-4 font-label-caps text-label-caps uppercase text-on-surface-variant text-right">
                    Posted Balance
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant">
                {accountsWithDerivedBalance.map((acc) => (
                  <tr
                    key={acc.id}
                    className="hover:bg-surface-container-low transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-body-md text-body-md text-on-background">
                          {acc.name}
                        </span>
                        <span className="font-label-caps text-label-caps text-on-surface-variant">
                          {acc.code}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                        {acc.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-body-md text-body-md text-on-background">
                      {formatSignedLedgerBalance(acc.derivedBalanceMinor)}
                    </td>
                  </tr>
                ))}
                {accountsWithDerivedBalance.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-6 py-8 text-center font-body-md text-body-md text-on-surface-variant"
                    >
                      No ledger accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-surface-variant rounded-lg overflow-hidden">
          <div className="p-6 border-b border-surface-variant">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Recent Creator Earnings
            </h2>
          </div>
          <div className="p-6 space-y-4">
            {recentEarnings.map((earning) => (
              <div
                key={earning.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 bg-background border border-surface-variant rounded-lg"
              >
                <div>
                  <p className="font-body-md text-body-md text-on-background">
                    {earning.creator.displayName}
                  </p>
                  <p className="font-label-caps text-label-caps text-on-surface-variant mt-1">
                    Order {earning.orderItem.order.orderNumber} ·{" "}
                    {format(new Date(earning.createdAt), "MMM d")}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="font-body-md text-body-md text-on-background">
                    {earning.status === "REVERSED"
                      ? `-${formatUsdMinor(earning.netCreatorMinor)}`
                      : `+${formatUsdMinor(earning.netCreatorMinor)}`}
                  </p>
                  <span
                    className={`inline-flex px-2 py-1 mt-1 font-label-caps text-label-caps uppercase rounded ${
                      earning.status === "TRANSFERRED"
                        ? "bg-primary text-on-primary"
                        : earning.status === "HELD" || earning.status === "REVERSED"
                          ? "bg-error-container text-on-error-container"
                          : "bg-surface-container-high text-on-surface"
                    }`}
                  >
                    {earning.status}
                  </span>
                </div>
              </div>
            ))}
            {recentEarnings.length === 0 && (
              <p className="font-body-md text-body-md text-center text-on-surface-variant py-4">
                No recent earnings found.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
