import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MatchLobbyClient from '@/components/MatchLobbyClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

export default async function MatchPage({
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
    .select(
      'id, player1_id, player2_id, sport, difficulty, status, player1_ready, player2_ready, started_at, created_at'
    )
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

  if (match.started_at) {
    redirect(`/dashboard/match/${match.id}/play`);
  }

  const opponentId = match.player1_id === user.id ? match.player2_id : match.player1_id;

  const { data: opponent } = await supabase
    .from('profiles')
    .select('id, username, elo')
    .eq('id', opponentId)
    .single();

  return (
    <MatchLobbyClient
      initialMatch={match as MatchRow}
      currentUserId={user.id}
      opponent={{
        id: opponent?.id ?? opponentId,
        username: opponent?.username ?? 'Opponent',
        elo: opponent?.elo ?? 1200,
      }}
    />
  );
}