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
      include: { players: true },
    });
    
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    
    if (game.hostUserId !== auth.userId) {
      return NextResponse.json(
        { error: 'Only the host can start the game' },
        { status: 403 }
      );
    }
    
    if (game.phase !== 'lobby') {
      return NextResponse.json(
        { error: 'Game has already started or ended' },
        { status: 400 }
      );
    }
    
    if (game.players.length < 1) {
      return NextResponse.json(
        { error: 'Need at least 1 player to start' },
        { status: 400 }
      );
    }
    
    // The actual game start is handled by Socket.IO
    // This endpoint is just for validation
    return NextResponse.json({
      success: true,
      message: 'Game can be started',
      canStart: true,
    });
    
  } catch (error) {
    console.error('Start game error:', error);
    return NextResponse.json(
      { error: 'Failed to start game' },
      { status: 500 }
    );
  }
}


