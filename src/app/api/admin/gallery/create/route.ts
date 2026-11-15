import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    // 1. Verify Admin Status
    let isAuthorized = false;
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

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Parse Body
    const body = await req.json();
    const {
      svgBase64,
      product,
      color,
      mockupUrl,
      placement,
      category,
      text,
      tradition,
      interpretation,
      basePriceMinor,
      isApparel,
      mockupTransform
    } = body;

    if (!svgBase64 || !product || !text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Generate SEO Metadata & Pricing
    const slug = `admin-generated-${Date.now()}`;
    const galleryPriceCents = Math.round(basePriceMinor);

    const title = `"${text}" in ${tradition.replace(/_/g, " ")}`;
    const subtitle = `${interpretation.type || 'Custom'} Edition`;
    const description = `"${text}" rendered in stunning calligraphy. Meaning: ${interpretation.meaning || 'N/A'}`;

    // 4. Save to Database
    const galleryItem = await prisma.galleryItem.create({
      data: {
        slug,
        title,
        subtitle,
        description,
        sourceText: text,
        sourceLanguage: 'English',
        tradition,
        artworkId: 'admin-studio-vector',
        artworkPreviewUrl: svgBase64,
        productionArtworkUrl: svgBase64, // Fallback, would ideally generate PNG
        productType: product,
        productCategory: isApparel ? 'apparel' : 'accessory',
        productName: product,
        productImageUrl: mockupUrl || "/mockups/model-male.jpg",
        defaultColor: color,
        listedPriceCents: galleryPriceCents,
        currency: 'USD',
        requiresSize: isApparel,
        category,
        published: true,
        mockupTransform
      }
    });

    return NextResponse.json({ success: true, item: galleryItem });

  } catch (error: any) {
    console.error('Failed to create gallery item:', error);
    const errorMessage = error.message.split('Unknown arg').length > 1 
      ? 'Unknown arg' + error.message.split('Unknown arg')[1] 
      : error.message.substring(error.message.lastIndexOf('Argument'));
    return NextResponse.json({ error: errorMessage || error.message }, { status: 500 });
  }
}
