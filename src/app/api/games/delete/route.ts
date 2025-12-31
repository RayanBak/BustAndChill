import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthFromCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromCookie();
    
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { gameId } = body;
    
    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      );
    }
    
    // Find game
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });
    
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    
    // Only host can delete, and only if game is waiting
    if (game.hostUserId !== auth.userId) {
      return NextResponse.json(
        { error: 'Only the host can delete the game' },
        { status: 403 }
      );
    }
    
    if (game.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Can only delete games that have not started' },
        { status: 400 }
      );
    }
    
    // Delete the game (cascade will delete players, hands, moves, score)
    await prisma.game.delete({
      where: { id: gameId },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Game deleted successfully',
    });
    
  } catch (error) {
    console.error('Delete game error:', error);
    return NextResponse.json(
      { error: 'Failed to delete game' },
      { status: 500 }
    );
  }
}

