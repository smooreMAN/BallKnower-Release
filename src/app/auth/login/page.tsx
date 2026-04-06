'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    if (loginError) {
      setError('Invalid email or password.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-8 animate-pop-in">
      <h1 className="font-display text-4xl text-bk-white mb-1">WELCOME BACK</h1>
      <p className="text-bk-gray-muted text-sm mb-8">Your rating awaits</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-bk-gray-muted uppercase tracking-widest mb-2">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="you@email.com"
            required
            className="w-full bg-bk-black border-2 border-bk-gray-light rounded-xl px-4 py-3 text-bk-white placeholder-bk-gray-muted focus:outline-none focus:border-bk-gold transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-bk-gray-muted uppercase tracking-widest mb-2">
            Password
          </label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
            required
            className="w-full bg-bk-black border-2 border-bk-gray-light rounded-xl px-4 py-3 text-bk-white placeholder-bk-gray-muted focus:outline-none focus:border-bk-gold transition-colors"
          />
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-bk-gold text-bk-black font-bold text-lg py-4 rounded-xl hover:bg-bk-gold-dark transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? 'Logging in...' : 'Log In →'}
        </button>
      </form>

      <p className="text-center text-bk-gray-muted text-sm mt-6">
        New here?{' '}
        <Link href="/auth/signup" className="text-bk-gold hover:underline font-bold">
          Create account
        </Link>
      </p>
    </div>
  );
}
