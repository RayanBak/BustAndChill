'use client';

import { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuthContext } from '@/hooks/useAuth';

interface ProfileData {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  balance: number;
  gamesPlayed: number;
  gamesWon: number;
  totalWinnings: number;
  totalLosses: number;
  blackjackCount: number;
  bestStreak: number;
  currentStreak: number;
  createdAt: string;
}

function ProfileContent() {
  const { refreshUser } = useAuthContext();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Edit form
  const [editData, setEditData] = useState({
    firstname: '',
    lastname: '',
    username: '',
    bio: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (data.success) {
        setProfile(data.user);
        setEditData({
          firstname: data.user.firstname,
          lastname: data.user.lastname,
          username: data.user.username,
          bio: data.user.bio || '',
        });
      }
    } catch (err) {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSuccess('Profil mis à jour !');
        setEditing(false);
        await fetchProfile();
        await refreshUser();
      } else {
        setError(data.error || 'Erreur');
      }
    } catch {
      setError('Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!profile) return null;

  const winRate = profile.gamesPlayed > 0 
    ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100) 
    : 0;
  const netProfit = profile.totalWinnings - profile.totalLosses;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-base-300 via-base-100 to-base-300 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">👤 Mon Profil</h1>

        {error && <div className="alert alert-error mb-4">{error}</div>}
        {success && <div className="alert alert-success mb-4">{success}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Card */}
          <div className="card bg-base-200 shadow-xl">
            <div className="card-body">
              <div className="flex items-center gap-4 mb-4">
                <div className="avatar placeholder">
                  <div className="bg-primary text-primary-content rounded-full w-20">
                    <span className="text-3xl">{profile.username.charAt(0).toUpperCase()}</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{profile.username}</h2>
                  <p className="text-base-content/60">{profile.firstname} {profile.lastname}</p>
                  <p className="text-xs text-base-content/40">{profile.email}</p>
                </div>
              </div>

              {profile.bio && (
                <p className="text-base-content/80 mb-4 italic">"{profile.bio}"</p>
              )}

              <div className="divider"></div>

              {editing ? (
                <div className="space-y-3">
                  <div className="form-control">
                    <label className="label"><span className="label-text">Prénom</span></label>
                    <input
                      type="text"
                      value={editData.firstname}
                      onChange={(e) => setEditData({ ...editData, firstname: e.target.value })}
                      className="input input-bordered"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label"><span className="label-text">Nom</span></label>
                    <input
                      type="text"
                      value={editData.lastname}
                      onChange={(e) => setEditData({ ...editData, lastname: e.target.value })}
                      className="input input-bordered"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label"><span className="label-text">Pseudo</span></label>
                    <input
                      type="text"
                      value={editData.username}
                      onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                      className="input input-bordered"
                    />
                  </div>
                  <div className="form-control">
                    <label className="label"><span className="label-text">Bio</span></label>
                    <textarea
                      value={editData.bio}
                      onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                      className="textarea textarea-bordered"
                      rows={3}
                      maxLength={200}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(false)} className="btn btn-ghost flex-1">Annuler</button>
                    <button onClick={handleSave} className="btn btn-primary flex-1" disabled={saving}>
                      {saving ? <span className="loading loading-spinner"></span> : 'Sauvegarder'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} className="btn btn-outline w-full">
                  ✏️ Modifier le profil
                </button>
              )}

              <p className="text-xs text-base-content/40 mt-4">
                Membre depuis {new Date(profile.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>

          {/* Stats Card */}
          <div className="space-y-4">
            {/* Balance */}
            <div className="card bg-gradient-to-br from-success/20 to-success/5 shadow-xl border border-success/20">
              <div className="card-body text-center py-4">
                <div className="text-2xl">💰</div>
                <p className="text-sm text-base-content/60">Solde</p>
                <p className="text-3xl font-bold text-success">${profile.balance}</p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="stats stats-vertical bg-base-200 shadow-xl w-full">
              <div className="stat">
                <div className="stat-title">Parties jouées</div>
                <div className="stat-value text-primary">{profile.gamesPlayed}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Victoires</div>
                <div className="stat-value text-success">{profile.gamesWon}</div>
                <div className="stat-desc">Taux: {winRate}%</div>
              </div>
              <div className="stat">
                <div className="stat-title">Gains nets</div>
                <div className={`stat-value ${netProfit >= 0 ? 'text-success' : 'text-error'}`}>
                  {netProfit >= 0 ? '+' : ''}{netProfit}$
                </div>
              </div>
              <div className="stat">
                <div className="stat-title">Blackjacks</div>
                <div className="stat-value text-warning">{profile.blackjackCount}</div>
              </div>
              <div className="stat">
                <div className="stat-title">Meilleure série</div>
                <div className="stat-value">{profile.bestStreak}</div>
                <div className="stat-desc">Actuelle: {profile.currentStreak}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}

