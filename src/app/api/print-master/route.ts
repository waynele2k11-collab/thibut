import { NextResponse } from 'next/server';
import { generatePrintMaster } from '@/lib/print-generator';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // 1. Check for Fulfillment Secret or Authenticated Admin Session (INV-001)
    const authHeader = request.headers.get('authorization');
    const expectedSecret = process.env.FULFILLMENT_SECRET_KEY || process.env.PRINTFUL_API_KEY;

    let isAuthorized = false;

    if (authHeader && expectedSecret && authHeader === `Bearer ${expectedSecret}`) {
      isAuthorized = true;
    } else {
      // Check for authenticated Admin cookie session
      const cookieStore = await cookies();
      if (cookieStore.get('admin_master_pwd_verified')?.value === 'true') {
        isAuthorized = true;
      } else {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email === 'waynele2k11@gmail.com') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden: High-resolution print assets require verified order or admin authentication (INV-001).' },
        { status: 403 }
      );
    }

    const { text, stylePack } = await request.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Missing text parameter for print generation' }, { status: 400 });
    }

    console.log(`[API Secure] Generating Print Master for text: "${text}" with style: "${stylePack}"`);

    // Generate high-res 300 DPI print master PNG buffer
    const pngBuffer = await generatePrintMaster(text, stylePack || 'Thi Bút Classic');

    return new NextResponse(pngBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="thi_but_print_master.png"',
        'Cache-Control': 'no-store, max-age=0',
      },
    });

  } catch (error) {
    console.error('[API Secure] Error generating print master:', error);
    return NextResponse.json({ error: 'Failed to generate print master' }, { status: 500 });
  }
}
