import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthFromCookie } from '@/lib/auth';

// GET - Get friends list and pending requests
export async function GET() {
  try {
    const auth = await getAuthFromCookie();
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Get accepted friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { senderId: auth.userId, status: 'accepted' },
          { receiverId: auth.userId, status: 'accepted' },
        ],
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
        receiver: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    const friends = friendships.map((f) => {
      const friend = f.senderId === auth.userId ? f.receiver : f.sender;
      return {
        id: friend.id,
        username: friend.username,
        avatarUrl: friend.avatarUrl,
        friendshipId: f.id,
      };
    });

    // Get pending requests received
    const pendingReceived = await prisma.friendship.findMany({
      where: {
        receiverId: auth.userId,
        status: 'pending',
      },
      include: {
        sender: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    // Get pending requests sent
    const pendingSent = await prisma.friendship.findMany({
      where: {
        senderId: auth.userId,
        status: 'pending',
      },
      include: {
        receiver: { select: { id: true, username: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({
      success: true,
      friends,
      pendingReceived: pendingReceived.map((r) => ({
        id: r.id,
        user: r.sender,
        createdAt: r.createdAt,
      })),
      pendingSent: pendingSent.map((r) => ({
        id: r.id,
        user: r.receiver,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get friends error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST - Send friend request
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromCookie();
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ error: 'Pseudo requis' }, { status: 400 });
    }

    // Find user
    const targetUser = await prisma.user.findUnique({
      where: { username },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    if (targetUser.id === auth.userId) {
      return NextResponse.json({ error: 'Vous ne pouvez pas vous ajouter vous-même' }, { status: 400 });
    }

    // Check existing friendship
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: auth.userId, receiverId: targetUser.id },
          { senderId: targetUser.id, receiverId: auth.userId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'accepted') {
        return NextResponse.json({ error: 'Vous êtes déjà amis' }, { status: 400 });
      }
      if (existing.status === 'pending') {
        return NextResponse.json({ error: 'Demande déjà envoyée' }, { status: 400 });
      }
      if (existing.status === 'blocked') {
        return NextResponse.json({ error: 'Impossible d\'envoyer une demande' }, { status: 400 });
      }
    }

    // Create friend request
    await prisma.friendship.create({
      data: {
        senderId: auth.userId,
        receiverId: targetUser.id,
        status: 'pending',
      },
    });

    return NextResponse.json({ success: true, message: 'Demande envoyée !' });
  } catch (error) {
    console.error('Send friend request error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

