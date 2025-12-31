'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthContext } from '@/hooks/useAuth';

export function Navbar() {
  const { user, logout, isLoading } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const isActive = (path: string) => pathname === path;

  return (
    <div className="navbar bg-base-200 shadow-lg px-4 lg:px-8">
      {/* Logo */}
      <div className="navbar-start">
        <Link href={user ? '/dashboard' : '/'} className="btn btn-ghost text-xl gap-2">
          <span className="text-2xl">🃏</span>
          <span className="font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent hidden sm:inline">
            Bust & Chill
          </span>
        </Link>
      </div>

      {/* Center Menu - Only show when logged in */}
      {user && (
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1 gap-1">
            <li>
              <Link href="/dashboard" className={isActive('/dashboard') ? 'active' : ''}>
                🎰 Tables
              </Link>
            </li>
            <li>
              <Link href="/friends" className={isActive('/friends') ? 'active' : ''}>
                👥 Amis
              </Link>
            </li>
            <li>
              <Link href="/stats" className={isActive('/stats') ? 'active' : ''}>
                📊 Stats
              </Link>
            </li>
            <li>
              <Link href="/leaderboard" className={isActive('/leaderboard') ? 'active' : ''}>
                🏆 Classement
              </Link>
            </li>
          </ul>
        </div>
      )}

      {/* Right Side */}
      <div className="navbar-end gap-2">
        {isLoading ? (
          <span className="loading loading-spinner loading-sm"></span>
        ) : user ? (
          <>
            {/* Balance Badge */}
            <div className="badge badge-success badge-lg gap-1 hidden sm:flex">
              💰 ${user.balance}
            </div>

            {/* Mobile Menu */}
            <div className="dropdown dropdown-end lg:hidden">
              <label tabIndex={0} className="btn btn-ghost btn-circle">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </label>
              <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-lg bg-base-100 rounded-box w-52 mt-3">
                <li><Link href="/dashboard">🎰 Tables</Link></li>
                <li><Link href="/friends">👥 Amis</Link></li>
                <li><Link href="/stats">📊 Stats</Link></li>
                <li><Link href="/leaderboard">🏆 Classement</Link></li>
                <div className="divider my-1"></div>
                <li><Link href="/profile">👤 Profil</Link></li>
                <li><button onClick={handleLogout} className="text-error">🚪 Déconnexion</button></li>
              </ul>
            </div>

            {/* User Menu */}
            <div className="dropdown dropdown-end">
              <label tabIndex={0} className="btn btn-ghost gap-2">
                <div className="avatar placeholder">
                  <div className="bg-primary text-primary-content rounded-full w-8">
                    <span className="text-sm font-bold">
                      {user.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <span className="hidden md:inline">{user.username}</span>
                <svg className="w-4 h-4 hidden lg:inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </label>
              <ul tabIndex={0} className="dropdown-content z-[100] menu p-2 shadow-lg bg-base-100 rounded-box w-56 mt-3">
                <li className="menu-title px-4 py-2">
                  <div className="flex items-center gap-2">
                    <div className="avatar placeholder">
                      <div className="bg-primary text-primary-content rounded-full w-10">
                        <span className="text-lg">{user.username.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                    <div>
                      <p className="font-bold">{user.username}</p>
                      <p className="text-xs text-base-content/60">{user.email}</p>
                    </div>
                  </div>
                </li>
                <div className="divider my-1"></div>
                <li>
                  <div className="flex justify-between">
                    <span>💰 Solde</span>
                    <span className="font-bold text-success">${user.balance}</span>
                  </div>
                </li>
                <div className="divider my-1"></div>
                <li>
                  <Link href="/profile">
                    👤 Mon Profil
                  </Link>
                </li>
                <li>
                  <Link href="/stats">
                    📊 Mes Statistiques
                  </Link>
                </li>
                <li>
                  <Link href="/friends">
                    👥 Mes Amis
                  </Link>
                </li>
                <div className="divider my-1"></div>
                <li>
                  <button onClick={handleLogout} className="text-error">
                    🚪 Déconnexion
                  </button>
                </li>
              </ul>
            </div>
          </>
        ) : (
          <div className="flex gap-2">
            <Link href="/login" className="btn btn-ghost btn-sm">
              Connexion
            </Link>
            <Link href="/register" className="btn btn-primary btn-sm">
              Inscription
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
