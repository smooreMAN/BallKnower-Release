import { createClient } from '@/lib/supabase/server';
import MultiplayerGameScreen from '@/components/MultiplayerGameScreen';
import { getQuestionsByIds } from '@/lib/question-bank';

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div className="p-10 text-white">Unauthorized</div>;
  }

  const { id: matchId } = await params;

  const { data: match, error: matchError } = await supabase
    .from('multiplayer_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (matchError || !match) {
    return <div className="p-10 text-white">Match not found</div>;
  }

  if (user.id !== match.player1_id && user.id !== match.player2_id) {
    return <div className="p-10 text-white">Forbidden</div>;
  }

  const playerIds = [match.player1_id, match.player2_id];

  const { data: players } = await supabase
    .from('profiles')
    .select('id, username, elo, games_played, wins, losses')
    .in('id', playerIds);

  const { data: answers } = await supabase
    .from('multiplayer_answers')
    .select('*')
    .eq('match_id', matchId)
    .order('question_index', { ascending: true })
    .order('created_at', { ascending: true });

  const questionIds: string[] = Array.isArray(match.question_ids)
    ? match.question_ids
    : [];

  const questions = await getQuestionsByIds(questionIds);

  const player1 = players?.find((p) => p.id === match.player1_id) ?? null;
  const player2 = players?.find((p) => p.id === match.player2_id) ?? null;

  const initialData = {
    match,
    players: {
      player1,
      player2,
      me: user.id === match.player1_id ? player1 : player2,
      opponent: user.id === match.player1_id ? player2 : player1,
    },
    questions,
    answers: answers ?? [],
    currentUserId: user.id,
  };

  return <MultiplayerGameScreen initialData={initialData} />;
}