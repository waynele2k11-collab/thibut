import type { LedgerAccountType } from "@prisma/client";
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

  // The ledger only. Creator earnings rows are still written for every paid order (payment
  // settlement needs them) but are no longer listed here: no outside creators exist.
  const [accounts, postingGroups] = await Promise.all([
    prisma.ledgerAccount.findMany({
      orderBy: { code: "asc" },
    }),
    prisma.ledgerPosting.groupBy({
      by: ["accountId"],
      _sum: {
        amountMinor: true,
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
            Revenue and double-entry ledger accounts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
        <MetricCard
          title="Platform Revenue (Net)"
          value={formatUsdMinor(totalPlatformRevenueMinor)}
        />
        <MetricCard
          title="Creator Payable (Ledger)"
          value={formatUsdMinor(totalCreatorPendingMinor)}
        />
        <MetricCard
          title="Active Ledger Accounts"
          value={accountsWithDerivedBalance.length}
        />
      </div>

      <div className="grid grid-cols-1 gap-gutter">
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
      </div>
    </div>
  );
}
