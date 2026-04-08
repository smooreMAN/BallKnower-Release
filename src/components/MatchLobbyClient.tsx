'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type MatchRow = {
  id: string;
  player1_id: string;
  player2_id: string;
  sport: string;
  difficulty: string;
  status: string;
  player1_ready: boolean;
  player2_ready: boolean;
  started_at: string | null;
  created_at: string;
};

type Opponent = {
  id: string;
  username: string;
  elo: number;
};

type Props = {
  initialMatch: MatchRow;
  currentUserId: string;
  opponent: Opponent;
};

export default function MatchLobbyClient({
  initialMatch,
  currentUserId,
  opponent,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [match, setMatch] = useState<MatchRow>(initialMatch);
  const [loadingReady, setLoadingReady] = useState(false);
  const [message, setMessage] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const isPlayer1 = match.player1_id === currentUserId;
  const myReady = isPlayer1 ? match.player1_ready : match.player2_ready;
  const opponentReady = isPlayer1 ? match.player2_ready : match.player1_ready;

  const bothReady = useMemo(
    () => match.player1_ready && match.player2_ready,
    [match.player1_ready, match.player2_ready]
  );

  useEffect(() => {
    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('multiplayer_matches')
        .select(
          'id, player1_id, player2_id, sport, difficulty, status, player1_ready, player2_ready, started_at, created_at'
        )
        .eq('id', match.id)
        .single();

      if (!error && data) {
        setMatch(data as MatchRow);

        if ((data.started_at || (data.player1_ready && data.player2_ready)) && !redirecting) {
          setRedirecting(true);
          router.push(`/dashboard/match/${data.id}/play`);
        }
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [match.id, redirecting, router, supabase]);

  const handleReady = async () => {
    setLoadingReady(true);
    setMessage('');

    try {
      const res = await fetch(`/api/match/${match.id}/ready`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || 'Failed to mark ready');
        return;
      }

      if (data.match) {
        setMatch(data.match as MatchRow);

        if (
          (data.match.started_at ||
            (data.match.player1_ready && data.match.player2_ready)) &&
          !redirecting
        ) {
          setRedirecting(true);
          router.push(`/dashboard/match/${data.match.id}/play`);
          return;
        }
      }

      setMessage('You are ready. Waiting for opponent...');
    } catch (error) {
      console.error('ready failed', error);
      setMessage('Failed to mark ready');
    } finally {
      setLoadingReady(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-slide-up space-y-6">
      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6">
        <p className="text-xs uppercase tracking-widest text-bk-gray-muted font-bold mb-2">
          Match Lobby
        </p>
        <h1 className="font-display text-5xl text-bk-white tracking-wide mb-2">
          GET READY
        </h1>
        <p className="text-bk-gray-muted">
          Both players must be ready before the match begins.
        </p>
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-bk-gray-muted font-bold mb-2">
              Opponent
            </p>
            <p className="text-bk-white font-bold text-2xl">{opponent.username}</p>
            <p className="text-bk-gray-muted text-sm">Elo: {opponent.elo}</p>
          </div>

          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-bk-gray-muted font-bold mb-2">
              Match Type
            </p>
            <p className="text-bk-gold font-bold text-lg uppercase">{match.sport}</p>
            <p className="text-bk-gray-muted text-sm capitalize">{match.difficulty}</p>
          </div>
        </div>
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6">
        <h2 className="font-display text-2xl text-bk-white mb-4">READY STATUS</h2>

        <div className="space-y-3">
          <div className="bg-bk-black border border-bk-gray-light rounded-xl px-4 py-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-bk-white">You</p>
              <p className="text-sm text-bk-gray-muted">
                {myReady ? 'Ready to start' : 'Not ready yet'}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-lg text-sm font-bold ${
                myReady
                  ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                  : 'bg-bk-gray text-bk-gray-muted border border-bk-gray-light'
              }`}
            >
              {myReady ? 'Ready' : 'Waiting'}
            </span>
          </div>

          <div className="bg-bk-black border border-bk-gray-light rounded-xl px-4 py-4 flex items-center justify-between">
            <div>
              <p className="font-bold text-bk-white">{opponent.username}</p>
              <p className="text-sm text-bk-gray-muted">
                {opponentReady ? 'Ready to start' : 'Not ready yet'}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-lg text-sm font-bold ${
                opponentReady
                  ? 'bg-green-600/20 text-green-400 border border-green-600/30'
                  : 'bg-bk-gray text-bk-gray-muted border border-bk-gray-light'
              }`}
            >
              {opponentReady ? 'Ready' : 'Waiting'}
            </span>
          </div>
        </div>

        {bothReady && (
          <div className="mt-4 bg-green-900/20 border border-green-700/40 rounded-xl px-4 py-3 text-green-400 text-sm font-bold">
            Both players are ready. Launching match...
          </div>
        )}

        {message && (
          <div className="mt-4 bg-bk-black border border-bk-gray-light rounded-xl px-4 py-3 text-sm text-bk-white">
            {message}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={handleReady}
            disabled={loadingReady || myReady || redirecting}
            className="px-5 py-3 rounded-xl bg-bk-gold text-bk-black font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {redirecting
              ? 'Starting...'
              : myReady
              ? 'Ready'
              : loadingReady
              ? 'Saving...'
              : "I'm Ready"}
          </button>

          <button
            onClick={() => router.push('/dashboard/friends')}
            disabled={redirecting}
            className="px-5 py-3 rounded-xl border border-bk-gray-light text-bk-white font-bold hover:border-bk-gold hover:text-bk-gold disabled:opacity-50"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}