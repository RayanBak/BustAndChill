import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthFromCookie } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT - Accept/Reject friend request
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthFromCookie();
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body; // 'accept' or 'reject'

    const friendship = await prisma.friendship.findUnique({
      where: { id },
    });

    if (!friendship) {
      return NextResponse.json({ error: 'Demande non trouvée' }, { status: 404 });
    }

    if (friendship.receiverId !== auth.userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    if (action === 'accept') {
      await prisma.friendship.update({
        where: { id },
        data: { status: 'accepted' },
      });
      return NextResponse.json({ success: true, message: 'Ami ajouté !' });
    } else if (action === 'reject') {
      await prisma.friendship.delete({
        where: { id },
      });
      return NextResponse.json({ success: true, message: 'Demande refusée' });
    }

    return NextResponse.json({ error: 'Action invalide' }, { status: 400 });
  } catch (error) {
    console.error('Friend action error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE - Remove friend
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthFromCookie();
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { id } = await params;

    const friendship = await prisma.friendship.findUnique({
      where: { id },
    });

    if (!friendship) {
      return NextResponse.json({ error: 'Amitié non trouvée' }, { status: 404 });
    }

    if (friendship.senderId !== auth.userId && friendship.receiverId !== auth.userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    await prisma.friendship.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Ami supprimé' });
  } catch (error) {
    console.error('Remove friend error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

