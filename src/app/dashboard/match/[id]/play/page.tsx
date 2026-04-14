import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MatchPlayClient from '@/components/MatchPlayClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type MatchRow = {
  id: string;
  player1_id: string;
  player2_id: string;
  sport: string;
  difficulty: string;
  status: string;
  question_ids: string[];
  current_question_index: number;
  player1_score: number;
  player2_score: number;
  player1_ready: boolean;
  player2_ready: boolean;
  started_at: string | null;
  winner_id: string | null;
  created_at: string;
  completed_at: string | null;
  player1_elo_before: number | null;
  player2_elo_before: number | null;
  player1_elo_after: number | null;
  player2_elo_after: number | null;
  player1_elo_change: number | null;
  player2_elo_change: number | null;
};

type QuestionRow = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
};

type ProfileLite = {
  id: string;
  username: string;
  elo: number;
};

export default async function MatchPlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const { data: match, error: matchError } = await supabase
    .from('multiplayer_matches')
    .select('*')
    .eq('id', id)
    .single<MatchRow>();

  if (matchError || !match) {
    redirect('/dashboard');
  }

  if (user.id !== match.player1_id && user.id !== match.player2_id) {
    redirect('/dashboard');
  }

  if (!match.started_at) {
    redirect(`/dashboard/match/${match.id}`);
  }

  const questionIds = Array.isArray(match.question_ids) ? match.question_ids : [];

  const { data: questionsData } = await supabase
    .from('questions')
    .select('id, question, options, correct_index')
    .in('id', questionIds);

  const questionsMap = new Map((questionsData ?? []).map((q) => [q.id, q as QuestionRow]));
  const orderedQuestions = questionIds
    .map((qid) => questionsMap.get(qid))
    .filter(Boolean) as QuestionRow[];

  const { data: player1Profile } = await supabase
    .from('profiles')
    .select('id, username, elo')
    .eq('id', match.player1_id)
    .single<ProfileLite>();

  const { data: player2Profile } = await supabase
    .from('profiles')
    .select('id, username, elo')
    .eq('id', match.player2_id)
    .single<ProfileLite>();

  if (!player1Profile || !player2Profile) {
    redirect('/dashboard');
  }

  return (
    <MatchPlayClient
      initialMatch={match}
      initialQuestions={orderedQuestions}
      currentUserId={user.id}
      player1Profile={player1Profile}
      player2Profile={player2Profile}
    />
  );
}