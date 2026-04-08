import { createClient } from '@/lib/supabase/server';
import type { Difficulty, Sport } from '@/types';

type QuestionRecord = {
  id: string;
  sport: Sport;
  difficulty: Difficulty;
  question: string;
  options: string[];
  correct_index: number;
  times_used: number;
};

export async function getSharedQuestions(params: {
  sport: Sport;
  difficulty: Difficulty;
  count?: number;
}) {
  const { sport, difficulty, count = 10 } = params;

  const supabase = await createClient();

  const { data: cached, error } = await supabase
    .from('questions')
    .select('*')
    .eq('sport', sport)
    .eq('difficulty', difficulty)
    .order('times_used', { ascending: true })
    .limit(count * 3);

  if (error) {
    throw new Error(`Failed to load questions: ${error.message}`);
  }

  const shuffled = [...(cached ?? [])].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count) as QuestionRecord[];

  if (picked.length < count) {
    throw new Error(
      `Not enough questions found for ${sport} / ${difficulty}. Need ${count}, got ${picked.length}.`
    );
  }

  const questionIds = picked.map((q) => q.id);

  const { error: rpcError } = await supabase.rpc('increment_question_usage', {
    question_ids: questionIds,
  });

  if (rpcError) {
    console.error('increment_question_usage failed:', rpcError.message);
  }

  return {
    questionIds,
    questions: picked,
  };
}

export async function getQuestionsByIds(questionIds: string[]) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .in('id', questionIds);

  if (error) {
    throw new Error(`Failed to load questions by ids: ${error.message}`);
  }

  const byId = new Map((data ?? []).map((q) => [q.id, q]));

  return questionIds
    .map((id) => byId.get(id))
    .filter(Boolean) as QuestionRecord[];
}