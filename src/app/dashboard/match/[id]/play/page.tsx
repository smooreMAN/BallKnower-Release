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
};

type QuestionRow = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
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

  if (!user) {
    redirect('/auth/login');
  }

  const { data: match, error: matchError } = await supabase
    .from('multiplayer_matches')
    .select(`
      id,
      player1_id,
      player2_id,
      sport,
      difficulty,
      status,
      question_ids,
      current_question_index,
      player1_score,
      player2_score,
      player1_ready,
      player2_ready,
      started_at,
      winner_id,
      created_at
    `)
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

  if (!match.started_at) {
    redirect(`/dashboard/match/${match.id}`);
  }

  const questionIds = Array.isArray(match.question_ids) ? match.question_ids : [];

  const { data: questionsData, error: questionsError } = await supabase
    .from('questions')
    .select('id, question, options, correct_index')
    .in('id', questionIds);

  if (questionsError) {
    return (
      <div className="animate-slide-up">
        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-8 text-center">
          <h1 className="font-display text-4xl text-bk-white mb-2">QUESTION LOAD ERROR</h1>
          <p className="text-bk-gray-muted">Could not load match questions.</p>
        </div>
      </div>
    );
  }

  const questionMap = new Map((questionsData ?? []).map((q) => [q.id, q]));
  const orderedQuestions = questionIds
    .map((qid) => questionMap.get(qid))
    .filter(Boolean) as QuestionRow[];

  return (
    <MatchPlayClient
      currentUserId={user.id}
      initialMatch={match as MatchRow}
      questions={orderedQuestions}
    />
  );
}