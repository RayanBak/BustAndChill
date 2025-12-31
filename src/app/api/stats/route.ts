import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthFromCookie } from '@/lib/auth';

// GET - Get user stats and history
export async function GET() {
  try {
    const auth = await getAuthFromCookie();
    if (!auth) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Get user stats
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        gamesPlayed: true,
        gamesWon: true,
        totalWinnings: true,
        totalLosses: true,
        blackjackCount: true,
        bestStreak: true,
        currentStreak: true,
        balance: true,
      },
    });

    // Get recent game history
    const history = await prisma.gameHistory.findMany({
      where: { oderId: auth.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        game: {
          select: { name: true },
        },
      },
    });

    // Calculate additional stats
    const winRate = user && user.gamesPlayed > 0 
      ? Math.round((user.gamesWon / user.gamesPlayed) * 100) 
      : 0;

    const netProfit = user 
      ? user.totalWinnings - user.totalLosses 
      : 0;

    return NextResponse.json({
      success: true,
      stats: {
        ...user,
        winRate,
        netProfit,
      },
      history: history.map((h) => ({
        id: h.id,
        gameName: h.game.name,
        round: h.round,
        bet: h.bet,
        result: h.result,
        payout: h.payout,
        playerValue: h.playerValue,
        dealerValue: h.dealerValue,
        createdAt: h.createdAt,
      })),
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

