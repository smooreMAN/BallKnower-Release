import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MatchLobbyClient from '@/components/MatchLobbyClient';

type MatchRecord = {
  id: string;
  player1_id: string;
  player2_id: string;
  sport: string;
  difficulty: string;
  question_ids: string[];
  current_question_index: number;
  player1_score: number;
  player2_score: number;
  player1_ready: boolean;
  player2_ready: boolean;
  status: 'pending' | 'active' | 'complete' | 'abandoned';
  winner_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type Player = {
  id: string;
  username: string;
  elo: number;
  games_played: number;
  wins: number;
  losses: number;
} | null;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchLobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: match, error: matchError } = await supabase
    .from('multiplayer_matches')
    .select('*')
    .eq('id', id)
    .single();

  if (matchError || !match) {
    return (
      <div className="animate-slide-up">
        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-8 text-center">
          <h1 className="font-display text-4xl text-bk-white mb-2">MATCH NOT FOUND</h1>
          <p className="text-bk-gray-muted">This match does not exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  if (match.player1_id !== user.id && match.player2_id !== user.id) {
    return (
      <div className="animate-slide-up">
        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-8 text-center">
          <h1 className="font-display text-4xl text-bk-white mb-2">NO ACCESS</h1>
          <p className="text-bk-gray-muted">You are not a player in this match.</p>
        </div>
      </div>
    );
  }

  if (match.started_at || match.status === 'active') {
    redirect(`/dashboard/match/${match.id}/play`);
  }

  if (match.status === 'complete') {
    redirect(`/dashboard/match/${match.id}/play`);
  }

  const { data: playerRows } = await supabase
    .from('profiles')
    .select('id, username, elo, games_played, wins, losses')
    .in('id', [match.player1_id, match.player2_id]);

  const player1 = playerRows?.find((p) => p.id === match.player1_id) ?? null;
  const player2 = playerRows?.find((p) => p.id === match.player2_id) ?? null;

  const initialData = {
    match: match as MatchRecord,
    players: {
      player1: player1 as Player,
      player2: player2 as Player,
      me: user.id === match.player1_id ? (player1 as Player) : (player2 as Player),
      opponent: user.id === match.player1_id ? (player2 as Player) : (player1 as Player),
    },
    currentUserId: user.id,
  };

  return <MatchLobbyClient initialData={initialData} />;
}