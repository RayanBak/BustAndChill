'use client';

import Link from 'next/link';
import { useAuthContext } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { user, isLoading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.push('/dashboard');
    }
  }, [user, isLoading, router]);

  return (
    <div className="hero min-h-[calc(100vh-64px)] bg-gradient-to-br from-base-300 via-base-100 to-base-300">
      <div className="hero-content text-center">
        <div className="max-w-2xl">
          <div className="text-8xl mb-6 animate-bounce">🃏</div>
          <h1 className="text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Bust & Chill
            </span>
          </h1>
          <p className="text-xl text-base-content/70 mb-8">
            Jouez au Blackjack avec vos amis en temps réel !
            <br />
            Créez une partie, partagez le code, et rivalisez jusqu'à 21.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn btn-primary btn-lg gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Créer un compte
            </Link>
            <Link href="/login" className="btn btn-outline btn-lg gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Se connecter
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-4xl mb-2">👥</div>
                <h3 className="card-title">2-5 Joueurs</h3>
                <p className="text-base-content/60">Jouez avec vos amis, chacun sur son propre appareil</p>
              </div>
            </div>
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-4xl mb-2">⚡</div>
                <h3 className="card-title">Temps réel</h3>
                <p className="text-base-content/60">Mises à jour instantanées via WebSocket</p>
              </div>
            </div>
            <div className="card bg-base-200 shadow-xl">
              <div className="card-body items-center text-center">
                <div className="text-4xl mb-2">🏆</div>
                <h3 className="card-title">Classement</h3>
                <p className="text-base-content/60">Suivez vos victoires et rivalisez pour la première place</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
