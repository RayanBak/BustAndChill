'use client';

import { useState } from 'react';

const CHIPS = [
  { value: 5, color: 'bg-red-500', border: 'border-red-300' },
  { value: 10, color: 'bg-blue-500', border: 'border-blue-300' },
  { value: 25, color: 'bg-green-500', border: 'border-green-300' },
  { value: 50, color: 'bg-purple-500', border: 'border-purple-300' },
  { value: 100, color: 'bg-amber-500', border: 'border-amber-300' },
  { value: 500, color: 'bg-slate-800', border: 'border-slate-500' },
];

interface ChipSelectorProps {
  minBet: number;
  maxBet: number;
  balance: number;
  currentBet: number;
  onBetChange: (amount: number) => void;
  onConfirm: (amount: number) => void;
}

export function ChipSelector({
  minBet,
  maxBet,
  balance,
  currentBet,
  onBetChange,
  onConfirm,
}: ChipSelectorProps) {
  const [selectedChip, setSelectedChip] = useState<number | null>(null);
  
  const availableChips = CHIPS.filter(chip => chip.value <= balance);

  const handleChipClick = (value: number) => {
    setSelectedChip(value);
    const newBet = Math.min(currentBet + value, Math.min(maxBet, balance));
    onBetChange(newBet);
  };

  const handleClear = () => {
    setSelectedChip(null);
    onBetChange(0);
  };

  const canConfirm = currentBet >= minBet && currentBet <= maxBet && currentBet <= balance;

  return (
    <div className="space-y-6">
      {/* Affichage de la mise */}
      <div className="text-center">
        <div className="inline-block glass-dark rounded-2xl px-10 py-6">
          <p className="text-amber-400/80 text-sm font-medium mb-1">Votre mise</p>
          <p className="text-white text-5xl font-bold tracking-tight">${currentBet}</p>
          <p className="text-slate-400 text-sm mt-2">Solde: ${balance}</p>
        </div>
      </div>

      {/* Jetons */}
      <div className="flex flex-wrap gap-4 justify-center">
        {availableChips.map((chip) => (
          <button
            key={chip.value}
            onClick={() => handleChipClick(chip.value)}
            className={`
              chip w-16 h-16 ${chip.color} border-4 ${chip.border}
              flex items-center justify-center
              ${selectedChip === chip.value ? 'selected' : ''}
            `}
          >
            <span className="text-white font-bold text-sm drop-shadow-md">
              ${chip.value}
            </span>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-center">
        <button
          onClick={handleClear}
          className="px-6 py-3 glass rounded-xl text-white font-medium hover:bg-white/20 transition-all"
        >
          Effacer
        </button>
        <button
          onClick={() => canConfirm && onConfirm(currentBet)}
          disabled={!canConfirm}
          className={`
            px-10 py-3 rounded-xl font-bold text-lg transition-all
            ${canConfirm 
              ? 'btn-gold' 
              : 'bg-slate-600 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          Miser ${currentBet}
        </button>
      </div>

      {/* Mises rapides */}
      <div className="flex gap-2 justify-center flex-wrap">
        {[minBet, minBet * 2, minBet * 5, Math.floor(balance / 2), balance]
          .filter((v, i, a) => v >= minBet && v <= maxBet && v <= balance && a.indexOf(v) === i)
          .slice(0, 4)
          .map((amount) => (
            <button
              key={amount}
              onClick={() => {
                onBetChange(amount);
                setSelectedChip(null);
              }}
              className="px-4 py-2 glass rounded-lg text-white/80 text-sm hover:bg-white/20 transition-all"
            >
              ${amount}
            </button>
          ))}
      </div>
    </div>
  );
}
