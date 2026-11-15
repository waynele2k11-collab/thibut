import { Resend } from 'resend';
import { SignJWT } from 'jose';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_123');
const JWT_SECRET = new TextEncoder().encode(process.env.STRIPE_WEBHOOK_SECRET || process.env.JWT_SECRET || 'fallback_secret_for_dev');

export async function sendDigitalDownloadEmail(
  email: string,
  orderNumber: string,
  sessionId: string,
  productName: string
) {
  try {
    // Generate an expiring JWT (20 days)
    const token = await new SignJWT({ orderNumber, sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('20d')
      .sign(JWT_SECRET);

    const downloadLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/download?token=${token}`;

    if (!process.env.RESEND_API_KEY) {
      console.log('====================================================');
      console.log(`[MOCK EMAIL] To: ${email}`);
      console.log(`Subject: Your Digital Download is Ready (${orderNumber})`);
      console.log(`Link: ${downloadLink} (Valid for 20 days)`);
      console.log('====================================================');
      return;
    }

    await resend.emails.send({
      from: 'Thi Bút <hello@thibut.com>',
      to: email,
      subject: 'Your Thi Bút Digital Download is Ready!',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Thank you for your purchase!</h2>
          <p>Your high-resolution Print Master for <strong>${productName}</strong> is ready to download.</p>
          <p>Please click the secure link below to download your files. This link will expire in 20 days.</p>
          <a href="${downloadLink}" style="display: inline-block; padding: 10px 20px; background-color: #111; color: #fff; text-decoration: none; border-radius: 5px;">Download Artwork</a>
          <br/><br/>
          <p>Order: ${orderNumber}</p>
          <p>Thi Bút Support</p>
        </div>
      `,
    });
    
    console.log(`[Email] Digital download link sent to ${email}`);
  } catch (error) {
    console.error("[Email] Failed to send digital download link:", error);
  }
}
