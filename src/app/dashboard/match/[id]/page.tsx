import { createClient } from '@/lib/supabase/server';
import MultiplayerGameScreen from '@/components/MultiplayerGameScreen';

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { id: matchId } = await params;

  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (!match) {
    return <div className="p-10 text-white">Match not found</div>;
  }

  const { data: player1 } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', match.player1_id)
    .single();

  const { data: player2 } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', match.player2_id)
    .single();

  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .in('id', match.question_ids);

  const { data: answers } = await supabase
    .from('answers')
    .select('*')
    .eq('match_id', matchId);

  const initialData = {
    match,
    players: {
      player1,
      player2,
      me: user?.id === match.player1_id ? player1 : player2,
      opponent: user?.id === match.player1_id ? player2 : player1,
    },
    questions: questions ?? [],
    answers: answers ?? [],
    currentUserId: user!.id,
  };

  return <MultiplayerGameScreen initialData={initialData} />;
}