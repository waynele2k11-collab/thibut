import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default async function AdminSellerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const seller = await prisma.creatorProfile.findUnique({
    where: { id },
    include: {
      user: true,
      subscription: {
        include: { plan: true },
      },
      designs: { take: 5, orderBy: { createdAt: "desc" } },
      _count: {
        select: { designs: true, earnings: true, transfers: true },
      },
    },
  });

  if (!seller) {
    notFound();
  }

  const earningsAgg = await prisma.creatorEarning.aggregate({
    where: { creatorId: seller.id, status: { not: "REVERSED" } },
    _sum: { netCreatorMinor: true },
  });
  const totalNetMinor = earningsAgg._sum.netCreatorMinor ?? 0n;

  return (
    <div className="space-y-8">
      <Link
        href="/admin/sellers"
        className="inline-flex items-center font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none"
      >
        <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" /> Back to Sellers
      </Link>

      <div>
        <h1 className="font-headline-md text-headline-md text-primary mb-1">
          {seller.displayName}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          @{seller.slug}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-6">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              Profile
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  User Account
                </span>
                <span className="col-span-2 font-body-md text-sm text-secondary hover:underline">
                  <Link href={`/admin/users/${seller.userId}`}>
                    {seller.user.email}
                  </Link>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Bio
                </span>
                <span className="col-span-2 font-body-md text-sm text-on-surface">
                  {seller.bio || "None provided"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Joined
                </span>
                <span className="col-span-2 font-body-md text-sm text-on-surface">
                  {format(new Date(seller.createdAt), "PPP")}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              Stripe Connect &amp; Ledger Summary
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Connected Account ID
                </span>
                <span className="col-span-2 text-sm text-on-surface font-mono">
                  {seller.stripeAccountId || "Not connected"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Payout Readiness
                </span>
                <span className="col-span-2 font-body-md text-sm text-on-surface">
                  {seller.stripeAccountId && seller.status === "ACTIVE"
                    ? "Connected & Eligible"
                    : "Awaiting Onboarding"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Net Lifetime Earnings
                </span>
                <span className="col-span-2 font-body-md text-sm text-on-surface font-medium">
                  {formatMinor(totalNetMinor, "USD")} ({seller._count.earnings}{" "}
                  entries · {seller._count.transfers} transfers)
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Subscription Plan
                </span>
                <span className="col-span-2 font-body-md text-sm text-on-surface">
                  {seller.subscription?.plan.name ?? "Free Tier"}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              Recent Designs ({seller._count.designs} Total)
            </h2>
            {seller.designs.length > 0 ? (
              <div className="space-y-4">
                {seller.designs.map((design) => (
                  <div
                    key={design.id}
                    className="flex items-center justify-between py-2 border-b border-surface-variant last:border-0"
                  >
                    <div>
                      <Link
                        href={`/admin/art/${design.id}`}
                        className="font-body-md text-sm font-medium text-secondary hover:underline"
                      >
                        {design.title}
                      </Link>
                      <p className="font-body-md text-xs text-on-surface-variant">
                        {format(new Date(design.createdAt), "PPP")}
                      </p>
                    </div>
                    <Badge variant="outline">{design.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body-md text-sm text-on-surface-variant italic">
                No designs found.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="p-6">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              Seller Status
            </h2>
            <div className="flex items-center justify-between">
              <span className="font-body-md text-sm font-medium text-on-surface-variant">
                Current Status
              </span>
              <Badge
                variant={seller.status === "ACTIVE" ? "default" : "outline"}
              >
                {seller.status}
              </Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
