import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthFromCookie } from '@/lib/auth';

// GET - Get leaderboard
export async function GET() {
  try {
    const auth = await getAuthFromCookie();
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Top by winnings
    const topWinners = await prisma.user.findMany({
      where: { gamesPlayed: { gt: 0 } },
      orderBy: { totalWinnings: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        totalWinnings: true,
        gamesPlayed: true,
        gamesWon: true,
      },
    });

    // Top by win rate (min 10 games)
    const topWinRate = await prisma.user.findMany({
      where: { gamesPlayed: { gte: 10 } },
      orderBy: { gamesWon: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        gamesPlayed: true,
        gamesWon: true,
      },
    });

    // Top by blackjacks
    const topBlackjacks = await prisma.user.findMany({
      where: { blackjackCount: { gt: 0 } },
      orderBy: { blackjackCount: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        avatarUrl: true,
        blackjackCount: true,
      },
    });

    // My rank
    const myStats = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { totalWinnings: true },
    });

    const myRank = myStats
      ? await prisma.user.count({
          where: { totalWinnings: { gt: myStats.totalWinnings } },
        }) + 1
      : null;

    return NextResponse.json({
      success: true,
      topWinners: topWinners.map((u, i) => ({ ...u, rank: i + 1 })),
      topWinRate: topWinRate.map((u, i) => ({
        ...u,
        rank: i + 1,
        winRate: Math.round((u.gamesWon / u.gamesPlayed) * 100),
      })),
      topBlackjacks: topBlackjacks.map((u, i) => ({ ...u, rank: i + 1 })),
      myRank,
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

