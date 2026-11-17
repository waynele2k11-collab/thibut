import "server-only";
import { Resend } from "resend";
import { z } from "zod";
import { signDownloadToken } from "@/lib/security/tokens";
import { escapeXml } from "@/lib/security/xml";

const DigitalDownloadEmailSchema = z.object({
  email: z.string().email(),
  orderNumber: z.string().min(1).max(128),
  orderId: z.string().min(1).max(128),
  orderItemId: z.string().min(1).max(128),
  productName: z.string().min(1).max(255),
});

export type DigitalDownloadEmailParams = z.infer<typeof DigitalDownloadEmailSchema>;

export async function sendDigitalDownloadEmail(
  params: DigitalDownloadEmailParams
): Promise<{ sent: boolean; downloadLink: string }> {
  const input = DigitalDownloadEmailSchema.parse(params);

  // Cryptographically bound 20-day token signed strictly with DOWNLOAD_TOKEN_SECRET (T-103)
  const token = await signDownloadToken({
    orderItemId: input.orderItemId,
    orderId: input.orderId,
  });

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/+$/,
    ""
  );
  const downloadLink = `${baseUrl}/api/download?token=${encodeURIComponent(token)}`;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.info(
      `[Email] RESEND_API_KEY not configured; prepared digital download link for order ${input.orderNumber}`
    );
    return { sent: false, downloadLink };
  }

  const resend = new Resend(apiKey);
  const safeProductName = escapeXml(input.productName);
  const safeOrderNumber = escapeXml(input.orderNumber);

  await resend.emails.send({
    from: "Thi Bút <hello@thibut.com>",
    to: input.email,
    subject: "Your Thi Bút Digital Download is Ready!",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>Thank you for your purchase!</h2>
        <p>Your high-resolution Print Master for <strong>${safeProductName}</strong> is ready to download.</p>
        <p>Please click the secure link below to download your files. This link will expire in 20 days.</p>
        <a href="${escapeXml(downloadLink)}" style="display: inline-block; padding: 10px 20px; background-color: #111; color: #fff; text-decoration: none; border-radius: 5px;">Download Artwork</a>
        <br/><br/>
        <p>Order: ${safeOrderNumber}</p>
        <p>Thi Bút Support</p>
      </div>
    `,
  });

  return { sent: true, downloadLink };
}
