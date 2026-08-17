import prisma from "@/lib/prisma";
import { format } from "date-fns";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      buyer: true,
      items: {
        include: {
          snapshot: true
        }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display-md text-display-sm text-[#111111] mb-2">Orders</h1>
          <p className="font-body text-[#A09D96]">Track customer orders, payments, and fulfillment status.</p>
        </div>
      </div>

      <div className="bg-[#FCFAF6] border border-[#E5E0D8] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#F4EFE6] border-b border-[#E5E0D8]">
            <tr>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Order</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Buyer</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Total</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Payment</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Fulfillment</th>
              <th className="px-6 py-4 font-label-caps text-xs text-[#A09D96] uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E0D8]">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-[#F4EFE6]/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-[#111111]">{order.orderNumber}</span>
                    <span className="text-xs text-[#A09D96]">{order.items.length} items</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-[#4A4844]">
                  {order.buyer.name || order.buyer.email}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-[#111111]">
                  ${(Number(order.totalMinor) / 100).toFixed(2)}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-[10px] rounded-full font-medium ${
                    order.paymentStatus === 'SUCCEEDED' ? 'bg-green-100 text-green-800' : 
                    order.paymentStatus === 'FAILED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.paymentStatus}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-[10px] rounded-full font-medium ${
                    order.fulfillmentStatus === 'DELIVERED' || order.fulfillmentStatus === 'SHIPPED' ? 'bg-green-100 text-green-800' : 
                    order.fulfillmentStatus === 'FAILED' ? 'bg-red-100 text-red-800' :
                    order.fulfillmentStatus === 'IN_PRODUCTION' || order.fulfillmentStatus === 'PROCESSING' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {order.fulfillmentStatus}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-[#A09D96]">
                  {format(new Date(order.createdAt), "MMM d, yyyy")}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-[#A09D96]">No orders found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
