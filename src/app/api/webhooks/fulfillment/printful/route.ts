import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { PrintfulProvider } from "@/lib/fulfillment/PrintfulProvider";

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    
    // In production, MUST verify HMAC signature from Printful headers here
    // e.g. const signature = req.headers.get('x-pf-signature');

    // 1. Record the raw event immediately for auditability
    const provider = new PrintfulProvider();
    const event = await provider.parseWebhook(rawBody);

    await prisma.webhookEvent.create({
      data: {
        provider: "PRINTFUL",
        externalEventId: event.externalEventId,
        eventType: event.type,
        payloadJson: rawBody,
        status: "PROCESSING"
      }
    });

    // 2. Process the event
    switch (event.type) {
      case "MOCKUP_COMPLETED":
        // Handle Mockup Generation Task completion
        // Find the pending mockups associated with this task ID or personalizationVersionId
        // Update the assetId with the newly generated URL, and mark status READY.
        console.log("Mockup completed:", event.payload);
        // e.g. await MockupService.completeTask(event.payload.task_key, event.payload.mockups);
        break;

      case "ORDER_SHIPPED":
        // Handle Shipment
        // Locate order via external_id (which is Thi But orderNumber)
        console.log("Order Shipped:", event.payload.order.external_id);
        const order = await prisma.order.findUnique({
          where: { orderNumber: event.payload.order.external_id }
        });
        
        if (order) {
          await prisma.order.update({
            where: { id: order.id },
            data: { fulfillmentStatus: "SHIPPED" }
          });
          // Also create Shipment record here containing tracking URL
        }
        break;

      case "ORDER_FAILED":
      case "ORDER_CANCELED":
        console.log("Order Failed/Canceled:", event.payload);
        const failedOrder = await prisma.order.findUnique({
          where: { orderNumber: event.payload.order.external_id }
        });
        
        if (failedOrder) {
          await prisma.order.update({
            where: { id: failedOrder.id },
            data: { 
              fulfillmentStatus: event.type === "ORDER_FAILED" ? "FAILED" : "CANCELLED" 
            }
          });
        }
        break;

      default:
        console.log(`Unhandled Printful event type: ${event.type}`);
    }

    // 3. Mark webhook as processed
    await prisma.webhookEvent.updateMany({
      where: { externalEventId: event.externalEventId },
      data: { status: "PROCESSED", processedAt: new Date() }
    });

    return NextResponse.json({ received: true });
    
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
