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
    
    const scores = await prisma.score.findMany({
      include: {
        game: {
          select: {
            id: true,
            startedAt: true,
            endedAt: true,
          },
        },
        winner: {
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
    
    // Parse JSON fields and format response
    const formattedScores = scores.map((score) => {
      let winners: string[] = [];
      let points: Record<string, number> = {};
      
      try {
        if (score.winnersJson) {
          winners = JSON.parse(score.winnersJson);
        } else if (score.winnerUserId) {
          winners = [score.winnerUserId];
        }
        
        if (score.pointsJson) {
          points = JSON.parse(score.pointsJson);
        }
      } catch {
        // Ignore parse errors
      }
      
      return {
        id: score.id,
        gameId: score.gameId,
        winner: score.winner,
        winners,
        points,
        createdAt: score.createdAt,
        game: score.game,
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


