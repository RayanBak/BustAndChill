'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuthContext } from '@/hooks/useAuth';
import { useSocket, usePresence, usePublicTables, type PublicTable } from '@/hooks/useSocket';

function DashboardContent() {
  const { user, refreshUser } = useAuthContext();
  const { socket, isConnected, connect } = useSocket();
  const { connectedUsers } = usePresence(socket);
  const { tables, refresh: refreshTables } = usePublicTables(socket);
  const router = useRouter();

  const [joinTableId, setJoinTableId] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create table settings
  const [tableName, setTableName] = useState('Ma Table');
  const [tableVisibility, setTableVisibility] = useState<'public' | 'private'>('public');
  const [tableMaxPlayers, setTableMaxPlayers] = useState(5);
  const [tableMinBet, setTableMinBet] = useState(10);
  const [tableMaxBet, setTableMaxBet] = useState(500);

  // Connect to socket
  useEffect(() => {
    if (user && !socket && user.id) {
      connect();
    }
  }, [user?.id]);
  
  // Refresh user data
  useEffect(() => {
    refreshUser();
  }, []);

  const handleCreateTable = async () => {
    setError('');
    setIsCreating(true);

    try {
      const response = await fetch('/api/games/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tableName,
          visibility: tableVisibility,
          maxPlayers: tableMaxPlayers,
          minBet: tableMinBet,
          maxBet: tableMaxBet,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Si table privée, afficher le code avant de rediriger
        if (tableVisibility === 'private') {
          setError(''); // Clear any previous errors
          // Afficher le code dans une alerte ou modal
          const shareUrl = `${window.location.origin}/table/${data.tableId}`;
          const code = data.tableId;
          
          // Créer un modal pour afficher le code
          const modal = document.createElement('div');
          modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
          modal.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          modal.innerHTML = `
            <div class="bg-slate-800 rounded-2xl p-8 max-w-md w-full border-2 border-amber-500/50">
              <h3 class="text-2xl font-bold text-white mb-4">🔒 Table privée créée !</h3>
              <p class="text-slate-400 mb-4">Partagez ce code avec vos amis :</p>
              <div class="bg-slate-900 rounded-xl p-4 mb-4 border border-amber-500/30">
                <div class="flex items-center justify-between gap-3">
                  <code class="text-amber-400 font-mono text-lg break-all">${code}</code>
                  <button id="copy-btn" class="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg transition-all">
                    📋 Copier
                  </button>
                </div>
              </div>
              <div class="flex gap-3">
                <button id="close-btn" class="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-all">
                  Aller à la table
                </button>
              </div>
            </div>
          `;
          document.body.appendChild(modal);
          
          const copyBtn = modal.querySelector('#copy-btn');
          const closeBtn = modal.querySelector('#close-btn');
          
          copyBtn?.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(code);
              copyBtn.textContent = '✓ Copié !';
              copyBtn.classList.add('bg-emerald-500', 'hover:bg-emerald-400');
              setTimeout(() => {
                copyBtn.textContent = '📋 Copier';
                copyBtn.classList.remove('bg-emerald-500', 'hover:bg-emerald-400');
              }, 2000);
            } catch (err) {
              console.error('Failed to copy:', err);
            }
          });
          
          closeBtn?.addEventListener('click', () => {
            document.body.removeChild(modal);
            router.push(`/table/${data.tableId}`);
          });
          
          // Auto-close after 10 seconds
          setTimeout(() => {
            if (document.body.contains(modal)) {
              document.body.removeChild(modal);
              router.push(`/table/${data.tableId}`);
            }
          }, 10000);
        } else {
          router.push(`/table/${data.tableId}`);
        }
      } else {
        setError(data.error || 'Erreur lors de la création');
        if (data.tableId) {
          router.push(`/table/${data.tableId}`);
        }
      }
    } catch {
      setError('Erreur lors de la création');
    }

    setIsCreating(false);
    setShowCreateModal(false);
  };

  const handleJoinTable = (e: React.FormEvent) => {
    e.preventDefault();
    const tableId = joinTableId.trim();
    if (!tableId) {
      setError('Entrez un ID de table');
      return;
    }
    router.push(`/table/${tableId}`);
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            Bienvenue, <span className="text-amber-400">{user?.username}</span>
          </h1>
          <p className="text-slate-400">
            Créez une table ou rejoignez une partie
          </p>
        </div>

        {error && (
          <div className="max-w-xl mx-auto mb-6 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Balance */}
            <div className="glass-dark rounded-2xl p-6 text-center">
              <p className="text-slate-400 text-sm mb-1">Votre solde</p>
              <p className="text-4xl font-bold text-emerald-400">${user?.balance || 0}</p>
            </div>
            
            {/* Create Table */}
            <button 
              onClick={() => setShowCreateModal(true)}
              className="w-full btn-gold py-4 rounded-xl text-lg font-bold"
            >
              Créer une table
            </button>

            {/* Join by ID */}
            <div className="glass-dark rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">Rejoindre par ID</h3>
              <form onSubmit={handleJoinTable} className="space-y-3">
                <input
                  type="text"
                  value={joinTableId}
                  onChange={(e) => setJoinTableId(e.target.value)}
                  placeholder="ID de la table..."
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
                />
                <button
                  type="submit"
                  className="w-full py-3 glass rounded-xl text-white font-medium hover:bg-white/20 transition-all"
                  disabled={!joinTableId.trim()}
                >
                  Rejoindre
                </button>
              </form>
            </div>

            {/* Online Users */}
            <div className="glass-dark rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">En ligne</h3>
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                  {connectedUsers.length}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`}></div>
                <span className="text-xs text-slate-400">
                  {isConnected ? 'Connecté' : 'Connexion...'}
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {connectedUsers.map((u) => (
                  <div
                    key={u.oderId}
                    className={`flex items-center gap-3 p-2 rounded-lg ${u.oderId === user?.id ? 'bg-amber-500/10' : ''}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{u.username.charAt(0).toUpperCase()}</span>
                    </div>
                    <span className="text-sm text-white truncate">
                      {u.username}
                      {u.oderId === user?.id && <span className="text-amber-400 ml-1">(vous)</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content - Tables */}
          <div className="lg:col-span-3">
            <div className="glass-dark rounded-2xl p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Tables publiques</h2>
                <button 
                  onClick={refreshTables} 
                  className="px-4 py-2 glass rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all"
                >
                  Actualiser
                </button>
              </div>

              {tables.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-700/50 flex items-center justify-center">
                    <span className="text-4xl">🎰</span>
                  </div>
                  <p className="text-slate-400 mb-6">Aucune table disponible</p>
                  <button 
                    onClick={() => setShowCreateModal(true)} 
                    className="btn-gold px-8 py-3 rounded-xl"
                  >
                    Créer la première table
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tables.map((table) => (
                    <div 
                      key={table.id}
                      className="flex items-center justify-between p-4 glass rounded-xl hover:bg-white/5 transition-all"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-white font-semibold">{table.name}</h3>
                          <PhaseLabel phase={table.phase} />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-400">
                          <span>Hôte: {table.hostUsername}</span>
                          <span>•</span>
                          <span>{table.playerCount}/{table.maxPlayers} joueurs</span>
                          <span>•</span>
                          <span>${table.minBet} - ${table.maxBet}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => router.push(`/table/${table.id}`)}
                        className={`px-6 py-2 rounded-lg font-medium transition-all ${
                          table.playerCount >= table.maxPlayers 
                            ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
                            : 'btn-gold'
                        }`}
                        disabled={table.playerCount >= table.maxPlayers}
                      >
                        {table.playerCount >= table.maxPlayers ? 'Complet' : 'Rejoindre'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Table Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowCreateModal(false)}></div>
          <div className="relative glass-dark rounded-2xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-6">Créer une table</h3>
            
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Nom de la table</label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:border-amber-400/50"
                  maxLength={50}
                />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Visibilité</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTableVisibility('public')}
                    className={`p-3 rounded-xl border transition-all ${
                      tableVisibility === 'public' 
                        ? 'border-amber-400 bg-amber-400/10 text-amber-400' 
                        : 'border-slate-600/50 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    🌍 Publique
                  </button>
                  <button
                    type="button"
                    onClick={() => setTableVisibility('private')}
                    className={`p-3 rounded-xl border transition-all ${
                      tableVisibility === 'private' 
                        ? 'border-amber-400 bg-amber-400/10 text-amber-400' 
                        : 'border-slate-600/50 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    🔒 Privée
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-2">Joueurs max: {tableMaxPlayers}</label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={tableMaxPlayers}
                  onChange={(e) => setTableMaxPlayers(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  {[1,2,3,4,5].map(n => <span key={n}>{n}</span>)}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Mise min ($)</label>
                  <input
                    type="number"
                    value={tableMinBet}
                    onChange={(e) => setTableMinBet(parseInt(e.target.value) || 10)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:border-amber-400/50"
                    min={1}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Mise max ($)</label>
                  <input
                    type="number"
                    value={tableMaxBet}
                    onChange={(e) => setTableMaxBet(parseInt(e.target.value) || 500)}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600/50 rounded-xl text-white focus:outline-none focus:border-amber-400/50"
                    min={tableMinBet}
                  />
                </div>
              </div>
            </div>
            
            <div className="flex gap-3 mt-8">
              <button 
                onClick={() => setShowCreateModal(false)} 
                className="flex-1 py-3 glass rounded-xl text-white font-medium hover:bg-white/10 transition-all"
              >
                Annuler
              </button>
              <button 
                onClick={handleCreateTable} 
                className="flex-1 btn-gold py-3 rounded-xl font-bold"
                disabled={isCreating}
              >
                {isCreating ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PhaseLabel({ phase }: { phase: string }) {
  const labels: Record<string, { text: string; color: string }> = {
    lobby: { text: 'Lobby', color: 'bg-blue-500/20 text-blue-400' },
    betting: { text: 'Mises', color: 'bg-amber-500/20 text-amber-400' },
    dealing: { text: 'Distribution', color: 'bg-purple-500/20 text-purple-400' },
    player_turn: { text: 'En jeu', color: 'bg-emerald-500/20 text-emerald-400' },
    dealer_turn: { text: 'Croupier', color: 'bg-orange-500/20 text-orange-400' },
    settlement: { text: 'Résultats', color: 'bg-slate-500/20 text-slate-400' },
  };
  
  const label = labels[phase] || { text: phase, color: 'bg-slate-500/20 text-slate-400' };
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${label.color}`}>
      {label.text}
    </span>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
