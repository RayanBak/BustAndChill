'use client';

interface Card {
  suit: string;
  rank: string;
  value: number;
}

interface PlayingCardProps {
  card: Card | { hidden: boolean };
  className?: string;
  animationDelay?: number;
  small?: boolean;
}

const suitSymbols: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const suitColors: Record<string, string> = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  clubs: 'text-slate-800',
  spades: 'text-slate-800',
};

export function PlayingCard({ card, className = '', animationDelay = 0, small = false }: PlayingCardProps) {
  const isHidden = 'hidden' in card && card.hidden;
  
  const width = small ? 50 : 65;
  const height = small ? 72 : 92;

  if (isHidden) {
    return (
      <div
        className={`card-animate rounded-lg shadow-lg ${className}`}
        style={{
          animationDelay: `${animationDelay}ms`,
          width: `${width}px`,
          height: `${height}px`,
          background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #1e3a8a 100%)',
          border: '2px solid rgba(96, 165, 250, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div 
          className="w-full h-full rounded-md flex items-center justify-center"
          style={{
            background: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.03) 5px, rgba(255,255,255,0.03) 10px)',
          }}
        >
          <span className="text-blue-300 text-xl font-bold opacity-60">♠</span>
        </div>
      </div>
    );
  }

  const { suit, rank } = card as Card;
  const symbol = suitSymbols[suit] || '?';
  const colorClass = suitColors[suit] || 'text-slate-800';

  return (
    <div
      className={`card-animate bg-white rounded-lg shadow-lg ${className}`}
      style={{
        animationDelay: `${animationDelay}ms`,
        width: `${width}px`,
        height: `${height}px`,
        padding: small ? '3px 4px' : '4px 6px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        border: '1px solid #e2e8f0',
      }}
    >
      <div className={`${small ? 'text-xs' : 'text-sm'} font-bold ${colorClass}`}>
        {rank}
        <span className="ml-0.5">{symbol}</span>
      </div>
      <div className={`${small ? 'text-xl' : 'text-2xl'} text-center ${colorClass}`}>
        {symbol}
      </div>
      <div className={`${small ? 'text-xs' : 'text-sm'} font-bold text-right transform rotate-180 ${colorClass}`}>
        {rank}
        <span className="ml-0.5">{symbol}</span>
      </div>
    </div>
  );
}

export function CardHand({
  cards,
  showValue,
  totalValue,
}: {
  cards: Array<Card | { hidden: boolean }>;
  showValue?: boolean;
  totalValue?: number | null;
}) {
  return (
    <div className="inline-flex items-center">
      <div className="flex -space-x-6">
        {cards.map((card, index) => (
          <PlayingCard
            key={index}
            card={card}
            animationDelay={index * 100}
            className="hover:-translate-y-1 transition-transform"
          />
        ))}
      </div>
      {showValue && totalValue !== null && totalValue !== undefined && (
        <span className="ml-3 px-3 py-1 bg-slate-800 text-white text-sm font-bold rounded-full">
          {totalValue}
        </span>
      )}
    </div>
  );
}
