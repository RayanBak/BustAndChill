import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthFromCookie } from '@/lib/auth';

interface RouteParams {
  params: Promise<{ uuid: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthFromCookie();
    
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { uuid } = await params;
    
    const game = await prisma.game.findUnique({
      where: { id: uuid },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            firstname: true,
            lastname: true,
          },
        },
        players: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                firstname: true,
                lastname: true,
                balance: true,
              },
            },
          },
          orderBy: { seatIndex: 'asc' },
        },
        hands: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
        scores: {
          include: {
            winner: {
              select: {
                id: true,
                username: true,
              },
            },
          },
          orderBy: { round: 'desc' },
        },
      },
    });
    
    if (!game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    
    // Check if user is a player in this game
    const isPlayer = game.players.some((p) => p.oderId === auth.userId);
    const isHost = game.hostUserId === auth.userId;
    
    return NextResponse.json({
      success: true,
      game: {
        id: game.id,
        status: game.status,
        host: game.host,
        maxPlayers: game.maxPlayers,
        minBet: game.minBet,
        maxBet: game.maxBet,
        currentRound: game.currentRound,
        currentTurnIndex: game.currentTurnIndex,
        createdAt: game.createdAt,
        startedAt: game.startedAt,
        endedAt: game.endedAt,
        players: game.players.map((p) => ({
          oderId: p.oderId,
          username: p.user.username,
          firstname: p.user.firstname,
          lastname: p.user.lastname,
          seatIndex: p.seatIndex,
          turnOrder: p.turnOrder,
          isReady: p.isReady,
          hasFinishedTurn: p.hasFinishedTurn,
          balance: p.user.balance,
          currentBet: p.currentBet,
        })),
        hands: game.status === 'finished' ? game.hands : game.hands.filter((h) => h.oderId === auth.userId),
        scores: game.scores,
        isPlayer,
        isHost,
      },
    });
    
  } catch (error) {
    console.error('Get game error:', error);
    return NextResponse.json(
      { error: 'Failed to get game' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await getAuthFromCookie();
    
    if (!auth) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { uuid } = await params;
    
    const game = await prisma.game.findUnique({
      where: { id: uuid },
      include: {
        players: true,
      },
    });
    
    if (!game) {
      return NextResponse.json(
        { error: 'Table non trouvée' },
        { status: 404 }
      );
    }
    
    // Only host can delete, or anyone if table is empty
    const isHost = game.hostUserId === auth.userId;
    const playerCount = game.players.length;
    
    if (!isHost && playerCount > 0) {
      return NextResponse.json(
        { error: 'Seul l\'hôte peut supprimer la table' },
        { status: 403 }
      );
    }
    
    // Can't delete if game is in progress
    if (game.phase !== 'lobby' && game.isOpen) {
      return NextResponse.json(
        { error: 'Impossible de supprimer une table en cours de jeu' },
        { status: 400 }
      );
    }
    
    // Delete the game (cascade will delete players)
    await prisma.game.delete({
      where: { id: uuid },
    });
    
    return NextResponse.json({
      success: true,
      message: 'Table supprimée',
    });
    
  } catch (error) {
    console.error('Delete game error:', error);
    return NextResponse.json(
      { error: 'Failed to delete game' },
      { status: 500 }
    );
  }
}


