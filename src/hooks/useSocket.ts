'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// ============ GLOBAL SOCKET SINGLETON ============
let globalSocket: Socket | null = null;
let globalConnected = false;
let isCreating = false;

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(listener => listener());
}

async function getOrCreateSocket(): Promise<Socket | null> {
  // Return existing connected socket
  if (globalSocket?.connected) {
    return globalSocket;
  }
  
  // Return existing socket that's connecting
  if (globalSocket && !globalSocket.disconnected) {
    return globalSocket;
  }
  
  // Prevent concurrent creation
  if (isCreating) {
    // Wait for socket to be created
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!isCreating) {
          clearInterval(check);
          resolve(globalSocket);
        }
      }, 50);
    });
  }
  
  isCreating = true;
  
  try {
    const response = await fetch('/api/auth/socket-token');
    if (!response.ok) {
      console.error('Failed to get socket token');
      isCreating = false;
      return null;
    }
    
    const { token } = await response.json();
    
    console.log('🔌 Creating socket connection...');
    
    const socket = io(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
      path: '/api/socketio',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    
    socket.on('connect', () => {
      console.log('✅ Socket connected');
      globalConnected = true;
      notifyListeners();
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      globalConnected = false;
      notifyListeners();
    });
    
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });
    
    globalSocket = socket;
    isCreating = false;
    
    return socket;
  } catch (error) {
    console.error('Failed to create socket:', error);
    isCreating = false;
    return null;
  }
}

// ============ SOCKET HOOK ============
export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(globalSocket);
  const [isConnected, setIsConnected] = useState(globalConnected);

  useEffect(() => {
    const updateState = () => {
      setSocket(globalSocket);
      setIsConnected(globalConnected);
    };
    
    listeners.add(updateState);
    updateState();
    
    return () => {
      listeners.delete(updateState);
    };
  }, []);

  const connect = useCallback(async () => {
    const sock = await getOrCreateSocket();
    if (sock) {
      setSocket(sock);
      setIsConnected(sock.connected);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (globalSocket) {
      globalSocket.disconnect();
      globalSocket = null;
      globalConnected = false;
      setSocket(null);
      setIsConnected(false);
    }
  }, []);

  return { socket, isConnected, connect, disconnect };
}

// ============ PRESENCE ============
export function usePresence(socket: Socket | null) {
  const [connectedUsers, setConnectedUsers] = useState<{ oderId: string; username: string }[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (users: { oderId: string; username: string }[]) => {
      setConnectedUsers(users);
    };

    socket.on('presence:update', handleUpdate);
    return () => { socket.off('presence:update', handleUpdate); };
  }, [socket]);

  return { connectedUsers };
}

// ============ PUBLIC TABLES ============
export interface PublicTable {
  id: string;
  name: string;
  hostUsername: string;
  playerCount: number;
  maxPlayers: number;
  minBet: number;
  maxBet: number;
  phase: string;
}

export function usePublicTables(socket: Socket | null) {
  const [tables, setTables] = useState<PublicTable[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleList = (list: PublicTable[]) => setTables(list);
    
    socket.on('tables:list', handleList);
    socket.emit('tables:refresh');
    
    return () => { socket.off('tables:list', handleList); };
  }, [socket]);

  const refresh = useCallback(() => {
    socket?.emit('tables:refresh');
  }, [socket]);

  return { tables, refresh };
}

// ============ TYPES ============
export interface Card {
  suit: string;
  rank: string;
  value: number;
}

export interface HiddenCard {
  hidden: boolean;
}

export interface DealerState {
  cards: (Card | HiddenCard)[];
  value: number | null;
  isBusted: boolean;
}

export interface SplitHand {
  cards: Card[];
  value: number;
  bet: number;
  isBusted: boolean;
  isStanding: boolean;
  result: 'win' | 'lose' | 'push' | 'blackjack' | null;
  payout: number;
}

export interface PlayerState {
  oderId: string;
  username: string;
  seatIndex: number;
  cards: Card[];
  value: number;
  bet: number;
  insuranceBet?: number;
  isBusted: boolean;
  isStanding: boolean;
  isSittingOut: boolean;
  hasBlackjack: boolean;
  hasBet: boolean;
  hasDoubled?: boolean;
  canSplit?: boolean;
  isSplit?: boolean;
  splitHands?: SplitHand[];
  currentSplitHandIndex?: number;
  result: 'win' | 'lose' | 'push' | 'blackjack' | null;
  payout: number;
  balance: number;
  isCurrentTurn: boolean;
}

export interface RoundResult {
  round: number;
  result: 'win' | 'lose' | 'push' | 'blackjack';
  payout: number;
}

export interface ActionLogEntry {
  timestamp: number;
  player: string | null;
  action: string;
  details: string;
}

export interface TableState {
  tableId: string;
  name: string;
  phase: 'lobby' | 'betting' | 'dealing' | 'insurance' | 'player_turn' | 'dealer_turn' | 'settlement';
  currentRound: number;
  minBet: number;
  maxBet: number;
  maxPlayers: number;
  hostId: string;
  bettingEndTime: number | null;
  turnEndTime: number | null;
  dealer: DealerState;
  players: PlayerState[];
  currentPlayerId: string | null;
  actionLog: ActionLogEntry[];
  isMyTurn: boolean;
  myPlayer?: PlayerState;
  isHost: boolean;
  // Historiques
  dealerHistory: Array<{ cards: Card[]; value: number; isBusted: boolean }>;
  playerHistory: RoundResult[];
}

// ============ TABLE HOOK ============
export function useTable(socket: Socket | null, tableId: string | null) {
  const [tableState, setTableState] = useState<TableState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tableClosed, setTableClosed] = useState<string | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const joinedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!socket || !tableId) {
      return;
    }
    
    const doJoin = () => {
      if (joinedRef.current === tableId) return;
      if (!socket.connected) return;
      
      joinedRef.current = tableId;
      console.log('🎯 Joining table:', tableId);
      socket.emit('table:join', tableId);
    };
    
    // Join when connected
    if (socket.connected) {
      doJoin();
    }
    socket.on('connect', doJoin);
    
    // Handlers
    const onState = (state: TableState) => {
      setTableState(state);
      setError(null);
      
      // Timer
      if (state.bettingEndTime && state.phase === 'betting') {
        const remaining = Math.max(0, Math.floor((state.bettingEndTime - Date.now()) / 1000));
        setTimer(remaining);
        startCountdown(remaining);
      } else if (state.bettingEndTime && state.phase === 'insurance') {
        const remaining = Math.max(0, Math.floor((state.bettingEndTime - Date.now()) / 1000));
        setTimer(remaining);
        startCountdown(remaining);
      } else if (state.turnEndTime && state.phase === 'player_turn') {
        const remaining = Math.max(0, Math.floor((state.turnEndTime - Date.now()) / 1000));
        setTimer(remaining);
        startCountdown(remaining);
      } else {
        setTimer(null);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };
    
    const onError = (msg: string) => {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    };
    
    const onClosed = (data: { message: string }) => {
      setTableClosed(data.message);
    };
    
    const startCountdown = (seconds: number) => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimer(prev => {
          if (prev === null || prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    };
    
    socket.on('table:state', onState);
    socket.on('table:error', onError);
    socket.on('table:closed', onClosed);
    
    return () => {
      socket.off('connect', doJoin);
      socket.off('table:state', onState);
      socket.off('table:error', onError);
      socket.off('table:closed', onClosed);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [socket, tableId]);

  // Actions
  const startGame = useCallback(() => {
    if (socket && tableId) socket.emit('table:start', tableId);
  }, [socket, tableId]);

  const placeBet = useCallback((amount: number) => {
    if (socket && tableId) socket.emit('table:bet', { tableId, amount });
  }, [socket, tableId]);

  const hit = useCallback(() => {
    if (socket && tableId) socket.emit('table:hit', tableId);
  }, [socket, tableId]);

  const stand = useCallback(() => {
    if (socket && tableId) socket.emit('table:stand', tableId);
  }, [socket, tableId]);

  const double = useCallback(() => {
    if (socket && tableId) socket.emit('table:double', tableId);
  }, [socket, tableId]);

  const split = useCallback(() => {
    if (socket && tableId) socket.emit('table:split', tableId);
  }, [socket, tableId]);

  const insurance = useCallback((takeInsurance: boolean) => {
    if (socket && tableId) socket.emit('table:insurance', { tableId, takeInsurance });
  }, [socket, tableId]);

  const leaveTable = useCallback(() => {
    if (socket && tableId) {
      socket.emit('table:leave', tableId);
      joinedRef.current = null;
      setTableState(null);
    }
  }, [socket, tableId]);

  const deleteTable = useCallback(() => {
    if (socket && tableId) socket.emit('table:delete', tableId);
  }, [socket, tableId]);

  return {
    tableState,
    error,
    tableClosed,
    timer,
    startGame,
    placeBet,
    hit,
    stand,
    double,
    split,
    insurance,
    leaveTable,
    deleteTable,
  };
}
