'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Aucun token de vérification fourni');
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Email vérifié avec succès !');
        } else {
          setStatus('error');
          setMessage(data.error || 'Échec de la vérification');
        }
      } catch {
        setStatus('error');
        setMessage('Une erreur s\'est produite lors de la vérification');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-base-300 via-base-100 to-base-300 py-12 px-4">
      <div className="card w-full max-w-md bg-base-200 shadow-xl">
        <div className="card-body items-center text-center">
          {status === 'loading' && (
            <>
              <span className="loading loading-spinner loading-lg text-primary"></span>
              <h2 className="card-title mt-4">Vérification de votre email...</h2>
              <p className="text-base-content/60">Veuillez patienter pendant que nous vérifions votre adresse email.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-6xl mb-4">✅</div>
              <h2 className="card-title text-success">Email vérifié !</h2>
              <p className="text-base-content/60 mb-4">{message}</p>
              <Link href="/login" className="btn btn-primary">
                Se connecter maintenant
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-6xl mb-4">❌</div>
              <h2 className="card-title text-error">Échec de la vérification</h2>
              <p className="text-base-content/60 mb-4">{message}</p>
              <div className="flex gap-2">
                <Link href="/register" className="btn btn-outline">
                  S'inscrire à nouveau
                </Link>
                <Link href="/login" className="btn btn-primary">
                  Essayer de se connecter
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}


