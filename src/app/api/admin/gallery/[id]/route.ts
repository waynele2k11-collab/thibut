import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Delete from Database
    await prisma.galleryItem.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Failed to delete gallery item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { customImageUrl } = body;

    // Get current item to retain existing mockupTransform data
    const currentItem = await prisma.galleryItem.findUnique({
      where: { id }
    });

    if (!currentItem) {
      return NextResponse.json({ error: 'Gallery item not found' }, { status: 404 });
    }

    const currentTransform = (currentItem.mockupTransform as any) || {};

    // 2. Update Database
    const updated = await prisma.galleryItem.update({
      where: { id },
      data: {
        mockupTransform: {
          ...currentTransform,
          customImageUrl
        }
      }
    });

    return NextResponse.json({ success: true, item: updated });

  } catch (error: any) {
    console.error('Failed to update gallery item:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
