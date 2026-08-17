import { NextResponse } from 'next/server';
import { generatePrintMaster } from '@/lib/print-generator';

export async function POST(request: Request) {
  try {
    const { text, stylePack } = await request.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Missing text parameter for print generation' }, { status: 400 });
    }

    console.log(`[API] Generating Print Master for text: "${text}" with style: "${stylePack}"`);

    // Generate high-res print master PNG buffer
    // This executes on the server, safely keeping rendering logic off the client.
    const pngBuffer = await generatePrintMaster(text, stylePack || 'Thi Bút Classic');

    // Return the transparent PNG directly for download/preview
    // In a real system, we'd save this to S3 and pass the URL to Printful
    return new NextResponse(pngBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="thi_but_print_master.png"',
        'Cache-Control': 'no-store',
      },
    });

  } catch (error) {
    console.error('[API] Error generating print master:', error);
    return NextResponse.json({ error: 'Failed to generate print master' }, { status: 500 });
  }
}
