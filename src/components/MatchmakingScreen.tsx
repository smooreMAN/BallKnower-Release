'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SPORTS } from '@/lib/sports';
import type { Sport } from '@/types';

export default function MatchmakingScreen() {
  const router = useRouter();
  const supabase = createClient();

  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPollingForMatch = () => {
    clearPoll();

    pollRef.current = setInterval(async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          clearPoll();
          setSearching(false);
          setError('You were logged out. Please log in again.');
          return;
        }

        const { data: queueEntry, error: queueError } = await supabase
          .from('matchmaking_queue')
          .select('match_id, status')
          .eq('user_id', user.id)
          .single();

        if (queueError) {
          return;
        }

        if (queueEntry?.match_id) {
          clearPoll();
          router.push(`/dashboard/match/${queueEntry.match_id}/play`);
          router.refresh();
          return;
        }

        if (!queueEntry || queueEntry.status !== 'searching') {
          clearPoll();
          setSearching(false);
          setError('Matchmaking was interrupted. Please try again.');
        }
      } catch {
        // keep polling quietly
      }
    }, 1500);
  };

  const handleFindMatch = async () => {
    if (!selectedSport || searching) return;

    setError('');
    setSearching(true);

    try {
      const res = await fetch('/api/matchmaking/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport: selectedSport }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to start matchmaking.');
        setSearching(false);
        return;
      }

      if (data.status === 'matched' && data.matchId) {
        clearPoll();
        router.push(`/dashboard/match/${data.matchId}/play`);
        router.refresh();
        return;
      }

      if (data.status === 'searching' || data.status === 'already_in_queue') {
        startPollingForMatch();
        return;
      }

      setError('Unexpected matchmaking response.');
      setSearching(false);
    } catch {
      setError('Something went wrong starting matchmaking.');
      setSearching(false);
    }
  };

  const handleCancel = async () => {
    try {
      await fetch('/api/matchmaking/cancel', {
        method: 'POST',
      });
    } catch {
      // ignore cancel errors
    }

    clearPoll();
    setSearching(false);
    setError('');
  };

  useEffect(() => {
    return () => clearPoll();
  }, []);

  return (
    <div className="max-w-3xl mx-auto animate-slide-up">
      <div className="mb-8">
        <h1 className="font-display text-5xl text-bk-white tracking-wide mb-2">
          RANKED ONLINE
        </h1>
        <p className="text-bk-gray-muted">
          Pick a sport and search for a live opponent.
        </p>
      </div>

      {!searching ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {SPORTS.map((sport) => (
              <button
                key={sport.id}
                onClick={() => setSelectedSport(sport.id)}
                className={`p-5 rounded-2xl border-2 text-center transition-all duration-200 hover:scale-105 active:scale-95 ${
                  selectedSport === sport.id
                    ? 'border-bk-gold bg-bk-gold/10 scale-105'
                    : 'border-bk-gray-light bg-bk-gray hover:border-bk-gold/50'
                }`}
              >
                <div className="text-4xl mb-2">{sport.emoji}</div>
                <div className="font-bold text-sm text-bk-white leading-tight">
                  {sport.label}
                </div>
                <div className="text-xs text-bk-gray-muted mt-1 hidden sm:block">
                  {sport.description}
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleFindMatch}
            disabled={!selectedSport}
            className="w-full bg-bk-gold text-bk-black font-display text-3xl tracking-wider py-5 rounded-2xl hover:bg-bk-gold-dark transition-all duration-200 hover:scale-[1.01] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {selectedSport
              ? `FIND ${SPORTS.find((s) => s.id === selectedSport)?.label.toUpperCase()} MATCH`
              : 'SELECT A SPORT'}
          </button>
        </>
      ) : (
        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-10 text-center animate-pop-in">
          <div className="w-14 h-14 border-4 border-bk-gold border-t-transparent rounded-full animate-spin mx-auto mb-5" />
          <h2 className="font-display text-4xl text-bk-white tracking-wide mb-2">
            SEARCHING...
          </h2>
          <p className="text-bk-gray-muted mb-6">
            Looking for an opponent in{' '}
            <span className="text-bk-gold font-bold">
              {SPORTS.find((s) => s.id === selectedSport)?.label}
            </span>
          </p>

          <button
            onClick={handleCancel}
            className="px-6 py-3 border-2 border-bk-gray-light text-bk-white font-bold rounded-2xl hover:border-bk-gold hover:text-bk-gold transition-all duration-200"
          >
            Cancel Search
          </button>
        </div>
      )}
    </div>
  );
}