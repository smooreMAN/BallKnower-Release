'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';
import { getTier } from '@/lib/elo';

export default function DashboardNav({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const tier = profile ? getTier(profile.elo) : null;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const navItems = [
    { href: '/dashboard', label: 'Home', emoji: '🏠' },
    { href: '/dashboard/play', label: 'Play', emoji: '▶️' },
    { href: '/dashboard/leaderboard', label: 'Leaderboard', emoji: '🏆' },
    { href: '/dashboard/profile', label: 'Profile', emoji: '👤' },
  ];

  return (
    <nav className="border-b border-bk-gray-light bg-bk-black/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-bk-gold flex items-center justify-center">
            <span className="font-display text-sm text-bk-black">BK</span>
          </div>
          <span className="font-display text-xl tracking-wider text-bk-white hidden sm:block">BALLKNOWER</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navItems.map(({ href, label, emoji }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-2 rounded-lg text-sm font-bold transition-all duration-150 ${
                pathname === href
                  ? 'bg-bk-gold text-bk-black'
                  : 'text-bk-gray-muted hover:text-bk-white hover:bg-bk-gray'
              }`}
            >
              <span className="sm:hidden">{emoji}</span>
              <span className="hidden sm:block">{label}</span>
            </Link>
          ))}
        </div>

        {/* Elo badge + logout */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {profile && tier && (
            <div className="hidden sm:flex items-center gap-2 bg-bk-gray rounded-xl px-3 py-1.5">
              <span>{tier.emoji}</span>
              <span className="font-bold text-sm" style={{ color: tier.color }}>{profile.elo}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="text-bk-gray-muted hover:text-bk-white text-sm transition-colors"
          >
            Out
          </button>
        </div>
      </div>
    </nav>
  );
}
