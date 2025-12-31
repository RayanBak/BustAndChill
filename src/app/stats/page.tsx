'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Stats {
  gamesPlayed: number;
  gamesWon: number;
  totalWinnings: number;
  totalLosses: number;
  blackjackCount: number;
  bestStreak: number;
  currentStreak: number;
  balance: number;
  winRate: number;
  netProfit: number;
}

interface HistoryEntry {
  id: string;
  gameName: string;
  round: number;
  bet: number;
  result: string;
  payout: number;
  playerValue: number;
  dealerValue: number;
  createdAt: string;
}

function StatsContent() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setHistory(data.history);
      }
    } catch {
      console.error('Error fetching stats');
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

  if (!stats) return null;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-base-300 via-base-100 to-base-300 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">📊 Mes Statistiques</h1>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body text-center py-4">
              <div className="text-2xl">🎮</div>
              <p className="text-sm text-base-content/60">Parties</p>
              <p className="text-2xl font-bold">{stats.gamesPlayed}</p>
            </div>
          </div>
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body text-center py-4">
              <div className="text-2xl">🏆</div>
              <p className="text-sm text-base-content/60">Victoires</p>
              <p className="text-2xl font-bold text-success">{stats.gamesWon}</p>
              <p className="text-xs text-base-content/40">{stats.winRate}%</p>
            </div>
          </div>
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body text-center py-4">
              <div className="text-2xl">💰</div>
              <p className="text-sm text-base-content/60">Gains nets</p>
              <p className={`text-2xl font-bold ${stats.netProfit >= 0 ? 'text-success' : 'text-error'}`}>
                {stats.netProfit >= 0 ? '+' : ''}{stats.netProfit}$
              </p>
            </div>
          </div>
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body text-center py-4">
              <div className="text-2xl">🃏</div>
              <p className="text-sm text-base-content/60">Blackjacks</p>
              <p className="text-2xl font-bold text-warning">{stats.blackjackCount}</p>
            </div>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">📈 Performance</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Taux de victoire</span>
                    <span className="font-bold">{stats.winRate}%</span>
                  </div>
                  <progress className="progress progress-success" value={stats.winRate} max="100"></progress>
                </div>
                <div className="flex justify-between">
                  <span>Gains totaux</span>
                  <span className="font-bold text-success">+${stats.totalWinnings}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pertes totales</span>
                  <span className="font-bold text-error">-${stats.totalLosses}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <h2 className="card-title">🔥 Séries</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Série actuelle</span>
                  <span className="badge badge-lg badge-primary">{stats.currentStreak}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Meilleure série</span>
                  <span className="badge badge-lg badge-warning">{stats.bestStreak}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Solde actuel</span>
                  <span className="badge badge-lg badge-success">${stats.balance}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">📜 Historique des parties</h2>
            
            {history.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-base-content/60">Aucune partie jouée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Table</th>
                      <th>Round</th>
                      <th>Mise</th>
                      <th>Résultat</th>
                      <th>Score</th>
                      <th>Gains</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="text-sm">{new Date(h.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td>{h.gameName}</td>
                        <td>#{h.round}</td>
                        <td>${h.bet}</td>
                        <td>
                          <span className={`badge badge-sm ${
                            h.result === 'win' || h.result === 'blackjack' ? 'badge-success' :
                            h.result === 'push' ? 'badge-warning' : 'badge-error'
                          }`}>
                            {h.result === 'blackjack' ? 'BJ!' : h.result.toUpperCase()}
                          </span>
                        </td>
                        <td className="text-sm">{h.playerValue} vs {h.dealerValue}</td>
                        <td className={h.payout > h.bet ? 'text-success font-bold' : h.payout < h.bet ? 'text-error' : ''}>
                          {h.payout > 0 ? `+$${h.payout}` : '-$' + h.bet}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StatsPage() {
  return (
    <ProtectedRoute>
      <StatsContent />
    </ProtectedRoute>
  );
}

