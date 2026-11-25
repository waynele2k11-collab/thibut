import { adminPath } from "@/lib/admin-path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import prisma from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/utils/admin/auth";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Each page checks access itself; the layout is not a security boundary.
  await requireAdmin();

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      roles: { include: { role: true } },
      creator: true,
      orders: { take: 5, orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <Link
        href={adminPath("/users")}
        className="inline-flex items-center font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-primary transition-colors motion-reduce:transition-none"
      >
        <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" /> Back to Users
      </Link>

      <div>
        <h1 className="font-headline-md text-headline-md text-primary mb-1">
          {user.name || "Unknown User"}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {user.email}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-6">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              Profile Details
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  ID
                </span>
                <span className="col-span-2 text-sm text-on-surface font-mono">
                  {user.id}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Joined
                </span>
                <span className="col-span-2 font-body-md text-sm text-on-surface">
                  {format(new Date(user.createdAt), "PPP")}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Creator Profile
                </span>
                <span className="col-span-2 font-body-md text-sm text-on-surface">
                  {user.creator ? (
                    <Link
                      href={adminPath(`/sellers/${user.creator.id}`)}
                      className="text-secondary hover:underline"
                    >
                      {user.creator.displayName}
                    </Link>
                  ) : (
                    "None"
                  )}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              Recent Orders
            </h2>
            {user.orders.length > 0 ? (
              <div className="space-y-4">
                {user.orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-2 border-b border-surface-variant last:border-0"
                  >
                    <div>
                      <p className="font-body-md text-sm font-medium text-on-surface">
                        {order.orderNumber}
                      </p>
                      <p className="font-body-md text-xs text-on-surface-variant">
                        {format(new Date(order.createdAt), "PPP")}
                      </p>
                    </div>
                    <Badge variant="outline">{order.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-body-md text-sm text-on-surface-variant italic">
                No orders found.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="p-6">
            <h2 className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-6">
              Access &amp; Roles
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-body-md text-sm font-medium text-on-surface-variant">
                  Status
                </span>
                <Badge
                  variant={user.status === "ACTIVE" ? "default" : "outline"}
                >
                  {user.status}
                </Badge>
              </div>
              <div className="pt-4 border-t border-surface-variant">
                <span className="font-body-md text-sm font-medium text-on-surface-variant block mb-2">
                  Current Roles
                </span>
                <div className="flex flex-wrap gap-2">
                  {user.roles.length > 0 ? (
                    user.roles.map((r) => (
                      <Badge key={r.roleId} variant="secondary">
                        {r.role.code}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">USER</Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
