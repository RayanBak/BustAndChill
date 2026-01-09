'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthContext } from '@/hooks/useAuth';

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, user, isLoading: authLoading } = useAuthContext();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  // Gérer les messages de vérification d'email depuis l'URL
  useEffect(() => {
    const verified = searchParams.get('verified');
    const errorParam = searchParams.get('error');
    
    if (verified === '1') {
      setSuccess('✅ Email vérifié avec succès ! Vous pouvez maintenant vous connecter.');
      // Nettoyer l'URL
      router.replace('/login', { scroll: false });
    } else if (verified === 'already') {
      setSuccess('ℹ️ Votre email est déjà vérifié. Vous pouvez vous connecter.');
      router.replace('/login', { scroll: false });
    } else if (errorParam === 'missing_token') {
      setError('Token de vérification manquant. Veuillez utiliser le lien reçu par email.');
      router.replace('/login', { scroll: false });
    } else if (errorParam === 'invalid_token') {
      setError('Token de vérification invalide ou expiré. Veuillez vous réinscrire.');
      router.replace('/login', { scroll: false });
    } else if (errorParam === 'expired_token') {
      setError('Le token de vérification a expiré. Veuillez vous réinscrire.');
      router.replace('/login', { scroll: false });
    } else if (errorParam === 'verification_failed') {
      setError('Échec de la vérification de l\'email. Veuillez réessayer.');
      router.replace('/login', { scroll: false });
    }
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    console.log('🔵 [LOGIN PAGE] Tentative de connexion');
    console.log('🔵 [LOGIN PAGE] Email:', email);

    const success = await login(email, password);

    setIsLoading(false);

    if (success) {
      console.log('✅ [LOGIN PAGE] Connexion réussie, redirection vers /dashboard');
      router.push('/dashboard');
    } else {
      console.error('❌ [LOGIN PAGE] Échec de la connexion');
      setError('Email ou mot de passe invalide, ou email non vérifié');
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-base-300 via-base-100 to-base-300 py-12 px-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body">
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">🃏</div>
            <h1 className="text-2xl font-bold">Bon retour</h1>
            <p className="text-base-content/60">Connectez-vous à Bust & Chill</p>
          </div>

          {success && (
            <div className="alert alert-success">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{success}</span>
            </div>
          )}

          {error && (
            <div className="alert alert-error">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input input-bordered"
                placeholder="vous@exemple.com"
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Mot de passe</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input input-bordered"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="loading loading-spinner"></span>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <div className="divider">OU</div>

          <p className="text-center">
            Vous n&apos;avez pas de compte ?{' '}
            <Link href="/register" className="link link-primary">
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

