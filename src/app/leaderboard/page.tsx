'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  avatarUrl: string | null;
  totalWinnings?: number;
  gamesPlayed?: number;
  gamesWon?: number;
  winRate?: number;
  blackjackCount?: number;
}

function LeaderboardContent() {
  const [topWinners, setTopWinners] = useState<LeaderboardEntry[]>([]);
  const [topWinRate, setTopWinRate] = useState<LeaderboardEntry[]>([]);
  const [topBlackjacks, setTopBlackjacks] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'winnings' | 'winrate' | 'blackjacks'>('winnings');

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (data.success) {
        setTopWinners(data.topWinners);
        setTopWinRate(data.topWinRate);
        setTopBlackjacks(data.topBlackjacks);
        setMyRank(data.myRank);
      }
    } catch {
      console.error('Error fetching leaderboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const renderTable = (entries: LeaderboardEntry[], valueKey: string, valueLabel: string) => (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Rang</th>
            <th>Joueur</th>
            <th>{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className={entry.rank <= 3 ? 'bg-base-200' : ''}>
              <td>
                <span className="text-xl">{getRankEmoji(entry.rank)}</span>
              </td>
              <td>
                <Link href={`/user/${entry.username}`} className="flex items-center gap-2 hover:text-primary">
                  <div className="avatar placeholder">
                    <div className="bg-neutral text-neutral-content rounded-full w-8">
                      <span className="text-xs">{entry.username.charAt(0).toUpperCase()}</span>
                    </div>
                  </div>
                  <span className="font-medium">{entry.username}</span>
                </Link>
              </td>
              <td>
                <span className="font-bold text-primary">
                  {valueKey === 'totalWinnings' && `$${entry.totalWinnings}`}
                  {valueKey === 'winRate' && `${entry.winRate}%`}
                  {valueKey === 'blackjackCount' && entry.blackjackCount}
                </span>
                {valueKey === 'winRate' && entry.gamesPlayed && (
                  <span className="text-xs text-base-content/50 ml-2">({entry.gamesPlayed} parties)</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {entries.length === 0 && (
        <div className="text-center py-8 text-base-content/60">
          Pas encore de données
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-base-300 via-base-100 to-base-300 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-center">🏆 Classement</h1>
        
        {myRank && (
          <div className="text-center mb-8">
            <span className="badge badge-lg badge-primary">Votre rang: #{myRank}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs tabs-boxed justify-center mb-6">
          <button 
            className={`tab ${activeTab === 'winnings' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('winnings')}
          >
            💰 Gains
          </button>
          <button 
            className={`tab ${activeTab === 'winrate' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('winrate')}
          >
            📈 Win Rate
          </button>
          <button 
            className={`tab ${activeTab === 'blackjacks' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('blackjacks')}
          >
            🃏 Blackjacks
          </button>
        </div>

        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            {activeTab === 'winnings' && renderTable(topWinners, 'totalWinnings', 'Gains totaux')}
            {activeTab === 'winrate' && renderTable(topWinRate, 'winRate', 'Taux de victoire')}
            {activeTab === 'blackjacks' && renderTable(topBlackjacks, 'blackjackCount', 'Blackjacks')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <ProtectedRoute>
      <LeaderboardContent />
    </ProtectedRoute>
  );
}

