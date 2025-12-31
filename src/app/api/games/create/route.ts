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
    
    const body = await request.json().catch(() => ({}));
    const {
      name = 'Table de Blackjack',
      visibility = 'public',
      maxPlayers = 5,
      minBet = 10,
      maxBet = 500,
    } = body;
    
    // Validate
    if (maxPlayers < 1 || maxPlayers > 5) {
      return NextResponse.json(
        { error: 'Max players must be between 1 and 5' },
        { status: 400 }
      );
    }
    
    if (minBet < 1 || maxBet < minBet || maxBet > 10000) {
      return NextResponse.json(
        { error: 'Invalid bet limits' },
        { status: 400 }
      );
    }
    
    // Check if user is already in an active table
    const activePlayer = await prisma.gamePlayer.findFirst({
      where: {
        oderId: auth.userId,
        game: {
          isOpen: true,
        },
      },
      include: { game: true },
    });
    
    if (activePlayer) {
      // If the table is empty (only this player), allow creating a new one
      const playerCount = await prisma.gamePlayer.count({
        where: { gameId: activePlayer.gameId },
      });
      
      if (playerCount > 1) {
        return NextResponse.json(
          { error: 'Vous êtes déjà sur une table', tableId: activePlayer.gameId },
          { status: 400 }
        );
      } else {
        // Close the empty table
        await prisma.game.update({
          where: { id: activePlayer.gameId },
          data: { isOpen: false, endedAt: new Date() },
        });
      }
    }
    
    // Create table
    const table = await prisma.game.create({
      data: {
        name,
        visibility,
        hostUserId: auth.userId,
        maxPlayers,
        minBet,
        maxBet,
        phase: 'lobby',
        isOpen: true,
      },
    });
    
    // Add host as first player
    await prisma.gamePlayer.create({
      data: {
        gameId: table.id,
        oderId: auth.userId,
        seatIndex: 1,
      },
    });
    
    return NextResponse.json({
      success: true,
      tableId: table.id,
      message: 'Table créée !',
    });
    
  } catch (error) {
    console.error('Create table error:', error);
    return NextResponse.json(
      { error: 'Failed to create table' },
      { status: 500 }
    );
  }
}
