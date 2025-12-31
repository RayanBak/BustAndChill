'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface Friend {
  id: string;
  username: string;
  avatarUrl: string | null;
  friendshipId: string;
}

interface PendingRequest {
  id: string;
  user: { id: string; username: string; avatarUrl: string | null };
  createdAt: string;
}

function FriendsContent() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingReceived, setPendingReceived] = useState<PendingRequest[]>([]);
  const [pendingSent, setPendingSent] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUsername, setSearchUsername] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const res = await fetch('/api/friends');
      const data = await res.json();
      if (data.success) {
        setFriends(data.friends);
        setPendingReceived(data.pendingReceived);
        setPendingSent(data.pendingSent);
      }
    } catch {
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;
    
    setSending(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: searchUsername }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSuccess(data.message);
        setSearchUsername('');
        await fetchFriends();
      } else {
        setError(data.error);
      }
    } catch {
      setError('Erreur');
    } finally {
      setSending(false);
    }
  };

  const handleRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      const res = await fetch(`/api/friends/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        await fetchFriends();
      }
    } catch {
      setError('Erreur');
    }
  };

  const removeFriend = async (friendshipId: string) => {
    if (!confirm('Supprimer cet ami ?')) return;
    
    try {
      const res = await fetch(`/api/friends/${friendshipId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        await fetchFriends();
      }
    } catch {
      setError('Erreur');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-base-300 via-base-100 to-base-300 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">👥 Mes Amis</h1>

        {error && <div className="alert alert-error mb-4">{error}</div>}
        {success && <div className="alert alert-success mb-4">{success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Friend */}
          <div className="lg:col-span-1">
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title text-lg">➕ Ajouter un ami</h2>
                <form onSubmit={sendRequest} className="space-y-3">
                  <input
                    type="text"
                    value={searchUsername}
                    onChange={(e) => setSearchUsername(e.target.value)}
                    placeholder="Pseudo..."
                    className="input input-bordered w-full"
                  />
                  <button type="submit" className="btn btn-primary w-full" disabled={sending}>
                    {sending ? <span className="loading loading-spinner"></span> : 'Envoyer'}
                  </button>
                </form>
              </div>
            </div>

            {/* Pending Received */}
            {pendingReceived.length > 0 && (
              <div className="card bg-base-200 shadow-xl mt-4">
                <div className="card-body">
                  <h2 className="card-title text-lg">📩 Demandes reçues</h2>
                  <div className="space-y-2">
                    {pendingReceived.map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-2 bg-base-300 rounded-lg">
                        <span className="font-medium">{req.user.username}</span>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleRequest(req.id, 'accept')}
                            className="btn btn-success btn-xs"
                          >✓</button>
                          <button 
                            onClick={() => handleRequest(req.id, 'reject')}
                            className="btn btn-error btn-xs"
                          >✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pending Sent */}
            {pendingSent.length > 0 && (
              <div className="card bg-base-200 shadow-xl mt-4">
                <div className="card-body">
                  <h2 className="card-title text-lg">📤 En attente</h2>
                  <div className="space-y-2">
                    {pendingSent.map((req) => (
                      <div key={req.id} className="flex items-center justify-between p-2 bg-base-300 rounded-lg">
                        <span className="font-medium">{req.user.username}</span>
                        <span className="badge badge-ghost badge-sm">En attente</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Friends List */}
          <div className="lg:col-span-2">
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body">
                <h2 className="card-title">
                  Amis
                  <div className="badge badge-primary">{friends.length}</div>
                </h2>

                {friends.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">😢</div>
                    <p className="text-base-content/60">Pas encore d'amis</p>
                    <p className="text-sm text-base-content/40">Ajoutez des amis pour jouer ensemble !</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {friends.map((friend) => (
                      <div key={friend.id} className="flex items-center justify-between p-3 bg-base-300 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="avatar placeholder">
                            <div className="bg-neutral text-neutral-content rounded-full w-10">
                              <span>{friend.username.charAt(0).toUpperCase()}</span>
                            </div>
                          </div>
                          <div>
                            <Link href={`/user/${friend.username}`} className="font-medium hover:text-primary">
                              {friend.username}
                            </Link>
                          </div>
                        </div>
                        <div className="dropdown dropdown-end">
                          <label tabIndex={0} className="btn btn-ghost btn-xs">⋮</label>
                          <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-32">
                            <li><Link href={`/user/${friend.username}`}>Voir profil</Link></li>
                            <li><button onClick={() => removeFriend(friend.friendshipId)} className="text-error">Supprimer</button></li>
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FriendsPage() {
  return (
    <ProtectedRoute>
      <FriendsContent />
    </ProtectedRoute>
  );
}

