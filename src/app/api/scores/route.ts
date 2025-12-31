import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthFromCookie } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await getAuthFromCookie();
    
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Utiliser GameHistory à la place de Score
    const histories = await prisma.gameHistory.findMany({
      where: {
        oderId: auth.userId,
      },
      include: {
        game: {
          select: {
            id: true,
            startedAt: true,
            endedAt: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            firstname: true,
            lastname: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });
    
    // Formater la réponse
    const formattedScores = histories.map((history) => {
      let playerCards: any[] = [];
      let dealerCards: any[] = [];
      
      try {
        if (history.playerCards) {
          playerCards = JSON.parse(history.playerCards);
        }
        if (history.dealerCards) {
          dealerCards = JSON.parse(history.dealerCards);
        }
      } catch {
        // Ignore parse errors
      }
      
      return {
        id: history.id,
        gameId: history.gameId,
        round: history.round,
        bet: history.bet,
        result: history.result,
        payout: history.payout,
        playerValue: history.playerValue,
        dealerValue: history.dealerValue,
        playerCards,
        dealerCards,
        user: history.user,
        createdAt: history.createdAt,
        game: history.game,
      };
    });
    
    return NextResponse.json({
      success: true,
      scores: formattedScores,
    });
    
  } catch (error) {
    console.error('Get scores error:', error);
    return NextResponse.json(
      { error: 'Failed to get scores' },
      { status: 500 }
    );
  }
}


