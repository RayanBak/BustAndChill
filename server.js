const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server: SocketIOServer } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const dev = process.env.NODE_ENV !== 'production';
// In production, bind to 0.0.0.0 to accept connections from any interface
// In development, use localhost for security
const hostname = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

// ============ CONSTANTS ============
const BETTING_TIMEOUT = 20000; // 20 seconds to bet
const TURN_TIMEOUT = 15000;    // 15 seconds per turn
const DEALING_DELAY = 500;     // 500ms between card deals
const SETTLEMENT_DELAY = 4000; // 4 seconds to show results

// ============ IN-MEMORY STATE ============
const connectedUsers = new Map();  // oderId -> { oderId, username, socketId, currentTableId }
const activeTables = new Map();    // tableId -> TableState
const timers = new Map();          // tableId -> timer

let io = null;

// ============ JWT VERIFICATION ============
function verifyToken(token) {
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ============ CARD & DECK ============
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function getCardValue(rank) {
  if (rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank);
}

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank, value: getCardValue(rank) });
    }
  }
  return deck;
}

function createShoe(numDecks = 6) {
  let shoe = [];
  for (let i = 0; i < numDecks; i++) {
    shoe = shoe.concat(createDeck());
  }
  return shuffle(shoe);
}

function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function computeHandValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += card.value;
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBusted(value) {
  return value > 21;
}

function isBlackjack(cards) {
  return cards.length === 2 && computeHandValue(cards) === 21;
}

// ============ TABLE STATE ============
function createTableState(tableId, hostId, settings) {
  return {
    tableId,
    hostId,
    name: settings.name || 'Table de Blackjack',
    visibility: settings.visibility || 'public',
    minBet: settings.minBet || 10,
    maxBet: settings.maxBet || 500,
    maxPlayers: settings.maxPlayers || 5,
    phase: 'lobby', // lobby | betting | dealing | player_turn | dealer_turn | settlement
    currentRound: 0,
    shoe: createShoe(6),
    currentPlayerIndex: -1,
    dealer: {
      cards: [],
      value: 0,
      isBusted: false,
    },
    players: [], // { oderId, username, seatIndex, cards, value, bet, isBusted, isStanding, isSittingOut, hasBlackjack, result, payout, balance, history }
    actionLog: [], // { timestamp, player, action, details }
    bettingEndTime: null,
    turnEndTime: null,
    // Historiques
    dealerHistory: [], // 5 derniers tirages du croupier
  };
}

function addPlayerToTable(state, oderId, username, balance) {
  // Find next available seat
  const usedSeats = state.players.map(p => p.seatIndex);
  let seatIndex = 1;
  while (usedSeats.includes(seatIndex) && seatIndex <= state.maxPlayers) {
    seatIndex++;
  }
  
  if (seatIndex > state.maxPlayers) return null;
  
  const player = {
    oderId,
    username,
    seatIndex,
    cards: [],
    value: 0,
    bet: 0,
    insuranceBet: 0, // Mise d'assurance
    isBusted: false,
    isStanding: false,
    isSittingOut: false,
    hasBlackjack: false,
    hasBet: false,
    hasDoubled: false, // A doublé sa mise
    canSplit: false, // Peut faire split (2 cartes identiques)
    isSplit: false, // A fait split
    splitHands: [], // Mains après split [{cards, value, bet, isBusted, isStanding, result, payout}]
    result: null, // 'win' | 'lose' | 'push' | 'blackjack'
    payout: 0,
    balance,
    history: [], // Historique des 5 dernières parties pour ce joueur
  };
  
  state.players.push(player);
  state.players.sort((a, b) => a.seatIndex - b.seatIndex);
  
  return player;
}

function removePlayerFromTable(state, oderId) {
  const index = state.players.findIndex(p => p.oderId === oderId);
  if (index !== -1) {
    state.players.splice(index, 1);
  }
}

function getActivePlayersForRound(state) {
  return state.players.filter(p => !p.isSittingOut && p.bet > 0);
}

function getNextPlayerIndex(state) {
  const activePlayers = getActivePlayersForRound(state);
  for (let i = state.currentPlayerIndex + 1; i < activePlayers.length; i++) {
    const player = activePlayers[i];
    if (!player.isBusted && !player.isStanding && !player.hasBlackjack) {
      return i;
    }
  }
  return -1; // No more players
}

// ============ PHASE TRANSITIONS ============

async function transitionToPhase(tableId, newPhase) {
  const state = activeTables.get(tableId);
  if (!state) return;
  
  // Clear any existing timer
  clearTableTimer(tableId);
  
  state.phase = newPhase;
  
  switch (newPhase) {
    case 'betting':
      await startBettingPhase(tableId);
      break;
    case 'dealing':
      await startDealingPhase(tableId);
      break;
    case 'player_turn':
      await startPlayerTurnPhase(tableId);
      break;
    case 'dealer_turn':
      await startDealerTurnPhase(tableId);
      break;
    case 'settlement':
      await startSettlementPhase(tableId);
      break;
  }
  
  broadcastTableState(tableId);
}

async function startBettingPhase(tableId) {
  const state = activeTables.get(tableId);
  if (!state) return;
  
  state.currentRound++;
  state.bettingEndTime = Date.now() + BETTING_TIMEOUT;
  
  // Reset players for new round
  for (const player of state.players) {
    player.cards = [];
    player.value = 0;
    player.bet = 0;
    player.isBusted = false;
    player.isStanding = false;
    player.hasBlackjack = false;
    player.hasBet = false;
    player.result = null;
    player.payout = 0;
    player.isSittingOut = false;
  }
  
  // Reset dealer
  state.dealer = { cards: [], value: 0, isBusted: false };
  state.currentPlayerIndex = -1;
  
  // Reshuffle if needed
  if (state.shoe.length < 52) {
    state.shoe = createShoe(6);
    addLog(state, null, 'shuffle', 'Le sabot a été mélangé');
  }
  
  addLog(state, null, 'round_start', `Round ${state.currentRound} - Les mises sont ouvertes !`);
  
  // Set betting timer
  setTableTimer(tableId, BETTING_TIMEOUT, async () => {
    await endBettingPhase(tableId);
  });
}

async function endBettingPhase(tableId) {
  const state = activeTables.get(tableId);
  if (!state) return;
  
  // Mark players who didn't bet as sitting out
  for (const player of state.players) {
    if (!player.hasBet || player.bet === 0) {
      player.isSittingOut = true;
      addLog(state, player.username, 'sit_out', 'passe son tour');
    }
  }
  
  const activePlayers = getActivePlayersForRound(state);
  
  if (activePlayers.length === 0) {
    addLog(state, null, 'no_bets', 'Aucune mise - nouvelle manche');
    await transitionToPhase(tableId, 'betting');
    return;
  }
  
  await transitionToPhase(tableId, 'dealing');
}

async function startDealingPhase(tableId) {
  const state = activeTables.get(tableId);
  if (!state) return;
  
  addLog(state, null, 'dealing', 'Distribution des cartes...');
  
  const activePlayers = getActivePlayersForRound(state);
  
  // Deal 2 cards to each player
  for (let round = 0; round < 2; round++) {
    for (const player of activePlayers) {
      const card = state.shoe.shift();
      player.cards.push(card);
      player.value = computeHandValue(player.cards);
    }
    // Dealer gets a card
    const dealerCard = state.shoe.shift();
    state.dealer.cards.push(dealerCard);
    state.dealer.value = computeHandValue(state.dealer.cards);
  }
  
  // Check for blackjacks
  for (const player of activePlayers) {
    if (isBlackjack(player.cards)) {
      player.hasBlackjack = true;
      player.isStanding = true;
      addLog(state, player.username, 'blackjack', 'BLACKJACK ! 🎉');
    }
  }
  
  // Check if dealer has Ace showing - offer insurance
  const dealerHasAce = state.dealer.cards.length > 0 && state.dealer.cards[0].rank === 'A';
  
  broadcastTableState(tableId);
  
  if (dealerHasAce) {
    // Phase d'assurance
    addLog(state, null, 'insurance', 'Le croupier a un As ! Assurance disponible...');
    state.phase = 'insurance';
    state.bettingEndTime = Date.now() + 15000; // 15 secondes pour décider
    broadcastTableState(tableId);
    
    setTableTimer(tableId, 15000, async () => {
      // Timer expired - mark all undecided players as refusing
      for (const player of activePlayers) {
        if (!player.insuranceDecided) {
          player.insuranceDecided = true;
          player.insuranceBet = 0;
        }
      }
      await processInsuranceResult(tableId);
    });
  } else {
    // No insurance needed, go directly to player turns
    setTableTimer(tableId, 1000, async () => {
      await transitionToPhase(tableId, 'player_turn');
    });
  }
}

async function startPlayerTurnPhase(tableId) {
  const state = activeTables.get(tableId);
  if (!state) return;
  
  state.currentPlayerIndex = -1;
  await moveToNextPlayer(tableId);
}

async function moveToNextPlayer(tableId) {
  const state = activeTables.get(tableId);
  if (!state) return;
  
  const activePlayers = getActivePlayersForRound(state);
  let found = false;
  
  for (let i = state.currentPlayerIndex + 1; i < activePlayers.length; i++) {
    const player = activePlayers[i];
    if (!player.isBusted && !player.isStanding && !player.hasBlackjack) {
      state.currentPlayerIndex = i;
      state.turnEndTime = Date.now() + TURN_TIMEOUT;
      
      addLog(state, player.username, 'turn', 'à vous de jouer !');
      
      // Set turn timer
      setTableTimer(tableId, TURN_TIMEOUT, async () => {
        await handleTurnTimeout(tableId);
      });
      
      found = true;
      break;
    }
  }
  
  if (!found) {
    // All players done, move to dealer
    await transitionToPhase(tableId, 'dealer_turn');
  } else {
    broadcastTableState(tableId);
  }
}

async function handleTurnTimeout(tableId) {
  const state = activeTables.get(tableId);
  if (!state || state.phase !== 'player_turn') return;
  
  const activePlayers = getActivePlayersForRound(state);
  const currentPlayer = activePlayers[state.currentPlayerIndex];
  
  if (currentPlayer && !currentPlayer.isStanding && !currentPlayer.isBusted) {
    // Auto-stand on timeout
    currentPlayer.isStanding = true;
    addLog(state, currentPlayer.username, 'timeout', 'temps écoulé - reste automatiquement');
    
    broadcastTableState(tableId);
    await moveToNextPlayer(tableId);
  }
}

async function startDealerTurnPhase(tableId) {
  const state = activeTables.get(tableId);
  if (!state) return;
  
  addLog(state, '🎩 Croupier', 'reveal', 'révèle sa carte cachée');
  
  broadcastTableState(tableId);
  
  // Dealer draws until 17
  const dealerPlay = async () => {
    while (state.dealer.value < 17 && !state.dealer.isBusted) {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const card = state.shoe.shift();
      state.dealer.cards.push(card);
      state.dealer.value = computeHandValue(state.dealer.cards);
      state.dealer.isBusted = isBusted(state.dealer.value);
      
      addLog(state, '🎩 Croupier', 'hit', `tire ${card.rank}${getSuitSymbol(card.suit)}`);
      broadcastTableState(tableId);
    }
    
    if (state.dealer.isBusted) {
      addLog(state, '🎩 Croupier', 'bust', `BUST ! (${state.dealer.value})`);
    } else {
      addLog(state, '🎩 Croupier', 'stand', `reste à ${state.dealer.value}`);
    }
    
    await transitionToPhase(tableId, 'settlement');
  };
  
  setTimeout(dealerPlay, 500);
}

async function startSettlementPhase(tableId) {
  const state = activeTables.get(tableId);
  if (!state) return;
  
  // Ajouter à l'historique du croupier (5 derniers)
  if (!state.dealerHistory) state.dealerHistory = [];
  state.dealerHistory.push({
    cards: [...state.dealer.cards],
    value: state.dealer.value,
    isBusted: state.dealer.isBusted,
  });
  if (state.dealerHistory.length > 5) {
    state.dealerHistory = state.dealerHistory.slice(-5);
  }
  
  const activePlayers = getActivePlayersForRound(state);
  const dealerValue = state.dealer.value;
  const dealerBusted = state.dealer.isBusted;
  const dealerBlackjack = isBlackjack(state.dealer.cards);
  
  for (const player of activePlayers) {
    let totalPayout = 0;
    let totalBet = player.bet;
    let hasWon = false;
    let hasBJ = false;
    
    // Handle split hands
    if (player.isSplit && player.splitHands && player.splitHands.length > 0) {
      for (const hand of player.splitHands) {
        totalBet += hand.bet;
        
        if (hand.isBusted) {
          hand.result = 'lose';
          hand.payout = 0;
          addLog(state, player.username, 'result', `Main ${player.splitHands.indexOf(hand) + 1}: perd $${hand.bet} (bust)`);
        } else {
          const handBlackjack = isBlackjack(hand.cards);
          
          if (handBlackjack && !dealerBlackjack) {
            hand.result = 'blackjack';
            hand.payout = Math.floor(hand.bet * 2.5);
            totalPayout += hand.payout;
            hasWon = true;
            hasBJ = true;
            addLog(state, player.username, 'result', `Main ${player.splitHands.indexOf(hand) + 1}: BLACKJACK ! Gagne $${hand.payout - hand.bet}`);
          } else if (dealerBlackjack && !handBlackjack) {
            hand.result = 'lose';
            hand.payout = 0;
            addLog(state, player.username, 'result', `Main ${player.splitHands.indexOf(hand) + 1}: perd $${hand.bet} (dealer BJ)`);
          } else if (handBlackjack && dealerBlackjack) {
            hand.result = 'push';
            hand.payout = hand.bet;
            totalPayout += hand.payout;
            addLog(state, player.username, 'result', `Main ${player.splitHands.indexOf(hand) + 1}: égalité (double BJ)`);
          } else if (dealerBusted) {
            hand.result = 'win';
            hand.payout = hand.bet * 2;
            totalPayout += hand.payout;
            hasWon = true;
            addLog(state, player.username, 'result', `Main ${player.splitHands.indexOf(hand) + 1}: gagne $${hand.bet} (dealer bust)`);
          } else if (hand.value > dealerValue) {
            hand.result = 'win';
            hand.payout = hand.bet * 2;
            totalPayout += hand.payout;
            hasWon = true;
            addLog(state, player.username, 'result', `Main ${player.splitHands.indexOf(hand) + 1}: gagne $${hand.bet}`);
          } else if (hand.value < dealerValue) {
            hand.result = 'lose';
            hand.payout = 0;
            addLog(state, player.username, 'result', `Main ${player.splitHands.indexOf(hand) + 1}: perd $${hand.bet}`);
          } else {
            hand.result = 'push';
            hand.payout = hand.bet;
            totalPayout += hand.payout;
            addLog(state, player.username, 'result', `Main ${player.splitHands.indexOf(hand) + 1}: égalité (push)`);
          }
        }
      }
      
      // Set overall result based on split hands
      const wins = player.splitHands.filter(h => h.result === 'win' || h.result === 'blackjack').length;
      const losses = player.splitHands.filter(h => h.result === 'lose').length;
      
      if (wins > losses) {
        player.result = 'win';
      } else if (losses > wins) {
        player.result = 'lose';
      } else {
        player.result = 'push';
      }
      
      player.payout = totalPayout;
    } else {
      // Normal hand (no split)
      if (player.isBusted) {
        player.result = 'lose';
        player.payout = 0;
        addLog(state, player.username, 'result', `perd $${player.bet} (bust)`);
      } else {
        const playerBlackjack = player.hasBlackjack;
        
        if (playerBlackjack && !dealerBlackjack) {
          // Blackjack pays 3:2
          player.result = 'blackjack';
          player.payout = Math.floor(player.bet * 2.5);
          hasWon = true;
          hasBJ = true;
          addLog(state, player.username, 'result', `BLACKJACK ! Gagne $${player.payout - player.bet}`);
        } else if (dealerBlackjack && !playerBlackjack) {
          player.result = 'lose';
          player.payout = 0;
          addLog(state, player.username, 'result', `perd $${player.bet} (dealer BJ)`);
        } else if (playerBlackjack && dealerBlackjack) {
          player.result = 'push';
          player.payout = player.bet;
          addLog(state, player.username, 'result', 'égalité (double BJ)');
        } else if (dealerBusted) {
          player.result = 'win';
          player.payout = player.bet * 2;
          hasWon = true;
          addLog(state, player.username, 'result', `gagne $${player.bet} (dealer bust)`);
        } else if (player.value > dealerValue) {
          player.result = 'win';
          player.payout = player.bet * 2;
          hasWon = true;
          addLog(state, player.username, 'result', `gagne $${player.bet}`);
        } else if (player.value < dealerValue) {
          player.result = 'lose';
          player.payout = 0;
          addLog(state, player.username, 'result', `perd $${player.bet}`);
        } else {
          player.result = 'push';
          player.payout = player.bet;
          addLog(state, player.username, 'result', 'égalité (push)');
        }
      }
    }
    
    // Update player balance and stats
    const isWin = hasWon || player.result === 'win' || player.result === 'blackjack';
    const isLoss = player.result === 'lose';
    const isBJ = hasBJ || player.result === 'blackjack';
    
    // Calculate net gain/loss (including insurance)
    const netResult = player.payout - totalBet;
    
    await prisma.user.update({
      where: { id: player.oderId },
      data: {
        balance: { increment: player.payout },
        gamesPlayed: { increment: 1 },
        gamesWon: { increment: isWin ? 1 : 0 },
        totalWinnings: { increment: isWin ? netResult : 0 },
        totalLosses: { increment: isLoss ? totalBet : 0 },
        blackjackCount: { increment: isBJ ? 1 : 0 },
        currentStreak: isWin ? { increment: 1 } : 0,
        bestStreak: isWin ? { increment: 0 } : { increment: 0 },
      },
    });
    
    // Update best streak separately
    if (isWin) {
      const userData = await prisma.user.findUnique({
        where: { id: player.oderId },
        select: { currentStreak: true, bestStreak: true },
      });
      if (userData && userData.currentStreak > userData.bestStreak) {
        await prisma.user.update({
          where: { id: player.oderId },
          data: { bestStreak: userData.currentStreak },
        });
      }
    }
    
    player.balance += player.payout;
    
    // Ajouter à l'historique du joueur (5 dernières parties)
    if (!player.history) player.history = [];
    player.history.push({
      round: state.currentRound,
      result: player.result,
      payout: netResult, // Net gain/loss
    });
    // Garder seulement les 5 dernières
    if (player.history.length > 5) {
      player.history = player.history.slice(-5);
    }
    
    // Save to game history
    await prisma.gameHistory.create({
      data: {
        oderId: player.oderId,
        gameId: state.tableId,
        round: state.currentRound,
        bet: totalBet,
        result: player.result,
        payout: player.payout,
        playerCards: JSON.stringify(player.isSplit ? player.splitHands : player.cards),
        dealerCards: JSON.stringify(state.dealer.cards),
        playerValue: player.isSplit ? null : player.value,
        dealerValue: state.dealer.value,
      },
    });
  }
  
  broadcastTableState(tableId);
  
  // After settlement delay, start new betting round
  setTableTimer(tableId, SETTLEMENT_DELAY, async () => {
    await transitionToPhase(tableId, 'betting');
  });
}

// ============ PLAYER ACTIONS ============

async function handlePlayerBet(tableId, oderId, amount) {
  const state = activeTables.get(tableId);
  if (!state || state.phase !== 'betting') {
    return { error: 'Impossible de miser maintenant' };
  }
  
  const player = state.players.find(p => p.oderId === oderId);
  if (!player) {
    return { error: 'Joueur non trouvé' };
  }
  
  if (player.hasBet) {
    return { error: 'Vous avez déjà misé' };
  }
  
  if (amount < state.minBet || amount > state.maxBet) {
    return { error: `Mise entre $${state.minBet} et $${state.maxBet}` };
  }
  
  if (amount > player.balance) {
    return { error: 'Solde insuffisant' };
  }
  
  // Deduct bet
  await prisma.user.update({
    where: { id: oderId },
    data: { balance: { decrement: amount } },
  });
  
  player.bet = amount;
  player.hasBet = true;
  player.balance -= amount;
  player.isSittingOut = false;
  
  addLog(state, player.username, 'bet', `mise $${amount}`);
  broadcastTableState(tableId);
  
  // Check if all players have bet
  const allBet = state.players.every(p => p.hasBet);
  if (allBet) {
    clearTableTimer(tableId);
    await transitionToPhase(tableId, 'dealing');
  }
  
  return { success: true };
}

async function handlePlayerHit(tableId, oderId) {
  const state = activeTables.get(tableId);
  if (!state || state.phase !== 'player_turn') {
    return { error: "Ce n'est pas le moment de jouer" };
  }
  
  const activePlayers = getActivePlayersForRound(state);
  const currentPlayer = activePlayers[state.currentPlayerIndex];
  
  if (!currentPlayer || currentPlayer.oderId !== oderId) {
    return { error: "Ce n'est pas votre tour" };
  }
  
  // Handle split hands
  if (currentPlayer.isSplit && currentPlayer.splitHands) {
    const handIndex = currentPlayer.currentSplitHandIndex || 0;
    const currentHand = currentPlayer.splitHands[handIndex];
    
    if (!currentHand || currentHand.isStanding || currentHand.isBusted) {
      return { error: 'Cette main ne peut plus jouer' };
    }
    
    // Draw card for split hand
    const card = state.shoe.shift();
    currentHand.cards.push(card);
    currentHand.value = computeHandValue(currentHand.cards);
    currentHand.isBusted = isBusted(currentHand.value);
    
    addLog(state, currentPlayer.username, 'hit', `Main ${handIndex + 1}: tire ${card.rank}${getSuitSymbol(card.suit)} (${currentHand.value})`);
    
    if (currentHand.isBusted) {
      addLog(state, currentPlayer.username, 'bust', `Main ${handIndex + 1}: BUST ! (${currentHand.value})`);
    }
    
    clearTableTimer(tableId);
    
    // Check if this hand is done
    if (currentHand.isBusted || currentHand.value === 21) {
      currentHand.isStanding = true;
      // Move to next split hand or next player
      const nextHandIndex = handIndex + 1;
      if (nextHandIndex < currentPlayer.splitHands.length) {
        const nextHand = currentPlayer.splitHands[nextHandIndex];
        if (!nextHand.isStanding && !nextHand.isBusted) {
          currentPlayer.currentSplitHandIndex = nextHandIndex;
          addLog(state, currentPlayer.username, 'split', `Passage à la main ${nextHandIndex + 1}`);
          state.turnEndTime = Date.now() + TURN_TIMEOUT;
          setTableTimer(tableId, TURN_TIMEOUT, async () => {
            await handleTurnTimeout(tableId);
          });
          broadcastTableState(tableId);
          return { success: true };
        }
      }
      // All split hands done, move to next player
      broadcastTableState(tableId);
      await moveToNextPlayer(tableId);
    } else {
      // Reset turn timer
      state.turnEndTime = Date.now() + TURN_TIMEOUT;
      setTableTimer(tableId, TURN_TIMEOUT, async () => {
        await handleTurnTimeout(tableId);
      });
      broadcastTableState(tableId);
    }
    
    return { success: true };
  }
  
  // Normal (non-split) hit
  if (currentPlayer.isStanding || currentPlayer.isBusted) {
    return { error: 'Vous ne pouvez plus jouer' };
  }
  
  // Draw card
  const card = state.shoe.shift();
  currentPlayer.cards.push(card);
  currentPlayer.value = computeHandValue(currentPlayer.cards);
  currentPlayer.isBusted = isBusted(currentPlayer.value);
  
  addLog(state, currentPlayer.username, 'hit', `tire ${card.rank}${getSuitSymbol(card.suit)} (${currentPlayer.value})`);
  
  if (currentPlayer.isBusted) {
    addLog(state, currentPlayer.username, 'bust', `BUST ! (${currentPlayer.value})`);
    currentPlayer.result = 'lose';
  }
  
  clearTableTimer(tableId);
  broadcastTableState(tableId);
  
  if (currentPlayer.isBusted || currentPlayer.value === 21) {
    await moveToNextPlayer(tableId);
  } else {
    // Reset turn timer
    state.turnEndTime = Date.now() + TURN_TIMEOUT;
    setTableTimer(tableId, TURN_TIMEOUT, async () => {
      await handleTurnTimeout(tableId);
    });
    broadcastTableState(tableId);
  }
  
  return { success: true };
}

async function handlePlayerStand(tableId, oderId) {
  const state = activeTables.get(tableId);
  if (!state || state.phase !== 'player_turn') {
    return { error: "Ce n'est pas le moment de jouer" };
  }
  
  const activePlayers = getActivePlayersForRound(state);
  const currentPlayer = activePlayers[state.currentPlayerIndex];
  
  if (!currentPlayer || currentPlayer.oderId !== oderId) {
    return { error: "Ce n'est pas votre tour" };
  }
  
  // Handle split hands
  if (currentPlayer.isSplit && currentPlayer.splitHands) {
    const handIndex = currentPlayer.currentSplitHandIndex || 0;
    const currentHand = currentPlayer.splitHands[handIndex];
    
    if (!currentHand || currentHand.isStanding || currentHand.isBusted) {
      return { error: 'Cette main ne peut plus jouer' };
    }
    
    currentHand.isStanding = true;
    addLog(state, currentPlayer.username, 'stand', `Main ${handIndex + 1}: reste à ${currentHand.value}`);
    
    clearTableTimer(tableId);
    
    // Move to next split hand or next player
    const nextHandIndex = handIndex + 1;
    if (nextHandIndex < currentPlayer.splitHands.length) {
      const nextHand = currentPlayer.splitHands[nextHandIndex];
      if (!nextHand.isStanding && !nextHand.isBusted) {
        currentPlayer.currentSplitHandIndex = nextHandIndex;
        addLog(state, currentPlayer.username, 'split', `Passage à la main ${nextHandIndex + 1}`);
        state.turnEndTime = Date.now() + TURN_TIMEOUT;
        setTableTimer(tableId, TURN_TIMEOUT, async () => {
          await handleTurnTimeout(tableId);
        });
        broadcastTableState(tableId);
        return { success: true };
      }
    }
    
    // All split hands done, move to next player
    broadcastTableState(tableId);
    await moveToNextPlayer(tableId);
    return { success: true };
  }
  
  // Normal (non-split) stand
  if (currentPlayer.isStanding || currentPlayer.isBusted) {
    return { error: 'Vous ne pouvez plus jouer' };
  }
  
  currentPlayer.isStanding = true;
  addLog(state, currentPlayer.username, 'stand', `reste à ${currentPlayer.value}`);
  
  clearTableTimer(tableId);
  broadcastTableState(tableId);
  
  await moveToNextPlayer(tableId);
  
  return { success: true };
}

async function handlePlayerDouble(tableId, oderId) {
  const state = activeTables.get(tableId);
  if (!state || state.phase !== 'player_turn') {
    return { error: "Ce n'est pas le moment de jouer" };
  }
  
  const activePlayers = getActivePlayersForRound(state);
  const currentPlayer = activePlayers[state.currentPlayerIndex];
  
  if (!currentPlayer || currentPlayer.oderId !== oderId) {
    return { error: "Ce n'est pas votre tour" };
  }
  
  if (currentPlayer.cards.length !== 2) {
    return { error: 'Vous ne pouvez doubler qu\'avec 2 cartes' };
  }
  
  if (currentPlayer.hasDoubled) {
    return { error: 'Vous avez déjà doublé' };
  }
  
  if (currentPlayer.bet > currentPlayer.balance) {
    return { error: 'Solde insuffisant pour doubler' };
  }
  
  // Double the bet
  const doubleAmount = currentPlayer.bet;
  await prisma.user.update({
    where: { id: oderId },
    data: { balance: { decrement: doubleAmount } },
  });
  
  currentPlayer.bet += doubleAmount;
  currentPlayer.balance -= doubleAmount;
  currentPlayer.hasDoubled = true;
  
  // Draw one card and stand
  const card = state.shoe.shift();
  currentPlayer.cards.push(card);
  currentPlayer.value = computeHandValue(currentPlayer.cards);
  currentPlayer.isBusted = isBusted(currentPlayer.value);
  currentPlayer.isStanding = true;
  
  addLog(state, currentPlayer.username, 'double', `double sa mise et tire ${card.rank}${getSuitSymbol(card.suit)} (${currentPlayer.value})`);
  
  if (currentPlayer.isBusted) {
    addLog(state, currentPlayer.username, 'bust', `BUST ! (${currentPlayer.value})`);
    currentPlayer.result = 'lose';
  }
  
  clearTableTimer(tableId);
  broadcastTableState(tableId);
  await moveToNextPlayer(tableId);
  
  return { success: true };
}

async function handlePlayerSplit(tableId, oderId) {
  const state = activeTables.get(tableId);
  if (!state || state.phase !== 'player_turn') {
    return { error: "Ce n'est pas le moment de jouer" };
  }
  
  const activePlayers = getActivePlayersForRound(state);
  const currentPlayer = activePlayers[state.currentPlayerIndex];
  
  if (!currentPlayer || currentPlayer.oderId !== oderId) {
    return { error: "Ce n'est pas votre tour" };
  }
  
  if (currentPlayer.cards.length !== 2) {
    return { error: 'Vous ne pouvez split qu\'avec 2 cartes' };
  }
  
  if (currentPlayer.cards[0].rank !== currentPlayer.cards[1].rank) {
    return { error: 'Les cartes doivent être identiques pour split' };
  }
  
  if (currentPlayer.isSplit) {
    return { error: 'Vous avez déjà fait split' };
  }
  
  if (currentPlayer.bet > currentPlayer.balance) {
    return { error: 'Solde insuffisant pour split' };
  }
  
  // Create split hands from the two cards
  const card1 = currentPlayer.cards[0];
  const card2 = currentPlayer.cards[1];
  
  // Deduct second bet
  await prisma.user.update({
    where: { id: oderId },
    data: { balance: { decrement: currentPlayer.bet } },
  });
  
  currentPlayer.balance -= currentPlayer.bet;
  
  // First hand - gets one card automatically
  const card1New = state.shoe.shift();
  const hand1 = {
    cards: [card1, card1New],
    value: computeHandValue([card1, card1New]),
    bet: currentPlayer.bet,
    isBusted: false,
    isStanding: false,
    result: null,
    payout: 0,
  };
  hand1.isBusted = isBusted(hand1.value);
  
  // Second hand - gets one card automatically
  const card2New = state.shoe.shift();
  const hand2 = {
    cards: [card2, card2New],
    value: computeHandValue([card2, card2New]),
    bet: currentPlayer.bet,
    isBusted: false,
    isStanding: false,
    result: null,
    payout: 0,
  };
  hand2.isBusted = isBusted(hand2.value);
  
  currentPlayer.splitHands = [hand1, hand2];
  currentPlayer.isSplit = true;
  currentPlayer.currentSplitHandIndex = 0; // Start playing first hand
  // Keep the original bet for settlement tracking
  currentPlayer.originalBet = currentPlayer.bet;
  
  addLog(state, currentPlayer.username, 'split', `sépare en 2 mains (${card1.rank} + ${card1New.rank} | ${card2.rank} + ${card2New.rank})`);
  
  // Check for 21 on first hand
  if (hand1.value === 21) {
    hand1.isStanding = true;
    addLog(state, currentPlayer.username, '21', '21 sur la main 1 !');
    // Move to second hand if first is done
    if (!hand2.isStanding && !hand2.isBusted) {
      currentPlayer.currentSplitHandIndex = 1;
    }
  }
  
  // Reset turn timer
  clearTableTimer(tableId);
  state.turnEndTime = Date.now() + TURN_TIMEOUT;
  setTableTimer(tableId, TURN_TIMEOUT, async () => {
    await handleTurnTimeout(tableId);
  });
  
  broadcastTableState(tableId);
  
  return { success: true };
}

async function handlePlayerInsurance(tableId, oderId, takeInsurance) {
  const state = activeTables.get(tableId);
  if (!state) {
    return { error: 'Table non trouvée' };
  }
  
  // Must be in insurance phase
  if (state.phase !== 'insurance') {
    return { error: 'Ce n\'est pas le moment de prendre une assurance' };
  }
  
  // Insurance phase happens right after dealing if dealer has Ace
  if (state.dealer.cards.length < 1 || state.dealer.cards[0].rank !== 'A') {
    return { error: 'Le croupier n\'a pas un As visible' };
  }
  
  const player = state.players.find(p => p.oderId === oderId);
  if (!player) {
    return { error: 'Joueur non trouvé' };
  }
  
  // Already decided?
  if (player.insuranceDecided) {
    return { error: 'Vous avez déjà décidé pour l\'assurance' };
  }
  
  player.insuranceDecided = true;
  
  if (takeInsurance) {
    const insuranceAmount = Math.floor(player.bet / 2);
    if (insuranceAmount > player.balance) {
      return { error: 'Solde insuffisant pour l\'assurance' };
    }
    
    await prisma.user.update({
      where: { id: oderId },
      data: { balance: { decrement: insuranceAmount } },
    });
    
    player.insuranceBet = insuranceAmount;
    player.balance -= insuranceAmount;
    addLog(state, player.username, 'insurance', `prend une assurance de $${insuranceAmount}`);
  } else {
    player.insuranceBet = 0;
    addLog(state, player.username, 'insurance', 'refuse l\'assurance');
  }
  
  broadcastTableState(tableId);
  
  // Check if all players have decided
  const activePlayers = getActivePlayersForRound(state);
  const allDecided = activePlayers.every(p => p.insuranceDecided);
  
  if (allDecided) {
    // Cancel timer and process immediately
    clearTableTimer(tableId);
    await processInsuranceResult(tableId);
  }
  
  return { success: true };
}

async function processInsuranceResult(tableId) {
  const state = activeTables.get(tableId);
  if (!state) return;
  
  const activePlayers = getActivePlayersForRound(state);
  const dealerBlackjack = isBlackjack(state.dealer.cards);
  
  if (dealerBlackjack) {
    addLog(state, null, 'dealer_blackjack', 'Le croupier a un BLACKJACK !');
    // Pay insurance bets (2:1)
    for (const player of activePlayers) {
      if (player.insuranceBet > 0) {
        const insurancePayout = player.insuranceBet * 3; // Returns bet + 2:1
        await prisma.user.update({
          where: { id: player.oderId },
          data: { balance: { increment: insurancePayout } },
        });
        player.balance += insurancePayout;
        addLog(state, player.username, 'insurance_win', `gagne $${player.insuranceBet * 2} d'assurance`);
      }
    }
    // Go to settlement
    await transitionToPhase(tableId, 'settlement');
  } else {
    // Insurance bets are lost
    for (const player of activePlayers) {
      if (player.insuranceBet > 0) {
        addLog(state, player.username, 'insurance_lose', `perd $${player.insuranceBet} d'assurance`);
      }
    }
    // Continue to player turns
    await transitionToPhase(tableId, 'player_turn');
  }
}

// ============ UTILITIES ============

function getSuitSymbol(suit) {
  const symbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  return symbols[suit] || '';
}

function addLog(state, player, action, details) {
  state.actionLog.push({
    timestamp: Date.now(),
    player,
    action,
    details,
  });
  // Keep only last 20 logs
  if (state.actionLog.length > 20) {
    state.actionLog.shift();
  }
}

function setTableTimer(tableId, delay, callback) {
  clearTableTimer(tableId);
  timers.set(tableId, setTimeout(callback, delay));
}

function clearTableTimer(tableId) {
  const timer = timers.get(tableId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(tableId);
  }
}

// ============ BROADCAST ============

function broadcastPresence() {
  const users = Array.from(connectedUsers.values()).map(u => ({
    oderId: u.oderId,
    username: u.username,
  }));
  io.to('presence').emit('presence:update', users);
}

async function broadcastPublicTables() {
  try {
    const tables = await prisma.game.findMany({
      where: { 
        visibility: 'public',
        isOpen: true,
        phase: { in: ['lobby', 'betting', 'dealing', 'player_turn', 'dealer_turn', 'settlement'] },
      },
      include: {
        host: { select: { username: true } },
        players: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    
    const tableList = tables.map(t => ({
      id: t.id,
      name: t.name,
      hostUsername: t.host.username,
      playerCount: t.players.length,
      maxPlayers: t.maxPlayers,
      minBet: t.minBet,
      maxBet: t.maxBet,
      phase: t.phase,
    }));
    
    io.to('lobby').emit('tables:list', tableList);
  } catch (error) {
    console.error('Error broadcasting tables:', error);
  }
}

function broadcastTableState(tableId) {
  const state = activeTables.get(tableId);
  if (!state) {
    console.log(`⚠️ broadcastTableState: no state for table ${tableId}`);
    return;
  }
  console.log(`📢 Broadcasting state for table ${tableId}, phase: ${state.phase}, players: ${state.players.length}`);
  
  const activePlayers = getActivePlayersForRound(state);
  const currentPlayer = activePlayers[state.currentPlayerIndex];
  const currentPlayerId = currentPlayer?.oderId || null;
  
  // Dealer cards: hide second card during player_turn
  const showDealerHole = ['dealer_turn', 'settlement'].includes(state.phase);
  const dealerCards = state.dealer.cards.map((card, i) => {
    if (i === 1 && !showDealerHole) {
      return { hidden: true };
    }
    return card;
  });
  
  const clientState = {
    tableId: state.tableId,
    name: state.name,
    phase: state.phase,
    currentRound: state.currentRound,
    minBet: state.minBet,
    maxBet: state.maxBet,
    maxPlayers: state.maxPlayers,
    hostId: state.hostId,
    bettingEndTime: state.bettingEndTime,
    turnEndTime: state.turnEndTime,
    dealer: {
      cards: dealerCards,
      value: showDealerHole ? state.dealer.value : null,
      isBusted: state.dealer.isBusted,
    },
    players: state.players.map(p => ({
      oderId: p.oderId,
      username: p.username,
      seatIndex: p.seatIndex,
      cards: p.cards,
      value: p.value,
      bet: p.bet,
      insuranceBet: p.insuranceBet || 0,
      isBusted: p.isBusted,
      isStanding: p.isStanding,
      isSittingOut: p.isSittingOut,
      hasBlackjack: p.hasBlackjack,
      hasBet: p.hasBet,
      hasDoubled: p.hasDoubled || false,
      canSplit: p.canSplit || false,
      isSplit: p.isSplit || false,
      splitHands: p.splitHands || [],
      currentSplitHandIndex: p.currentSplitHandIndex || 0,
      result: p.result,
      payout: p.payout,
      balance: p.balance,
      isCurrentTurn: p.oderId === currentPlayerId,
    })),
    currentPlayerId,
    actionLog: state.actionLog.slice(-10),
    // Historique du croupier (5 derniers)
    dealerHistory: (state.dealerHistory || []).slice(-5),
  };
  
  // Send to all in table room
  const room = io.sockets.adapter.rooms.get(`table:${tableId}`);
  if (!room) return;
  
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket || !socket.user) continue;
    
    const viewingUserId = socket.user.userId;
    const player = state.players.find(p => p.oderId === viewingUserId);
    const myPlayer = clientState.players.find(p => p.oderId === viewingUserId);
    
    // Historique du joueur (5 derniers)
    const playerHistory = player?.history?.slice(-5) || [];
    
    socket.emit('table:state', {
      ...clientState,
      isMyTurn: currentPlayerId === viewingUserId,
      myPlayer,
      isHost: state.hostId === viewingUserId,
      playerHistory,
    });
  }
}

async function cleanupTable(tableId) {
  clearTableTimer(tableId);
  activeTables.delete(tableId);
  
  try {
    await prisma.game.update({
      where: { id: tableId },
      data: { isOpen: false, endedAt: new Date() },
    });
  } catch (error) {
    console.error('Error closing table:', error);
  }
  
  io.to(`table:${tableId}`).emit('table:closed', { message: 'La table a été fermée' });
  broadcastPublicTables();
}

// ============ SOCKET.IO HANDLERS ============

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  io = new SocketIOServer(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    
    const payload = verifyToken(token);
    if (!payload) return next(new Error('Invalid token'));
    
    socket.user = payload;
    next();
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`✅ ${user.username} connected`);
    
    // Get user balance
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { balance: true },
    });
    
    connectedUsers.set(user.userId, {
      oderId: user.userId,
      username: user.username,
      socketId: socket.id,
      currentTableId: null,
      balance: dbUser?.balance || 0,
    });
    
    socket.join('presence');
    socket.join('lobby');
    broadcastPresence();
    broadcastPublicTables();
    
    // ========== LOBBY EVENTS ==========
    
    socket.on('tables:refresh', () => {
      broadcastPublicTables();
    });
    
    // ========== TABLE EVENTS ==========
    
    socket.on('table:join', async (tableId) => {
      try {
        console.log(`📥 ${user.username} trying to join table:`, tableId);
        
        const existingTable = connectedUsers.get(user.userId)?.currentTableId;
        if (existingTable && existingTable !== tableId) {
          console.log(`❌ ${user.username} already on another table:`, existingTable);
          socket.emit('table:error', 'Vous êtes déjà sur une autre table');
          return;
        }
        
        socket.join(`table:${tableId}`);
      
      let state = activeTables.get(tableId);
      
      if (!state) {
        // Load from DB
        console.log(`📂 Loading table ${tableId} from database...`);
        const game = await prisma.game.findUnique({
          where: { id: tableId },
          include: {
            host: { select: { id: true, username: true } },
            players: {
              include: { user: { select: { id: true, username: true, balance: true } } },
            },
          },
        });
        
        if (!game) {
          console.log(`❌ Table ${tableId} not found in database`);
          socket.emit('table:error', 'Table non trouvée');
          return;
        }
        console.log(`✅ Loaded table ${tableId}: ${game.name}, ${game.players.length} players`);
        
        state = createTableState(tableId, game.hostUserId, {
          name: game.name,
          visibility: game.visibility,
          minBet: game.minBet,
          maxBet: game.maxBet,
          maxPlayers: game.maxPlayers,
        });
        
        // Restore players
        for (const gp of game.players) {
          addPlayerToTable(state, gp.oderId, gp.user.username, gp.user.balance);
        }
        
        activeTables.set(tableId, state);
      }
      
      // Add player if not already at table
      const existingPlayer = state.players.find(p => p.oderId === user.userId);
      if (!existingPlayer && state.players.length < state.maxPlayers) {
        const userData = connectedUsers.get(user.userId);
        const newPlayer = addPlayerToTable(state, user.userId, user.username, userData?.balance || 0);
        
        if (newPlayer) {
          // Save to DB
          await prisma.gamePlayer.upsert({
            where: {
              gameId_oderId: { gameId: tableId, oderId: user.userId },
            },
            update: {},
            create: {
              gameId: tableId,
              oderId: user.userId,
              seatIndex: newPlayer.seatIndex,
            },
          });
          
          addLog(state, user.username, 'join', 'rejoint la table');
        }
      }
      
      // Update user's current table
      const connUser = connectedUsers.get(user.userId);
      if (connUser) {
        connUser.currentTableId = tableId;
      }
      
      broadcastTableState(tableId);
      broadcastPublicTables();
      } catch (error) {
        console.error(`❌ Error in table:join for ${user.username}:`, error);
        socket.emit('table:error', 'Erreur lors de la connexion à la table');
      }
    });
    
    socket.on('table:leave', async (tableId) => {
      console.log(`🚪 ${user.username} demande à quitter la table ${tableId}`);
      const state = activeTables.get(tableId);
      if (!state) {
        console.log(`❌ Table ${tableId} non trouvée`);
        return;
      }
      
      const player = state.players.find(p => p.oderId === user.userId);
      
      // Phases où on ne peut pas quitter (sauf hôte ou settlement)
      if (['dealing', 'player_turn', 'dealer_turn'].includes(state.phase)) {
        if (state.hostId === user.userId) {
          // Host leaving closes table
          addLog(state, user.username, 'leave', 'quitte la table (hôte)');
          await cleanupTable(tableId);
          return;
        } else {
          // Marquer comme sitting out pour le reste de la manche
          if (player) {
            player.isSittingOut = true;
            player.isStanding = true;
            addLog(state, user.username, 'leave', 'se met en attente');
          }
          socket.emit('table:error', 'Vous serez retiré à la fin de la manche');
          broadcastTableState(tableId);
          return;
        }
      }
      
      // Pendant settlement, on peut quitter immédiatement
      // Pendant lobby et betting aussi
      
      removePlayerFromTable(state, user.userId);
      
      await prisma.gamePlayer.deleteMany({
        where: { gameId: tableId, oderId: user.userId },
      });
      
      addLog(state, user.username, 'leave', 'quitte la table');
      console.log(`✅ ${user.username} a quitté la table ${tableId}`);
      
      socket.leave(`table:${tableId}`);
      
      const connUser = connectedUsers.get(user.userId);
      if (connUser) {
        connUser.currentTableId = null;
      }
      
      // If host leaves, close table
      if (state.hostId === user.userId) {
        await cleanupTable(tableId);
      } else if (state.players.length === 0) {
        await cleanupTable(tableId);
      } else {
        broadcastTableState(tableId);
        broadcastPublicTables();
      }
    });
    
    socket.on('table:delete', async (tableId) => {
      const state = activeTables.get(tableId);
      if (!state) {
        socket.emit('table:error', 'Table non trouvée');
        return;
      }
      
      // Only host can delete, or anyone if table is empty
      const isHost = state.hostId === user.userId;
      const playerCount = state.players.length;
      
      if (!isHost && playerCount > 0) {
        socket.emit('table:error', 'Seul l\'hôte peut supprimer la table');
        return;
      }
      
      // Can't delete if game is in progress
      if (state.phase !== 'lobby') {
        socket.emit('table:error', 'Impossible de supprimer une table en cours de jeu');
        return;
      }
      
      // Delete from database
      try {
        await prisma.game.delete({
          where: { id: tableId },
        });
        
        // Cleanup in-memory state
        await cleanupTable(tableId);
        
        // Notify all players
        io.to(`table:${tableId}`).emit('table:closed', { message: 'La table a été supprimée' });
      } catch (error) {
        console.error('Error deleting table:', error);
        socket.emit('table:error', 'Erreur lors de la suppression');
      }
    });
    
    socket.on('table:start', async (tableId) => {
      const state = activeTables.get(tableId);
      if (!state) {
        socket.emit('table:error', 'Table non trouvée');
        return;
      }
      
      if (state.hostId !== user.userId) {
        socket.emit('table:error', "Seul l'hôte peut lancer la partie");
        return;
      }
      
      if (state.phase !== 'lobby') {
        socket.emit('table:error', 'La partie a déjà commencé');
        return;
      }
      
      if (state.players.length < 1) {
        socket.emit('table:error', 'Pas de joueurs');
        return;
      }
      
      await prisma.game.update({
        where: { id: tableId },
        data: { startedAt: new Date() },
      });
      
      addLog(state, user.username, 'start', 'lance la partie');
      await transitionToPhase(tableId, 'betting');
    });
    
    socket.on('table:bet', async ({ tableId, amount }) => {
      const result = await handlePlayerBet(tableId, user.userId, amount);
      if (result.error) {
        socket.emit('table:error', result.error);
      }
    });
    
    socket.on('table:hit', async (tableId) => {
      const result = await handlePlayerHit(tableId, user.userId);
      if (result.error) {
        socket.emit('table:error', result.error);
      }
    });
    
    socket.on('table:stand', async (tableId) => {
      const result = await handlePlayerStand(tableId, user.userId);
      if (result.error) {
        socket.emit('table:error', result.error);
      }
    });
    
    socket.on('table:double', async (tableId) => {
      const result = await handlePlayerDouble(tableId, user.userId);
      if (result.error) {
        socket.emit('table:error', result.error);
      }
    });
    
    socket.on('table:split', async (tableId) => {
      const result = await handlePlayerSplit(tableId, user.userId);
      if (result.error) {
        socket.emit('table:error', result.error);
      }
    });
    
    socket.on('table:insurance', async ({ tableId, takeInsurance }) => {
      const result = await handlePlayerInsurance(tableId, user.userId, takeInsurance);
      if (result.error) {
        socket.emit('table:error', result.error);
      }
    });
    
    socket.on('table:close', async (tableId) => {
      const state = activeTables.get(tableId);
      if (!state) return;
      
      if (state.hostId !== user.userId) {
        socket.emit('table:error', "Seul l'hôte peut fermer la table");
        return;
      }
      
      await cleanupTable(tableId);
    });
    
    // ========== DISCONNECT ==========
    
    socket.on('disconnect', async () => {
      console.log(`❌ ${user.username} disconnected`);
      
      const connUser = connectedUsers.get(user.userId);
      const tableId = connUser?.currentTableId;
      
      connectedUsers.delete(user.userId);
      broadcastPresence();
      
      // Note: We don't remove them from table on disconnect
      // This allows reconnection. They'll be marked as sitting out if they don't bet.
    });
  });

  httpServer.listen(port, hostname, () => {
    const displayHost = hostname === '0.0.0.0' ? 'localhost' : hostname;
    console.log(`> Ready on http://${displayHost}:${port}`);
    console.log(`> Socket.IO ready`);
    if (process.env.NODE_ENV === 'production') {
      console.log(`> Production mode: listening on 0.0.0.0:${port}`);
    }
  });
});
