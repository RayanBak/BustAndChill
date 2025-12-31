// BlackJack Game Engine - Pure functions for game logic

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // Base value (Ace = 11, Face cards = 10)
}

export interface PlayerHand {
  oderId: string;
  username: string;
  cards: Card[];
  totalValue: number;
  isBusted: boolean;
  isStanding: boolean;
  hasFinishedTurn: boolean;
}

export interface GameState {
  gameId: string;
  status: 'waiting' | 'in_progress' | 'finished' | 'cancelled';
  players: PlayerHand[];
  currentTurnIndex: number;
  deck: Card[];
  winners: string[];
  pointsMap: Record<string, number>;
}

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function getCardValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank);
}

export function createDeck(): Card[] {
  const deck: Card[] = [];
  
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        suit,
        rank,
        value: getCardValue(rank),
      });
    }
  }
  
  return deck;
}

export function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function drawCard(deck: Card[]): { card: Card; remainingDeck: Card[] } | null {
  if (deck.length === 0) return null;
  
  const [card, ...remainingDeck] = deck;
  return { card, remainingDeck };
}

export function computeHandValue(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  
  for (const card of cards) {
    total += card.value;
    if (card.rank === 'A') aces++;
  }
  
  // Adjust for aces: if we're busted and have aces, count them as 1 instead of 11
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  
  return total;
}

export function isBusted(value: number): boolean {
  return value > 21;
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && computeHandValue(cards) === 21;
}

export function initializeGameState(
  gameId: string,
  players: { oderId: string; username: string }[]
): GameState {
  let deck = shuffle(createDeck());
  
  const playerHands: PlayerHand[] = players.map((player) => {
    // Deal 2 cards to each player
    const draw1 = drawCard(deck);
    if (!draw1) throw new Error('Not enough cards in deck');
    deck = draw1.remainingDeck;
    
    const draw2 = drawCard(deck);
    if (!draw2) throw new Error('Not enough cards in deck');
    deck = draw2.remainingDeck;
    
    const cards = [draw1.card, draw2.card];
    const totalValue = computeHandValue(cards);
    
    return {
      oderId: player.oderId,
      username: player.username,
      cards,
      totalValue,
      isBusted: isBusted(totalValue),
      isStanding: false,
      hasFinishedTurn: false,
    };
  });
  
  return {
    gameId,
    status: 'in_progress',
    players: playerHands,
    currentTurnIndex: 0,
    deck,
    winners: [],
    pointsMap: {},
  };
}

export function getCurrentPlayer(state: GameState): PlayerHand | null {
  if (state.status !== 'in_progress') return null;
  if (state.currentTurnIndex >= state.players.length) return null;
  
  return state.players[state.currentTurnIndex];
}

export function applyHit(state: GameState, oderId: string): GameState {
  const currentPlayer = getCurrentPlayer(state);
  
  if (!currentPlayer || currentPlayer.oderId !== oderId) {
    throw new Error('Not your turn');
  }
  
  if (currentPlayer.hasFinishedTurn || currentPlayer.isBusted || currentPlayer.isStanding) {
    throw new Error('Cannot hit - turn already finished');
  }
  
  const draw = drawCard(state.deck);
  if (!draw) {
    throw new Error('No more cards in deck');
  }
  
  const newCards = [...currentPlayer.cards, draw.card];
  const newValue = computeHandValue(newCards);
  const busted = isBusted(newValue);
  
  const updatedPlayers = state.players.map((player, index) => {
    if (index === state.currentTurnIndex) {
      return {
        ...player,
        cards: newCards,
        totalValue: newValue,
        isBusted: busted,
        hasFinishedTurn: busted, // Busted = turn over
      };
    }
    return player;
  });
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
    deck: draw.remainingDeck,
  };
  
  // If busted, move to next player
  if (busted) {
    newState = moveToNextPlayer(newState);
  }
  
  return newState;
}

export function applyStand(state: GameState, oderId: string): GameState {
  const currentPlayer = getCurrentPlayer(state);
  
  if (!currentPlayer || currentPlayer.oderId !== oderId) {
    throw new Error('Not your turn');
  }
  
  if (currentPlayer.hasFinishedTurn) {
    throw new Error('Cannot stand - turn already finished');
  }
  
  const updatedPlayers = state.players.map((player, index) => {
    if (index === state.currentTurnIndex) {
      return {
        ...player,
        isStanding: true,
        hasFinishedTurn: true,
      };
    }
    return player;
  });
  
  let newState: GameState = {
    ...state,
    players: updatedPlayers,
  };
  
  newState = moveToNextPlayer(newState);
  
  return newState;
}

function moveToNextPlayer(state: GameState): GameState {
  let nextIndex = state.currentTurnIndex + 1;
  
  // Find next player who hasn't finished their turn
  while (nextIndex < state.players.length && state.players[nextIndex].hasFinishedTurn) {
    nextIndex++;
  }
  
  // If all players have finished, end the game
  if (nextIndex >= state.players.length) {
    return finishGame(state);
  }
  
  return {
    ...state,
    currentTurnIndex: nextIndex,
  };
}

export function finishGame(state: GameState): GameState {
  // Calculate points for each player
  const pointsMap: Record<string, number> = {};
  let maxPoints = -1;
  const potentialWinners: string[] = [];
  
  for (const player of state.players) {
    // Points = hand value if not busted, 0 if busted
    const points = player.isBusted ? 0 : player.totalValue;
    pointsMap[player.oderId] = points;
    
    if (points > maxPoints) {
      maxPoints = points;
      potentialWinners.length = 0;
      potentialWinners.push(player.oderId);
    } else if (points === maxPoints && points > 0) {
      potentialWinners.push(player.oderId);
    }
  }
  
  // Mark all players as finished
  const finalPlayers = state.players.map((player) => ({
    ...player,
    hasFinishedTurn: true,
    isStanding: !player.isBusted,
  }));
  
  return {
    ...state,
    status: 'finished',
    players: finalPlayers,
    winners: maxPoints > 0 ? potentialWinners : [],
    pointsMap,
  };
}

export function forceStand(state: GameState): GameState {
  const currentPlayer = getCurrentPlayer(state);
  if (!currentPlayer) return state;
  
  return applyStand(state, currentPlayer.oderId);
}

// Serialize game state for database storage
export function serializeDeck(deck: Card[]): string {
  return JSON.stringify(deck);
}

export function deserializeDeck(deckJson: string): Card[] {
  return JSON.parse(deckJson);
}

export function serializeCards(cards: Card[]): string {
  return JSON.stringify(cards);
}

export function deserializeCards(cardsJson: string): Card[] {
  return JSON.parse(cardsJson);
}

// Get card display info
export function getCardDisplay(card: Card): { symbol: string; color: 'red' | 'black' } {
  const suitSymbols: Record<Suit, string> = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  };
  
  const color: 'red' | 'black' = ['hearts', 'diamonds'].includes(card.suit) ? 'red' : 'black';
  
  return {
    symbol: suitSymbols[card.suit],
    color,
  };
}


