import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  DollarSign,
  Paintbrush,
  PieChart,
  Upload,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { formatMinor } from "@/lib/money";
import { createClient } from "@/utils/supabase/server";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Creator Studio Dashboard",
  description:
    "Manage your marketplace calligraphy listings, track royalties, and review personalization permissions.",
  robots: { index: false, follow: false },
};

function statusToBadgeVariant(status: string): BadgeVariant {
  if (status === "PUBLISHED") return "default";
  if (status === "REJECTED" || status === "TAKEDOWN") return "error";
  if (status === "REVIEW") return "seal";
  return "outline";
}

export default async function CreatorStudioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const creatorProfile = user
    ? await prisma.creatorProfile.findUnique({
        where: { userId: user.id },
        include: {
          subscription: {
            include: { plan: true },
          },
          designs: {
            orderBy: { updatedAt: "desc" },
            include: {
              category: true,
              versions: {
                orderBy: { versionNumber: "desc" },
                take: 1,
                include: {
                  assets: {
                    include: { asset: true },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  const earnings = creatorProfile
    ? await prisma.creatorEarning.findMany({
        where: {
          creatorId: creatorProfile.id,
          status: { not: "REVERSED" },
        },
        include: {
          orderItem: {
            select: { designId: true },
          },
        },
      })
    : [];

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  let lifetimeRoyaltiesMinor = 0n;
  let monthRoyaltiesMinor = 0n;
  const designStatsMap = new Map<string, { orders: number; royaltiesMinor: bigint }>();

  for (const earning of earnings) {
    lifetimeRoyaltiesMinor += earning.netCreatorMinor;
    if (earning.createdAt >= monthStart) {
      monthRoyaltiesMinor += earning.netCreatorMinor;
    }
    const dId = earning.orderItem.designId;
    const prev = designStatsMap.get(dId) ?? { orders: 0, royaltiesMinor: 0n };
    designStatsMap.set(dId, {
      orders: prev.orders + 1,
      royaltiesMinor: prev.royaltiesMinor + earning.netCreatorMinor,
    });
  }

  const designs = creatorProfile?.designs ?? [];
  const publishedCount = designs.filter((d) => d.status === "PUBLISHED").length;
  const quotaLimit = creatorProfile?.subscription?.plan.activeDesignLimit ?? 25;
  const remainingSlots = Math.max(0, quotaLimit - publishedCount);

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col font-body-md text-body-md antialiased relative">
      <main className="grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-12 flex flex-col gap-12 relative z-10">
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
          <div className="flex flex-col gap-4 max-w-2xl">
            <h1 className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-on-background">
              Studio Dashboard
            </h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              Manage your marketplace listings, track verified royalties, and publish new works of art.
            </p>
          </div>
          <Link
            href="/create"
            className="bg-primary text-on-primary px-6 py-3 rounded flex items-center gap-2 hover:bg-secondary hover:text-on-secondary transition-colors duration-300 motion-reduce:transition-none font-label-caps text-label-caps uppercase"
          >
            <Upload className="w-5 h-5" aria-hidden="true" />
            Create New Artwork
          </Link>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          <Card className="p-8 flex flex-col gap-6 col-span-1">
            <div className="flex justify-between items-start">
              <h2 className="font-headline-sm text-headline-sm text-on-background">
                Listing Quota
              </h2>
              <PieChart className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-2 grow justify-center">
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-on-background">
                  {publishedCount}
                </span>
                <span className="font-body-md text-body-md text-on-surface-variant">
                  / {quotaLimit} Published
                </span>
              </div>
              <progress
                value={Math.min(publishedCount, quotaLimit)}
                max={quotaLimit}
                aria-label="Published design quota usage"
                className="w-full h-1.5 mt-4 rounded-full overflow-hidden [&::-webkit-progress-bar]:bg-surface-variant [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary"
              />
              <p className="font-label-caps text-label-caps text-on-surface-variant mt-2 uppercase">
                {remainingSlots} {remainingSlots === 1 ? "Slot" : "Slots"} Remaining
              </p>
            </div>
          </Card>

          <Card className="p-8 flex flex-col gap-6 col-span-1 md:col-span-2 relative overflow-hidden group">
            <div className="absolute inset-0 z-0">
              <Image
                className="object-cover opacity-15 grayscale transition-transform duration-1000 group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
                src="/mockups/framed_print.jpg"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 66vw"
              />
            </div>
            <div className="relative z-10 flex justify-between items-start">
              <h2 className="font-headline-sm text-headline-sm text-on-background">
                Lifetime Royalties
              </h2>
              <DollarSign className="w-5 h-5 text-on-surface-variant" aria-hidden="true" />
            </div>
            <div className="relative z-10 flex flex-col gap-2 grow justify-center">
              <span className="font-display-lg-mobile text-display-lg-mobile md:font-display-lg md:text-display-lg text-on-background">
                {formatMinor(lifetimeRoyaltiesMinor, "USD")}
              </span>
              <p className="font-body-md text-body-md text-on-surface-variant">
                +{formatMinor(monthRoyaltiesMinor, "USD")} this month
              </p>
            </div>
          </Card>
        </section>

        <section className="flex flex-col gap-8">
          <div className="flex justify-between items-center border-b border-surface-variant pb-4">
            <h2 className="font-headline-md text-headline-md text-on-background">
              Your Designs
            </h2>
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              {designs.length} {designs.length === 1 ? "Listing" : "Listings"}
            </span>
          </div>

          {designs.length === 0 ? (
            <Card className="p-12 flex flex-col items-center justify-center text-center gap-4 bg-surface-container-low">
              <div className="w-14 h-14 rounded-lg bg-surface-container-lowest border border-surface-variant flex items-center justify-center">
                <Paintbrush className="w-6 h-6 text-secondary" aria-hidden="true" />
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-background">
                No designs published yet
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant max-w-md">
                Start in the Personalization Studio to compose your first brush calligraphy work and publish it to your creator catalog.
              </p>
              <Link
                href="/create"
                className="mt-2 inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded font-label-caps text-label-caps uppercase hover:bg-secondary hover:text-on-secondary transition-colors motion-reduce:transition-none"
              >
                Open Calligraphy Studio
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </Card>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[680px]">
                <caption className="sr-only">
                  Creator designs, statuses, order counts, and net royalties
                </caption>
                <thead>
                  <tr className="border-b border-surface-variant">
                    <th
                      scope="col"
                      className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase"
                    >
                      Artwork
                    </th>
                    <th
                      scope="col"
                      className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase"
                    >
                      Visibility
                    </th>
                    <th
                      scope="col"
                      className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right"
                    >
                      Orders
                    </th>
                    <th
                      scope="col"
                      className="py-4 px-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right"
                    >
                      Royalties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {designs.map((design) => {
                    const latestVersion = design.versions[0];
                    const previewAsset = latestVersion?.assets.find(
                      (da) => da.type === "PREVIEW" || da.type === "THUMBNAIL"
                    )?.asset;
                    const stats = designStatsMap.get(design.id);

                    return (
                      <tr
                        key={design.id}
                        className="border-b border-surface-variant hover:bg-surface-container-low transition-colors motion-reduce:transition-none"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-4">
                            <div className="relative w-14 h-14 rounded bg-surface-container border border-surface-variant overflow-hidden shrink-0 flex items-center justify-center">
                              {previewAsset?.objectKey ? (
                                <Image
                                  className="object-cover"
                                  src={previewAsset.objectKey}
                                  alt={design.title}
                                  fill
                                  sizes="56px"
                                  unoptimized={previewAsset.objectKey.startsWith("data:")}
                                />
                              ) : (
                                <span className="font-headline-sm text-lg text-primary">
                                  書
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-body-md text-body-md font-medium text-on-background">
                                {design.title}
                              </span>
                              <span className="font-label-caps text-label-caps text-on-surface-variant mt-1">
                                {design.category?.name ?? "Calligraphy"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <Badge variant={statusToBadgeVariant(design.status)}>
                            {design.status}
                          </Badge>
                        </td>
                        <td className="py-4 px-4 text-on-surface-variant font-body-md">
                          {design.visibility}
                        </td>
                        <td className="py-4 px-4 text-right font-body-md text-on-background">
                          {stats ? stats.orders : 0}
                        </td>
                        <td className="py-4 px-4 text-right font-body-md text-on-background">
                          {formatMinor(stats?.royaltiesMinor ?? 0n, "USD")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <Card className="p-8 flex flex-col gap-6">
          <div className="border-b border-surface-variant pb-4">
            <h2 className="font-headline-md text-headline-md text-on-background">
              Default Personalization Permissions
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">
              Baseline policy applied to new designs (INV-010, INV-012). AI model training is permanently disabled by default.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                label: "Allow Name",
                description: "Buyer can add their name",
                defaultOn: true,
              },
              {
                label: "Allow Quote",
                description: "Buyer can add a quote",
                defaultOn: true,
              },
              {
                label: "Allow Translation",
                description: "Platform translates buyer text",
                defaultOn: true,
              },
              {
                label: "Allow Calligraphy Style",
                description: "Buyer can choose style pack",
                defaultOn: true,
              },
              {
                label: "Allow AI Restyle",
                description: "AI can restyle your artwork",
                defaultOn: false,
              },
              {
                label: "Allow Model Training",
                description: "Disabled by platform invariant (INV-010)",
                defaultOn: false,
              },
            ].map((perm) => (
              <div
                key={perm.label}
                className="flex items-start justify-between gap-4 p-4 border border-surface-variant bg-surface rounded"
              >
                <div>
                  <p className="font-body-md text-body-md font-medium text-on-background">
                    {perm.label}
                  </p>
                  <p className="font-label-caps text-label-caps text-on-surface-variant mt-1">
                    {perm.description}
                  </p>
                </div>
                <Badge variant={perm.defaultOn ? "default" : "outline"}>
                  {perm.defaultOn ? "Enabled" : "Off"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </main>
    </div>
  );
}
