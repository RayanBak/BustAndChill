'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface UserProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  gamesPlayed: number;
  gamesWon: number;
  totalWinnings: number;
  blackjackCount: number;
  bestStreak: number;
  createdAt: string;
}

function UserProfileContent() {
  const params = useParams();
  const username = params.username as string;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [isMe, setIsMe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/profile/${username}`);
      const data = await res.json();
      
      if (data.success) {
        setProfile(data.user);
        setFriendshipStatus(data.friendshipStatus);
        setIsMe(data.isMe);
      } else {
        setError(data.error || 'Utilisateur non trouvé');
      }
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      
      const data = await res.json();
      if (data.success) {
        setFriendshipStatus('pending');
      }
    } catch {
      // Ignore
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body text-center">
            <div className="text-4xl mb-4">😕</div>
            <h2 className="text-xl font-bold">Utilisateur non trouvé</h2>
            <p className="text-base-content/60">{error}</p>
            <Link href="/dashboard" className="btn btn-primary mt-4">Retour</Link>
          </div>
        </div>
      </div>
    );
  }

  const winRate = profile.gamesPlayed > 0 
    ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) 
    : 0;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-base-300 via-base-100 to-base-300 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="avatar placeholder">
                <div className="bg-primary text-primary-content rounded-full w-20">
                  <span className="text-3xl">{profile.username.charAt(0).toUpperCase()}</span>
                </div>
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{profile.username}</h1>
                {profile.bio && (
                  <p className="text-base-content/60 italic">"{profile.bio}"</p>
                )}
                <p className="text-xs text-base-content/40">
                  Membre depuis {new Date(profile.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              
              {/* Actions */}
              {!isMe && (
                <div>
                  {friendshipStatus === 'accepted' ? (
                    <span className="badge badge-success">✓ Ami</span>
                  ) : friendshipStatus === 'pending' ? (
                    <span className="badge badge-warning">En attente</span>
                  ) : (
                    <button 
                      onClick={sendFriendRequest}
                      className="btn btn-primary btn-sm"
                      disabled={actionLoading}
                    >
                      {actionLoading ? <span className="loading loading-spinner loading-xs"></span> : '+ Ajouter'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="divider"></div>

            {/* Stats */}
            <h2 className="font-bold mb-4">📊 Statistiques</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="text-center p-3 bg-base-300 rounded-lg">
                <div className="text-2xl font-bold text-primary">{profile.gamesPlayed}</div>
                <div className="text-xs text-base-content/60">Parties</div>
              </div>
              <div className="text-center p-3 bg-base-300 rounded-lg">
                <div className="text-2xl font-bold text-success">{profile.gamesWon}</div>
                <div className="text-xs text-base-content/60">Victoires ({winRate}%)</div>
              </div>
              <div className="text-center p-3 bg-base-300 rounded-lg">
                <div className="text-2xl font-bold text-warning">${profile.totalWinnings}</div>
                <div className="text-xs text-base-content/60">Gains totaux</div>
              </div>
              <div className="text-center p-3 bg-base-300 rounded-lg">
                <div className="text-2xl font-bold text-accent">{profile.blackjackCount}</div>
                <div className="text-xs text-base-content/60">Blackjacks</div>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center p-3 bg-base-300 rounded-lg">
              <span>🔥 Meilleure série</span>
              <span className="font-bold">{profile.bestStreak} victoires</span>
            </div>

            {isMe && (
              <Link href="/profile" className="btn btn-outline mt-6 w-full">
                ✏️ Modifier mon profil
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UserProfilePage() {
  return (
    <ProtectedRoute>
      <UserProfileContent />
    </ProtectedRoute>
  );
}

