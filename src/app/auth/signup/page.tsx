'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();

    const username = form.username.trim().toLowerCase();
    const email = form.email.trim();

    if (!username) {
      setError('Username is required.');
      setLoading(false);
      return;
    }

    // Check username availability
    const { data: existingUser, error: existingError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existingError) {
      setError(existingError.message);
      setLoading(false);
      return;
    }

    if (existingUser) {
      setError('Username already taken. Try another.');
      setLoading(false);
      return;
    }

    // Create auth user
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        data: { username },
      },
    });

    if (signupError) {
      setError(signupError.message);
      setLoading(false);
      return;
    }

    const user = signupData.user;

    if (!user) {
      setError('User was created but no user record was returned.');
      setLoading(false);
      return;
    }

    // Create profile row explicitly
    const { error: profileError } = await supabase.from('profiles').insert({
      id: user.id,
      username,
      elo: 1200,
      games_played: 0,
      wins: 0,
      losses: 0,
    });

    if (profileError) {
      // If auth user exists but profile creation failed, show real reason
      setError(`Account created, but profile setup failed: ${profileError.message}`);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  };

  return (
    <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-8 animate-pop-in">
      <h1 className="font-display text-4xl text-bk-white mb-1">CREATE ACCOUNT</h1>
      <p className="text-bk-gray-muted text-sm mb-8">Join the global leaderboard</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-bk-gray-muted uppercase tracking-widest mb-2">
            Username
          </label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="BallGod99"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            className="w-full bg-bk-black border-2 border-bk-gray-light rounded-xl px-4 py-3 text-bk-white placeholder-bk-gray-muted focus:outline-none focus:border-bk-gold transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-bk-gray-muted uppercase tracking-widest mb-2">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
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
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
            required
            minLength={8}
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
          {loading ? 'Creating account...' : 'Create Account →'}
        </button>
      </form>

      <p className="text-center text-bk-gray-muted text-sm mt-6">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-bk-gold hover:underline font-bold">
          Log in
        </Link>
      </p>
    </div>
  );
}