import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import prisma from '@/lib/prisma';
import { generatePrintMaster } from '@/lib/print-generator';

const JWT_SECRET = new TextEncoder().encode(process.env.STRIPE_WEBHOOK_SECRET || process.env.JWT_SECRET || 'fallback_secret_for_dev');

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse('Missing download token', { status: 400 });
  }

  try {
    // 1. Verify the 20-day JWT token
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    if (!payload.sessionId || !payload.orderNumber) {
      return new NextResponse('Invalid token payload', { status: 400 });
    }

    // 2. Fetch the composition from the PersonalizationSession
    const session = await prisma.personalizationSession.findUnique({
      where: { id: payload.sessionId as string },
      select: { compositionJson: true }
    });

    if (!session || !session.compositionJson) {
      return new NextResponse('Composition not found or expired', { status: 404 });
    }

    // 3. Generate the 300 DPI High-Res Print Master
    // (This uses the exact same pipeline we built, ensuring 100% fidelity)
    const pngBuffer = await generatePrintMaster(session.compositionJson as any);

    // 4. Send as downloadable attachment
    return new NextResponse(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="ThiBut_Master_${payload.orderNumber}.png"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });

  } catch (error: any) {
    console.error('[Download API] Error:', error.message);
    
    if (error.code === 'ERR_JWT_EXPIRED') {
      return new NextResponse('This download link has expired.', { status: 410 });
    }
    
    return new NextResponse('Invalid or expired download token', { status: 401 });
  }
}
