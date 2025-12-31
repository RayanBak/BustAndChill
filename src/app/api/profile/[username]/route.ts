import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthFromCookie } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ username: string }>;
}

// GET - Get public profile by username
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthFromCookie();
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { username } = await params;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        bio: true,
        gamesPlayed: true,
        gamesWon: true,
        totalWinnings: true,
        blackjackCount: true,
        bestStreak: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Check friendship status
    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: auth.userId, receiverId: user.id },
          { senderId: user.id, receiverId: auth.userId },
        ],
      },
    });

    return NextResponse.json({
      success: true,
      user,
      friendshipStatus: friendship?.status || null,
      isMe: user.id === auth.userId,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

