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
      include: {
        players: true,
      },
    });
    
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    
    if (game.phase !== 'lobby') {
      return NextResponse.json(
        { error: 'Game is not accepting new players' },
        { status: 400 }
      );
    }
    
    // Check if user is already in this game
    const existingPlayer = game.players.find((p) => p.oderId === auth.userId);
    if (existingPlayer) {
      return NextResponse.json({
        success: true,
        gameId: game.id,
        message: 'You are already in this game',
        alreadyJoined: true,
      });
    }
    
    // Check max players
    if (game.players.length >= game.maxPlayers) {
      return NextResponse.json(
        { error: 'Game is full' },
        { status: 400 }
      );
    }
    
    // Check if user is in another active game
    const activeGame = await prisma.gamePlayer.findFirst({
      where: {
        oderId: auth.userId,
        game: {
          phase: { in: ['lobby', 'betting', 'dealing', 'player_turn', 'dealer_turn'] },
          isOpen: true,
          id: { not: gameId },
        },
      },
    });
    
    if (activeGame) {
      return NextResponse.json(
        { error: 'You are already in another active game' },
        { status: 400 }
      );
    }
    
    // Find next available seat
    const usedSeats = game.players.map((p) => p.seatIndex);
    let nextSeat = 1;
    while (usedSeats.includes(nextSeat) && nextSeat <= 5) {
      nextSeat++;
    }
    
    // Join game
    await prisma.gamePlayer.create({
      data: {
        gameId: game.id,
        oderId: auth.userId,
        seatIndex: nextSeat,
      },
    });
    
    return NextResponse.json({
      success: true,
      gameId: game.id,
      message: 'Joined game successfully!',
    });
    
  } catch (error) {
    console.error('Join game error:', error);
    return NextResponse.json(
      { error: 'Failed to join game' },
      { status: 500 }
    );
  }
}


