import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '@/lib/db';
import { verifyToken, type JWTPayload } from '@/lib/auth';
import {
  initializeGameState,
  applyHit,
  applyStand,
  forceStand,
  serializeDeck,
  serializeCards,
  type GameState,
  type PlayerHand,
} from './gameEngine';

interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
}

interface ConnectedUser {
  oderId: string;
  username: string;
  socketId: string;
}

// Store active game states in memory for real-time updates
const activeGames = new Map<string, GameState>();
const connectedUsers = new Map<string, ConnectedUser>();
const gameTimers = new Map<string, NodeJS.Timeout>();
const turnTimers = new Map<string, NodeJS.Timeout>();

// Timeouts in milliseconds
const LOBBY_TIMEOUT = 120000; // 2 minutes
const TURN_TIMEOUT = 30000; // 30 seconds

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return io;
}

export function initializeSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) return io;
  
  io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });
  
  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }
    
    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error('Invalid token'));
    }
    
    socket.user = payload;
    next();
  });
  
  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user!;
    console.log(`User connected: ${user.username} (${socket.id})`);
    
    // Add to connected users
    connectedUsers.set(user.userId, {
      oderId: user.userId,
      username: user.username,
      socketId: socket.id,
    });
    
    // Join presence room
    socket.join('presence');
    broadcastPresence();
    
    // Handle presence events
    socket.on('presence:join', () => {
      broadcastPresence();
    });
    
    // Handle game join
    socket.on('game:join', async (gameId: string) => {
      socket.join(`game:${gameId}`);
      
      // Send current game state
      const gameState = activeGames.get(gameId);
      if (gameState) {
        socket.emit('game:state', sanitizeGameState(gameState, user.userId));
      }
      
      // Broadcast updated player list
      await broadcastLobbyState(gameId);
    });
    
    // Handle game leave
    socket.on('game:leave', (gameId: string) => {
      socket.leave(`game:${gameId}`);
    });
    
    // Handle game start (host only)
    socket.on('game:start', async (gameId: string) => {
      try {
        const game = await prisma.game.findUnique({
          where: { id: gameId },
          include: {
            players: {
              include: { user: true },
              orderBy: { seatIndex: 'asc' },
            },
          },
        });
        
        if (!game) {
          socket.emit('game:error', 'Game not found');
          return;
        }
        
        if (game.hostUserId !== user.userId) {
          socket.emit('game:error', 'Only host can start the game');
          return;
        }
        
        if (game.phase !== 'lobby') {
          socket.emit('game:error', 'Game already started');
          return;
        }
        
        if (game.players.length < 2) {
          socket.emit('game:error', 'Need at least 2 players to start');
          return;
        }
        
        // Clear lobby timer
        clearGameTimer(gameId);
        
        // Initialize game state
        const players = game.players.map((p) => ({
          oderId: p.oderId,
          username: p.user.username,
        }));
        
        const gameState = initializeGameState(gameId, players);
        activeGames.set(gameId, gameState);
        
        // Update database
        await prisma.game.update({
          where: { id: gameId },
          data: {
            phase: 'betting',
            startedAt: new Date(),
          },
        });
        
        // Note: Hands are stored in memory during gameplay
        // GameHistory is used to store completed rounds
        // This file is not used by server.js (which has its own Socket.IO implementation)
        
        // Broadcast game state to all players
        broadcastGameState(gameId);
        
        // Start turn timer
        startTurnTimer(gameId);
        
      } catch (error) {
        console.error('Error starting game:', error);
        socket.emit('game:error', 'Failed to start game');
      }
    });
    
    // Handle game action (hit/stand)
    socket.on('game:action', async (data: { gameId: string; action: 'hit' | 'stand' }) => {
      try {
        const { gameId, action } = data;
        let gameState = activeGames.get(gameId);
        
        if (!gameState) {
          socket.emit('game:error', 'Game not found');
          return;
        }
        
        if (gameState.status !== 'in_progress') {
          socket.emit('game:error', 'Game is not in progress');
          return;
        }
        
        // Clear turn timer
        clearTurnTimer(gameId);
        
        // Apply action
        if (action === 'hit') {
          gameState = applyHit(gameState, user.userId);
        } else {
          gameState = applyStand(gameState, user.userId);
        }
        
        activeGames.set(gameId, gameState);
        
        // Note: Moves are tracked in memory during gameplay
        // GameHistory is used to store completed rounds in the database
        // This file is not used by server.js (which has its own Socket.IO implementation)
        
        // Check if game is finished
        if (gameState.status === 'finished') {
          await finalizeGame(gameId, gameState);
        } else {
          // Start next turn timer
          startTurnTimer(gameId);
        }
        
        // Broadcast updated state
        broadcastGameState(gameId);
        
      } catch (error) {
        console.error('Error processing action:', error);
        socket.emit('game:error', error instanceof Error ? error.message : 'Failed to process action');
      }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.username}`);
      connectedUsers.delete(user.userId);
      broadcastPresence();
    });
  });
  
  return io;
}

function broadcastPresence() {
  if (!io) return;
  
  const users = Array.from(connectedUsers.values()).map((u) => ({
    oderId: u.oderId,
    username: u.username,
  }));
  
  io.to('presence').emit('presence:update', users);
}

async function broadcastLobbyState(gameId: string) {
  if (!io) return;
  
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        include: { user: true },
        orderBy: { seatIndex: 'asc' },
      },
      host: true,
    },
  });
  
  if (!game) return;
  
  const lobbyState = {
    gameId: game.id,
    phase: game.phase,
    hostId: game.hostUserId,
    hostUsername: game.host.username,
    maxPlayers: game.maxPlayers,
    players: game.players.map((p) => ({
      oderId: p.oderId,
      username: p.user.username,
      seatIndex: p.seatIndex,
      isSittingOut: p.isSittingOut,
    })),
  };
  
  io.to(`game:${gameId}`).emit('lobby:state', lobbyState);
}

function broadcastGameState(gameId: string) {
  if (!io) return;
  
  const gameState = activeGames.get(gameId);
  if (!gameState) return;
  
  // Send sanitized state to each player
  const room = io.sockets.adapter.rooms.get(`game:${gameId}`);
  if (!room) return;
  
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket;
    if (socket?.user) {
      socket.emit('game:state', sanitizeGameState(gameState, socket.user.userId));
    }
  }
}

function sanitizeGameState(state: GameState, viewerId: string): object {
  // Players can see their own cards fully, others' cards are hidden during play
  const players = state.players.map((player) => {
    const isViewer = player.oderId === viewerId;
    const showCards = state.status === 'finished' || isViewer;
    
    return {
      oderId: player.oderId,
      username: player.username,
      cards: showCards ? player.cards : player.cards.map(() => ({ hidden: true })),
      cardCount: player.cards.length,
      totalValue: showCards ? player.totalValue : null,
      isBusted: player.isBusted,
      isStanding: player.isStanding,
      hasFinishedTurn: player.hasFinishedTurn,
      isCurrentTurn: state.players[state.currentTurnIndex]?.oderId === player.oderId,
    };
  });
  
  return {
    gameId: state.gameId,
    status: state.status,
    players,
    currentTurnIndex: state.currentTurnIndex,
    currentPlayerId: state.players[state.currentTurnIndex]?.oderId,
    winners: state.winners,
    pointsMap: state.status === 'finished' ? state.pointsMap : {},
    isMyTurn: state.players[state.currentTurnIndex]?.oderId === viewerId,
  };
}

function startLobbyTimer(gameId: string) {
  clearGameTimer(gameId);
  
  const timer = setTimeout(async () => {
    // Cancel game if not enough players
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { players: true },
    });
    
    if (game && game.phase === 'lobby' && game.players.length < 2) {
      await prisma.game.update({
        where: { id: gameId },
        data: { isOpen: false },
      });
      
      io?.to(`game:${gameId}`).emit('game:cancelled', 'Lobby timeout - not enough players');
    }
  }, LOBBY_TIMEOUT);
  
  gameTimers.set(gameId, timer);
}

function clearGameTimer(gameId: string) {
  const timer = gameTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    gameTimers.delete(gameId);
  }
}

function startTurnTimer(gameId: string) {
  clearTurnTimer(gameId);
  
  const timer = setTimeout(async () => {
    let gameState = activeGames.get(gameId);
    if (!gameState || gameState.status !== 'in_progress') return;
    
    // Force stand for current player
    gameState = forceStand(gameState);
    activeGames.set(gameId, gameState);
    
    // Notify about timeout
    io?.to(`game:${gameId}`).emit('game:timeout', {
      playerId: gameState.players[gameState.currentTurnIndex - 1]?.oderId,
      message: 'Turn timeout - auto stand',
    });
    
    if (gameState.status === 'finished') {
      await finalizeGame(gameId, gameState);
    } else {
      startTurnTimer(gameId);
    }
    
    broadcastGameState(gameId);
  }, TURN_TIMEOUT);
  
  turnTimers.set(gameId, timer);
  
  // Broadcast timer start
  io?.to(`game:${gameId}`).emit('game:timer', { seconds: TURN_TIMEOUT / 1000 });
}

function clearTurnTimer(gameId: string) {
  const timer = turnTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    turnTimers.delete(gameId);
  }
}

async function finalizeGame(gameId: string, gameState: GameState) {
  // Clear timers
  clearGameTimer(gameId);
  clearTurnTimer(gameId);
  
        // Update database
        await prisma.game.update({
          where: { id: gameId },
          data: {
            phase: 'settlement',
            endedAt: new Date(),
            isOpen: false,
          },
        });
  
  // Store game history for completed rounds
  // Note: This file is not used by server.js (which has its own Socket.IO implementation)
  // The actual game state is stored in GameHistory by server.js
  
  // Clean up memory
  activeGames.delete(gameId);
}

export { startLobbyTimer, clearGameTimer };


