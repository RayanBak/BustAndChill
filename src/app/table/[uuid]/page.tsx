'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuthContext } from '@/hooks/useAuth';
import { useSocket, useTable, type TableState, type PlayerState, type Card, type RoundResult } from '@/hooks/useSocket';

// ============ AUDIO MANAGER ============
class AudioManager {
  private static instance: AudioManager;
  private audioContext: AudioContext | null = null;
  
  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }
  
  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return this.audioContext;
  }
  
  playCardSound() {
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Card flip sound - quick noise burst
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // Ignore audio errors
    }
  }
  
  playChipSound() {
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.1);
    } catch (e) {
      // Ignore audio errors
    }
  }
  
  playWinSound() {
    try {
      const ctx = this.getContext();
      [0, 0.1, 0.2].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 400 + i * 200;
        gain.gain.setValueAtTime(0.1, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.2);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.2);
      });
    } catch (e) {
      // Ignore audio errors
    }
  }
}

const audio = typeof window !== 'undefined' ? AudioManager.getInstance() : null;

// ============ JETONS ============
const CHIPS = [
  { value: 1, color: '#ffffff', border: '#d1d5db', text: '#1f2937' },
  { value: 5, color: '#dc2626', border: '#f87171', text: '#ffffff' },
  { value: 10, color: '#2563eb', border: '#60a5fa', text: '#ffffff' },
  { value: 25, color: '#16a34a', border: '#4ade80', text: '#ffffff' },
  { value: 50, color: '#7c3aed', border: '#a78bfa', text: '#ffffff' },
  { value: 100, color: '#ea580c', border: '#fb923c', text: '#ffffff' },
  { value: 500, color: '#0f172a', border: '#475569', text: '#ffffff' },
];

function Chip({ value, onClick, disabled, size = 'md' }: { 
  value: number; 
  onClick?: () => void; 
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const chip = CHIPS.find(c => c.value === value) || CHIPS[0];
  const sizes = { sm: 40, md: 52, lg: 64 };
  const s = sizes[size];
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        rounded-full flex items-center justify-center font-bold
        transition-all duration-150 select-none
        ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:scale-110 hover:-translate-y-1 active:scale-95'}
      `}
      style={{
        width: s, height: s,
        background: `linear-gradient(145deg, ${chip.border} 0%, ${chip.color} 30%, ${chip.color} 70%, ${chip.border} 100%)`,
        border: `3px solid ${chip.border}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2)',
        color: chip.text,
        fontSize: size === 'sm' ? 9 : size === 'md' ? 11 : 13,
      }}
    >
      ${value}
    </button>
  );
}

// ============ CARTE À JOUER ============
function PlayingCard({ 
  card, 
  small = false,
  delay = 0,
  animate = false,
}: { 
  card: Card | { hidden: boolean }; 
  small?: boolean;
  delay?: number;
  animate?: boolean;
}) {
  const soundPlayedRef = useRef<Set<string>>(new Set());
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  useEffect(() => {
    if (animate && delay >= 0) {
      // Jouer le son avec un délai
      const soundTimer = setTimeout(() => {
        const cardKey = `${JSON.stringify(card)}-${delay}`;
        if (!soundPlayedRef.current.has(cardKey)) {
          audio?.playCardSound();
          soundPlayedRef.current.add(cardKey);
        }
      }, delay);
      
      return () => clearTimeout(soundTimer);
    }
  }, [animate, delay, card]);
  
  const isHidden = 'hidden' in card && card.hidden;
  // Ajuster la taille selon l'écran
  const actualSmall = small || isMobile;
  const w = actualSmall ? 32 : 52;
  const h = actualSmall ? 48 : 74;
  
  const suits: Record<string, { symbol: string; color: string }> = {
    hearts: { symbol: '♥', color: '#dc2626' },
    diamonds: { symbol: '♦', color: '#dc2626' },
    clubs: { symbol: '♣', color: '#1f2937' },
    spades: { symbol: '♠', color: '#1f2937' },
  };

  // Carte cachée (dos)
  if (isHidden) {
    return (
      <div
        className="rounded-lg flex items-center justify-center transition-all duration-300"
        style={{
          width: w, height: h,
          background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #1e40af 100%)',
          border: '2px solid #60a5fa',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        <span className="text-white/40 text-lg">♠</span>
      </div>
    );
  }

  // Carte visible - TOUJOURS afficher, avec animation optionnelle
  const { suit, rank } = card as Card;
  const s = suits[suit] || { symbol: '?', color: '#1f2937' };

  // Stabiliser l'animation : une fois qu'elle est jouée, on garde l'état
  const [hasAnimated, setHasAnimated] = useState(false);
  
  useEffect(() => {
    if (animate && delay >= 0 && !hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
      }, delay + 700); // Après la fin de l'animation
      return () => clearTimeout(timer);
    }
  }, [animate, delay, hasAnimated]);

  return (
    <div
      className="rounded-lg bg-white flex flex-col justify-between shadow-lg transition-all duration-300 playing-card"
      style={{
        width: w, height: h,
        padding: actualSmall ? '2px' : '4px',
        border: '1px solid #e5e7eb',
        opacity: 1, // Toujours visible
        animation: (animate && !hasAnimated) ? 'cardDeal 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' : 'none',
        animationDelay: (animate && !hasAnimated) ? `${delay}ms` : '0ms',
        transform: hasAnimated ? 'translateX(0) translateY(0) rotate(0deg) scale(1)' : 'translateX(0) translateY(0) rotate(0deg) scale(1)',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div className="text-left" style={{ color: s.color, fontSize: small ? 9 : 11, fontWeight: 700 }}>
        {rank}<span className="ml-0.5">{s.symbol}</span>
      </div>
      <div className="text-center" style={{ color: s.color, fontSize: small ? 14 : 20 }}>
        {s.symbol}
      </div>
      <div className="text-right rotate-180" style={{ color: s.color, fontSize: small ? 9 : 11, fontWeight: 700 }}>
        {rank}<span className="ml-0.5">{s.symbol}</span>
      </div>
    </div>
  );
}

// ============ HISTORIQUE JOUEUR ============
function PlayerHistory({ history }: { history: RoundResult[] }) {
  if (!history || history.length === 0) return null;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/40 text-[10px] uppercase tracking-wide">Historique</span>
      <div className="flex gap-1">
        {history.slice(-5).map((r, i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md ${
              r.result === 'win' || r.result === 'blackjack' 
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white' 
                : r.result === 'push' 
                  ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black' 
                  : 'bg-gradient-to-br from-red-400 to-red-600 text-white'
            }`}
            title={`Manche ${r.round}: ${r.payout >= 0 ? '+' : ''}${r.payout}$`}
          >
            {r.result === 'win' || r.result === 'blackjack' ? 'G' : r.result === 'push' ? '=' : 'P'}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ HISTORIQUE CROUPIER ============
function DealerHistory({ history }: { history: Array<{ value: number; isBusted: boolean }> }) {
  if (!history || history.length === 0) return null;
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/30 text-[10px] uppercase tracking-wide">Derniers</span>
      <div className="flex gap-1">
        {history.slice(-5).map((h, i) => (
          <div
            key={i}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              h.isBusted 
                ? 'bg-red-500/90 text-white' 
                : h.value === 21 
                  ? 'bg-amber-500/90 text-black' 
                  : 'bg-white/20 text-white/80'
            }`}
            title={h.isBusted ? 'Bust!' : `${h.value} points`}
          >
            {h.value}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ SIÈGE JOUEUR SUR TABLE ============
function PlayerSpot({ 
  player, 
  isMe, 
  currentBet,
  phase,
  isDealing,
}: { 
  player: PlayerState;
  isMe: boolean;
  currentBet: number;
  phase: string;
  isDealing?: boolean;
}) {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  const showCards = !['lobby', 'betting'].includes(phase);
  const showResult = phase === 'settlement';
  const bet = player.hasBet ? player.bet : currentBet;
  const hasSplit = player.isSplit && player.splitHands && player.splitHands.length > 0;
  const currentSplitIndex = player.currentSplitHandIndex || 0;
  
  // Render split hands
  if (hasSplit && player.splitHands) {
    return (
      <div className={`flex flex-col items-center transition-all duration-300 ${
        player.isCurrentTurn ? 'transform scale-105' : ''
      }`}>
        {/* Deux mains split côte à côte */}
        <div className="flex gap-2 mb-2">
          {player.splitHands.map((hand, handIdx) => {
            const isActiveHand = player.isCurrentTurn && handIdx === currentSplitIndex;
            return (
              <div 
                key={handIdx}
                className={`flex flex-col items-center p-2 rounded-lg transition-all ${
                  isActiveHand ? 'bg-amber-500/20 ring-2 ring-amber-400' : 'bg-black/20'
                }`}
              >
                {/* Label de la main */}
                <div className={`text-[9px] font-bold mb-1 ${
                  isActiveHand ? 'text-amber-400' : 'text-white/40'
                }`}>
                  Main {handIdx + 1}
                </div>
                
                {/* Cartes de la main */}
                <div className="flex -space-x-1.5 sm:-space-x-3 mb-1">
                  {hand.cards.map((card, i) => (
                    <PlayingCard 
                      key={`split-${handIdx}-${i}-${card.rank}-${card.suit}`} 
                      card={card} 
                      small={isMobile}
                      animate={false} // Désactiver l'animation pour éviter les bugs
                      delay={0}
                    />
                  ))}
                </div>
                
                {/* Valeur - TOUJOURS afficher */}
                <div className="h-5 flex items-center justify-center">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${
                    hand.isBusted 
                      ? 'bg-red-500 text-white' 
                      : hand.isStanding 
                        ? 'bg-blue-500/80 text-white' 
                        : 'bg-black/50 text-white'
                  }`}>
                    {hand.isBusted ? `💥 ${hand.value}` : hand.value}
                  </span>
                </div>
                
                {/* Résultat */}
                {showResult && hand.result && (
                  <div className={`mt-1 px-2 py-0.5 rounded text-[9px] font-bold ${
                    hand.result === 'win' || hand.result === 'blackjack' 
                      ? 'bg-emerald-500 text-white' 
                      : hand.result === 'push' 
                        ? 'bg-amber-500 text-black' 
                        : 'bg-red-500 text-white'
                  }`}>
                    {hand.result === 'win' ? `+$${hand.payout - hand.bet}` :
                     hand.result === 'push' ? '=' : `-$${hand.bet}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Zone de mise totale */}
        <div 
          className="relative w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)',
            border: '2px solid rgba(251,191,36,0.5)',
          }}
        >
          <span className="text-amber-300 font-bold text-xs">${bet * 2}</span>
        </div>
        
        {/* Nom du joueur */}
        <div className="mt-1 text-center">
          <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
            isMe ? 'bg-emerald-500/20 text-emerald-400' : 'bg-black/30 text-white/70'
          }`}>
            {player.username}{isMe && ' 👤'}
          </div>
        </div>
      </div>
    );
  }
  
  // Render normal hand (no split)
  const hasCards = showCards && player.cards.length > 0;
  
  return (
    <div className={`flex flex-col items-center transition-all duration-300 ${
      player.isCurrentTurn ? 'transform scale-110' : ''
    }`}>
      {/* Cartes du joueur - Toujours afficher si le joueur a des cartes */}
      <div className="min-h-[40px] sm:min-h-[70px] flex items-end justify-center mb-0.5 sm:mb-1">
        {hasCards ? (
          <div className="flex -space-x-1.5 sm:-space-x-4 transform hover:scale-105 transition-transform">
            {player.cards.map((card, i) => (
              <PlayingCard 
                key={`${player.oderId}-card-${i}-${card.rank}-${card.suit}`} 
                card={card} 
                small={isMobile}
                animate={false} // Désactiver l'animation pour éviter les bugs
                delay={0}
              />
            ))}
          </div>
        ) : (
          <div className="w-8 h-12 sm:w-12 sm:h-16 rounded border border-white/10 bg-black/20" />
        )}
      </div>
      
      {/* Badge valeur / status - TOUJOURS afficher si le joueur a des cartes - Optimisé mobile */}
      <div className="h-5 sm:h-7 flex items-center justify-center gap-0.5 sm:gap-1 mb-0.5 sm:mb-1">
        {hasCards && (
          <>
            {/* Valeur principale */}
            <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold shadow-md transition-all ${
              player.hasBlackjack 
                ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-black' 
                : player.isBusted
                  ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                  : player.value === 21 
                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 text-white' 
                    : 'bg-gray-900/80 text-white border border-white/20'
            }`}>
              {player.hasBlackjack ? '✨ BJ!' : player.isBusted ? `💥 ${player.value}` : player.value}
            </span>
            {/* Badge supplémentaire pour status - Masqué sur mobile */}
            {player.isStanding && !player.isBusted && !player.hasBlackjack && (
              <span className="hidden sm:inline-block px-2 py-1 bg-blue-500/80 rounded-full text-[10px] font-bold text-white">STAND</span>
            )}
          </>
        )}
      </div>
      
      {/* Zone de mise avec effet glow - Optimisée pour mobile */}
      <div 
        className={`
          relative w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center
          transition-all duration-300
          ${player.isCurrentTurn ? 'animate-pulse' : ''}
        `}
        style={{
          background: bet > 0 
            ? 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(251,191,36,0.1) 70%, transparent 100%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
          border: bet > 0 ? (isMobile ? '2px solid rgba(251,191,36,0.6)' : '3px solid rgba(251,191,36,0.6)') : '2px dashed rgba(255,255,255,0.15)',
          boxShadow: player.isCurrentTurn 
            ? '0 0 20px rgba(251,191,36,0.5), 0 0 40px rgba(251,191,36,0.2)' 
            : bet > 0 
              ? '0 0 15px rgba(251,191,36,0.2)' 
              : 'none',
        }}
      >
        {/* Indicateur tour actuel */}
        {player.isCurrentTurn && (
          <div className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-3 h-3 sm:w-4 sm:h-4 bg-amber-400 rounded-full animate-ping" />
        )}
        
        {bet > 0 ? (
          <span className="text-amber-300 font-bold text-xs sm:text-sm drop-shadow-lg">${bet}</span>
        ) : (
          <span className="text-white/20 text-[8px] sm:text-[10px]">•••</span>
        )}
      </div>
      
      {/* Nom du joueur - Optimisé mobile */}
      <div className="mt-1 sm:mt-2 text-center">
        <div className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-medium truncate max-w-[80px] sm:max-w-none ${
          isMe 
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
            : 'bg-black/30 text-white/70'
        }`}>
          <span className="truncate block">{player.username}</span>
          {isMe && <span className="ml-0.5">👤</span>}
        </div>
      </div>
      
      {/* Résultat avec animation */}
      {showResult && player.result && (
        <div className={`mt-2 px-4 py-1.5 rounded-full text-xs font-bold shadow-lg animate-bounce ${
          player.result === 'win' || player.result === 'blackjack' 
            ? 'bg-gradient-to-r from-emerald-400 to-emerald-600 text-white' 
            : player.result === 'push' 
              ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-black' 
              : 'bg-gradient-to-r from-red-400 to-red-600 text-white'
        }`}>
          {player.result === 'blackjack' ? '🎉 BLACKJACK!' :
           player.result === 'win' ? `+$${player.payout - player.bet}` :
           player.result === 'push' ? '= Égalité' : `-$${player.bet}`}
        </div>
      )}
    </div>
  );
}

// ============ TABLE PLEIN ÉCRAN ============
function FullscreenTable({
  state,
  timer,
  betAmount,
  setBetAmount,
  onStartGame,
  onBet,
  onHit,
  onStand,
  onDouble,
  onSplit,
  onInsurance,
  onLeave,
}: {
  state: TableState;
  timer: number | null;
  betAmount: number;
  setBetAmount: (v: number) => void;
  onStartGame: () => void;
  onBet: (amount: number) => void;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
  onInsurance: (take: boolean) => void;
  onLeave: () => void;
}) {
  const router = useRouter();
  const myPlayer = state.myPlayer;
  const showDealerCards = !['lobby', 'betting'].includes(state.phase);
  // Toujours afficher la valeur du croupier si disponible (sauf carte cachée)
  const showDealerValue = state.dealer.value !== null && state.dealer.cards.length > 0;
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Vérification stricte : doit être le tour du joueur ET être le joueur actuel
  const canAct = state.phase === 'player_turn' && 
                 state.isMyTurn && 
                 state.currentPlayerId === myPlayer?.oderId &&
                 myPlayer && 
                 !myPlayer.isBusted && 
                 !myPlayer.isStanding &&
                 !myPlayer.hasBlackjack;
  const canDouble = canAct && myPlayer && myPlayer.cards.length === 2 && !myPlayer.hasDoubled && myPlayer.bet <= myPlayer.balance;
  const canSplit = canAct && myPlayer && myPlayer.cards.length === 2 && !myPlayer.isSplit && 
                   myPlayer.cards[0]?.rank === myPlayer.cards[1]?.rank && myPlayer.bet <= myPlayer.balance;
  
  const isBetting = state.phase === 'betting' && myPlayer && !myPlayer.hasBet;
  const isInsurance = state.phase === 'insurance';
  const canLeave = state.phase === 'lobby' || state.phase === 'settlement';
  
  const availableChips = CHIPS.filter(c => c.value <= (myPlayer?.balance || 0));
  
  const addChip = (value: number) => {
    const maxBet = Math.min(state.maxBet, myPlayer?.balance || 0);
    setBetAmount(Math.min(betAmount + value, maxBet));
  };

  return (
    <div className="fixed inset-0 flex flex-col" style={{
      background: 'linear-gradient(180deg, #0c0c0c 0%, #1a1a2e 50%, #0c0c0c 100%)',
    }}>
      {/* Header */}
      <div className="flex-none min-h-[56px] sm:h-14 bg-black/80 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-6 py-2 sm:py-0 border-b border-white/10">
        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
          <button 
            onClick={() => { onLeave(); router.push('/dashboard'); }}
            className={`transition-colors text-xs sm:text-sm ${
              state.phase === 'player_turn' && state.isMyTurn
                ? 'text-white/30 cursor-not-allowed'
                : 'text-white/50 hover:text-white cursor-pointer'
            }`}
            disabled={state.phase === 'player_turn' && state.isMyTurn}
            title={state.phase === 'player_turn' && state.isMyTurn ? 'Terminez votre tour d\'abord' : 'Quitter la table'}
          >
            ← Quitter
          </button>
          <span className="text-white font-semibold text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">{state.name}</span>
          <span className="text-white/40 text-xs sm:text-sm">• Manche {state.currentRound}</span>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-6 flex-wrap">
          {/* Historique joueur - masqué sur très petit écran */}
          {state.playerHistory && state.playerHistory.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-white/40 text-xs">Historique:</span>
              <PlayerHistory history={state.playerHistory} />
            </div>
          )}
          
          {/* Timer */}
          {timer !== null && (
            <div className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold ${
              timer <= 5 ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500 text-black'
            }`}>
              {timer}s
            </div>
          )}
          
          {/* Solde */}
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-xs sm:text-sm">Solde:</span>
            <span className="text-emerald-400 font-bold text-base sm:text-lg">${myPlayer?.balance || 0}</span>
          </div>
        </div>
      </div>

      {/* Zone de jeu - Optimisée pour mobile */}
      <div className="flex-1 flex items-center justify-center p-1 sm:p-4 overflow-hidden min-h-0">
        <div 
          className="relative w-full max-w-4xl rounded-[20px] sm:rounded-[80px]"
          style={{
            aspectRatio: isMobile ? '4/3' : '16/9',
            maxHeight: isMobile ? '60vh' : 'none',
            background: 'radial-gradient(ellipse 100% 80% at 50% 100%, #0d7a41 0%, #0a6235 50%, #074a29 100%)',
            border: isMobile ? '6px solid #4a3423' : '10px solid #4a3423',
            boxShadow: `
              inset 0 0 40px rgba(0,0,0,0.5),
              inset 0 -20px 30px rgba(0,0,0,0.3),
              0 15px 40px rgba(0,0,0,0.8),
              0 0 0 2px #2d1f14,
              0 0 0 4px rgba(212,175,55,0.3)
            `,
          }}
        >
          {/* Ligne de table */}
          <div className="absolute inset-3 sm:inset-6 rounded-[30px] sm:rounded-[60px] pointer-events-none" style={{
            border: '2px solid rgba(212,175,55,0.15)',
          }} />
          
          {/* Zone croupier - Optimisée pour mobile */}
          <div className="absolute top-1 sm:top-8 left-1/2 -translate-x-1/2 flex flex-col items-center z-10">
            <div className="bg-black/40 backdrop-blur-sm px-2 sm:px-6 py-0.5 sm:py-2 rounded-full mb-0.5 sm:mb-3 flex items-center gap-1 sm:gap-4">
              <span className="text-amber-400/80 text-[10px] sm:text-sm font-semibold uppercase tracking-wider">Croupier</span>
              {state.dealerHistory && state.dealerHistory.length > 0 && (
                <div className="hidden sm:block">
                  <DealerHistory history={state.dealerHistory} />
                </div>
              )}
            </div>
            
            {showDealerCards && state.dealer.cards.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="flex -space-x-1.5 sm:-space-x-3 mb-1 sm:mb-3 transform hover:scale-105 transition-transform">
                  {state.dealer.cards.map((card, i) => (
                    <PlayingCard 
                      key={`dealer-${i}-${'hidden' in card ? 'hidden' : `${card.rank}-${card.suit}`}`} 
                      card={card} 
                      small={isMobile}
                      animate={false} // Désactiver l'animation pour éviter les bugs
                      delay={0}
                    />
                  ))}
                </div>
                {/* Toujours afficher la valeur */}
                {(() => {
                  // Calculer la valeur visible (première carte si la deuxième est cachée)
                  let displayValue: number | null = null;
                  let isPartial = false;
                  
                  if (state.dealer.value !== null) {
                    displayValue = state.dealer.value;
                  } else if (state.dealer.cards.length > 0 && state.dealer.cards[0] && !('hidden' in state.dealer.cards[0])) {
                    // Si la deuxième carte est cachée, afficher seulement la valeur de la première
                    const firstCard = state.dealer.cards[0] as Card;
                    displayValue = firstCard.value === 1 ? 11 : Math.min(firstCard.value, 10);
                    isPartial = true;
                  }
                  
                  if (displayValue !== null) {
                    return (
                      <span className={`px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-lg transition-all ${
                        state.dealer.isBusted 
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' 
                          : isPartial
                            ? 'bg-gradient-to-r from-gray-800/70 to-gray-900/70 text-white/90 border border-white/20'
                            : 'bg-gradient-to-r from-gray-800 to-gray-900 text-white border border-white/20'
                      }`}>
                        {state.dealer.isBusted 
                          ? `💥 BUST (${displayValue})` 
                          : isPartial 
                            ? `${displayValue}+` 
                            : displayValue}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : (
              <div className="w-14 h-20 rounded-lg border-2 border-dashed border-white/15 bg-black/20" />
            )}
          </div>
          
          {/* Message central - Optimisé mobile */}
          <div className="absolute top-[35%] sm:top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            {state.phase === 'lobby' && (
              <div className="text-center bg-black/30 backdrop-blur-sm px-4 sm:px-8 py-2 sm:py-4 rounded-xl sm:rounded-2xl">
                <div className="text-white/80 text-base sm:text-xl mb-1 sm:mb-2 font-semibold">En attente des joueurs</div>
                <div className="text-amber-400/80 text-sm sm:text-lg">{state.players.length}/{state.maxPlayers}</div>
              </div>
            )}
            
            {state.phase === 'dealing' && (
              <div className="bg-black/40 backdrop-blur-sm px-4 sm:px-8 py-2 sm:py-4 rounded-xl sm:rounded-2xl">
                <div className="text-white text-sm sm:text-xl font-medium flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                  <span>Distribution...</span>
                </div>
              </div>
            )}
            
            {state.phase === 'dealer_turn' && (
              <div className="bg-black/40 backdrop-blur-sm px-4 sm:px-8 py-2 sm:py-4 rounded-xl sm:rounded-2xl border border-amber-500/30">
                <div className="text-amber-400 text-sm sm:text-xl font-semibold flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                  <span>Tour du croupier</span>
                </div>
              </div>
            )}
            
            {isInsurance && (
              <div 
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 insurance-modal"
                style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
                onClick={(e) => {
                  // Empêcher la fermeture en cliquant sur le fond
                  if (e.target === e.currentTarget) return;
                }}
              >
                <div 
                  className="bg-black/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 text-center border-2 border-amber-500/50 shadow-2xl shadow-amber-500/20 max-w-md w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-4xl mb-3">🛡️</div>
                  <div className="text-amber-400 font-bold text-xl sm:text-2xl mb-3">Assurance ?</div>
                  <div className="text-white/70 text-sm mb-6">
                    Le croupier montre un As<br/>
                    <span className="text-amber-400 font-semibold">Coût: ${myPlayer ? Math.floor(myPlayer.bet / 2) : 0}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                    <button 
                      onClick={() => onInsurance(true)}
                      className="px-6 sm:px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold rounded-xl transition-all shadow-lg transform hover:scale-105 active:scale-95"
                    >
                      ✓ Prendre
                    </button>
                    <button 
                      onClick={() => onInsurance(false)}
                      className="px-6 sm:px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition-all border border-white/20 active:scale-95"
                    >
                      ✗ Refuser
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Joueurs en arc - Optimisé pour mobile */}
          <div className="absolute bottom-1 sm:bottom-6 left-0 right-0">
            <div className={`flex justify-center items-end gap-1 sm:gap-8 px-1 sm:px-12 ${
              isMobile && state.players.length > 3 ? 'overflow-x-auto pb-2' : ''
            }`}>
              {state.players.map((player, idx) => {
                const isMe = player.oderId === myPlayer?.oderId;
                // Sur mobile avec beaucoup de joueurs, on les met en ligne horizontale
                // Sinon, on garde l'arc
                const offset = isMobile && state.players.length > 3 ? 0 : Math.abs(idx - (state.players.length - 1) / 2);
                const yOffset = isMobile && state.players.length > 3 ? 0 : (offset * (isMobile ? 2 : 8));
                
                return (
                  <div 
                    key={player.oderId} 
                    style={{ 
                      marginBottom: yOffset,
                      minWidth: isMobile ? '80px' : 'auto',
                    }}
                    className="transition-all duration-300 flex-shrink-0"
                  >
                    <PlayerSpot
                      player={player}
                      isMe={isMe}
                      currentBet={isMe ? betAmount : 0}
                      phase={state.phase}
                      isDealing={false} // Désactiver l'animation pour éviter les bugs
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Contrôles en bas */}
      <div className="flex-none bg-gradient-to-t from-black via-black/95 to-transparent border-t border-white/5">
        {/* Lobby - Bouton lancer */}
        {state.phase === 'lobby' && (
          <div className="p-6 text-center">
            {state.isHost ? (
              <button
                onClick={onStartGame}
                className="group relative px-12 py-4 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:via-yellow-400 hover:to-amber-400 text-black font-bold text-lg rounded-2xl transition-all shadow-lg shadow-amber-500/40 hover:shadow-amber-500/60 hover:scale-105 active:scale-95"
              >
                <span className="relative z-10 flex items-center gap-2">
                  🚀 Lancer la partie
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-2xl blur opacity-0 group-hover:opacity-50 transition-opacity" />
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 text-white/50">
                <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                En attente que l'hôte lance la partie...
              </div>
            )}
          </div>
        )}
        
        {/* Phase de mise */}
        {isBetting && (
          <div className="p-2 sm:p-4">
            <div className="max-w-3xl mx-auto">
              {/* Mise actuelle */}
              <div className="text-center mb-2 sm:mb-4">
                <span className="text-white/50 text-xs sm:text-sm">Mise: </span>
                <span className="text-2xl sm:text-3xl font-bold text-amber-400">${betAmount}</span>
                <span className="text-white/30 text-xs sm:text-sm ml-1 sm:ml-2 block sm:inline">(min ${state.minBet} • max ${state.maxBet})</span>
              </div>
              
              {/* Jetons */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-4 overflow-x-auto pb-2">
                {availableChips.map((chip) => (
                  <Chip
                    key={chip.value}
                    value={chip.value}
                    size={isMobile ? "md" : "lg"}
                    onClick={() => addChip(chip.value)}
                    disabled={betAmount + chip.value > (myPlayer?.balance || 0)}
                  />
                ))}
              </div>
              
              {/* Actions */}
              <div className="flex justify-center gap-2 sm:gap-4">
                <button
                  onClick={() => setBetAmount(0)}
                  className="px-4 sm:px-8 py-2 sm:py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium text-sm sm:text-base transition-all"
                >
                  Effacer
                </button>
                <button
                  onClick={() => onBet(betAmount)}
                  disabled={betAmount < state.minBet}
                  className={`px-6 sm:px-10 py-2 sm:py-3 rounded-xl font-bold text-sm sm:text-lg transition-all ${
                    betAmount >= state.minBet 
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                      : 'bg-white/10 text-white/30 cursor-not-allowed'
                  }`}
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Mise confirmée */}
        {state.phase === 'betting' && myPlayer?.hasBet && (
          <div className="p-4 text-center">
            <span className="text-emerald-400 font-medium">✓ Mise de ${myPlayer.bet} confirmée</span>
            <span className="text-white/40 ml-2">• En attente...</span>
          </div>
        )}
        
        {/* Actions de jeu */}
        {canAct && (
          <div className="p-4">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
              <button
                onClick={() => {
                  if (!canAct) return;
                  onHit();
                }}
                disabled={!canAct}
                className="px-6 py-2.5 sm:px-10 sm:py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm sm:text-lg transition-all shadow-lg shadow-emerald-500/30"
              >
                🃏 Tirer
              </button>
              <button
                onClick={() => {
                  if (!canAct) return;
                  onStand();
                }}
                disabled={!canAct}
                className="px-6 py-2.5 sm:px-10 sm:py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm sm:text-lg transition-all shadow-lg shadow-red-500/30"
              >
                ✋ Rester
              </button>
              {canDouble && (
                <button
                  onClick={() => {
                    if (!canAct) return;
                    onDouble();
                  }}
                  disabled={!canAct}
                  className="px-6 py-2.5 sm:px-8 sm:py-3 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg shadow-purple-500/30"
                >
                  ⬆️ Doubler
                </button>
              )}
              {canSplit && (
                <button
                  onClick={() => {
                    if (!canAct) return;
                    onSplit();
                  }}
                  disabled={!canAct}
                  className="px-6 py-2.5 sm:px-8 sm:py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm sm:text-base transition-all shadow-lg shadow-blue-500/30"
                >
                  ✂️ Séparer
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* En attente du tour */}
        {state.phase === 'player_turn' && !state.isMyTurn && myPlayer && !myPlayer.isBusted && !myPlayer.isStanding && (
          <div className="p-4 text-center">
            <span className="text-white/50">En attente de votre tour...</span>
          </div>
        )}
        
        {/* Bust */}
        {state.phase === 'player_turn' && myPlayer?.isBusted && (
          <div className="p-4 text-center">
            <span className="text-red-400 font-bold">💥 Vous avez dépassé 21 !</span>
          </div>
        )}
        
        {/* Settlement */}
        {state.phase === 'settlement' && (
          <div className="p-4 text-center">
            <div className="mb-4">
              <span className="text-white/50">Prochaine manche dans quelques secondes...</span>
            </div>
            <button
              onClick={() => { onLeave(); router.push('/dashboard'); }}
              className="px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-red-500/30 hover:scale-105"
            >
              🚪 Quitter la table
            </button>
          </div>
        )}
        
        {/* Insurance phase - message si pas de modal */}
        {state.phase === 'insurance' && (
          <div className="p-4 text-center">
            <span className="text-amber-400">Décidez si vous voulez prendre l'assurance</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ COMPOSANT PRINCIPAL ============
function TableContent() {
  const params = useParams();
  const tableId = params.uuid as string;
  const router = useRouter();
  const { user } = useAuthContext();
  const { socket, isConnected, connect } = useSocket();
  const { 
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
  } = useTable(socket, tableId);
  
  const [betAmount, setBetAmount] = useState(0);

  // Connexion socket
  useEffect(() => {
    if (user?.id && !socket) {
      connect();
    }
  }, [user?.id]);
  
  // Reset bet quand nouvelle phase de mise
  useEffect(() => {
    if (tableState?.phase === 'betting') {
      setBetAmount(0);
    }
  }, [tableState?.phase]);

  // Table fermée
  if (tableClosed) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6">👋</div>
          <h2 className="text-2xl font-bold text-white mb-2">Table fermée</h2>
          <p className="text-white/50 mb-6">{tableClosed}</p>
          <Link href="/dashboard" className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-all">
            Retour
          </Link>
        </div>
      </div>
    );
  }

  // Chargement
  if (!user || !socket || !isConnected || !tableState) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/50">
            {!user ? 'Chargement...' : !socket || !isConnected ? 'Connexion...' : 'Chargement de la table...'}
          </p>
          {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-red-500 text-white rounded-xl shadow-2xl">
          {error}
        </div>
      )}
      
      <FullscreenTable
        state={tableState}
        timer={timer}
        betAmount={betAmount}
        setBetAmount={setBetAmount}
        onStartGame={startGame}
        onBet={placeBet}
        onHit={hit}
        onStand={stand}
        onDouble={double}
        onSplit={split}
        onInsurance={insurance}
        onLeave={leaveTable}
      />
    </>
  );
}

export default function TablePage() {
  return (
    <ProtectedRoute>
      <TableContent />
    </ProtectedRoute>
  );
}
