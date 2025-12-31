import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthFromCookie } from '@/lib/auth';

// GET - Get current user profile
export async function GET() {
  try {
    const auth = await getAuthFromCookie();
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        username: true,
        avatarUrl: true,
        bio: true,
        balance: true,
        gamesPlayed: true,
        gamesWon: true,
        totalWinnings: true,
        totalLosses: true,
        blackjackCount: true,
        bestStreak: true,
        currentStreak: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Profile error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT - Update profile
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthFromCookie();
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { firstname, lastname, username, bio, avatarUrl } = body;

    // Check username uniqueness if changed
    if (username) {
      const existing = await prisma.user.findFirst({
        where: {
          username,
          id: { not: auth.userId },
        },
      });
      if (existing) {
        return NextResponse.json({ error: 'Ce pseudo est déjà pris' }, { status: 400 });
      }
    }

    const user = await prisma.user.update({
      where: { id: auth.userId },
      data: {
        ...(firstname && { firstname }),
        ...(lastname && { lastname }),
        ...(username && { username }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        username: true,
        bio: true,
        avatarUrl: true,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
  }
}

