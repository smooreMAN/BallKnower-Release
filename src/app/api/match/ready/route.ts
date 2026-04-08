import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
  status: 'active' | 'complete' | 'abandoned';
  winner_id: string | null;
  player1_ready?: boolean;
  player2_ready?: boolean;
  started_at?: string | null;
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

type Question = {
  id: string;
  sport: string;
  difficulty: string;
  question: string;
  options: string[];
  correct_index: number;
  times_used: number;
};

type Answer = {
  id: string;
  match_id: string;
  question_index: number;
  player_id: string;
  answer_index: number;
  is_correct: boolean;
  created_at: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: match, error: matchError } = await supabase
      .from('multiplayer_matches')
      .select('*')
      .eq('id', id)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.player1_id !== user.id && match.player2_id !== user.id) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    const { data: playerRows, error: playersError } = await supabase
      .from('profiles')
      .select('id, username, elo, games_played, wins, losses')
      .in('id', [match.player1_id, match.player2_id]);

    if (playersError) {
      return NextResponse.json(
        { error: `Failed to load players: ${playersError.message}` },
        { status: 500 }
      );
    }

    const player1 =
      playerRows?.find((p) => p.id === match.player1_id) ?? null;

    const player2 =
      playerRows?.find((p) => p.id === match.player2_id) ?? null;

    const me = user.id === match.player1_id ? player1 : player2;
    const opponent = user.id === match.player1_id ? player2 : player1;

    let questionIds: string[] = [];

    if (Array.isArray(match.question_ids)) {
      questionIds = match.question_ids;
    } else if (typeof match.question_ids === 'string') {
      try {
        const parsed = JSON.parse(match.question_ids);
        questionIds = Array.isArray(parsed) ? parsed : [];
      } catch {
        questionIds = [];
      }
    } else if (
      match.question_ids &&
      typeof match.question_ids === 'object' &&
      Array.isArray((match.question_ids as unknown[]))
    ) {
      questionIds = match.question_ids as string[];
    }

    let questions: Question[] = [];

    if (questionIds.length > 0) {
      const { data: questionRows, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .in('id', questionIds);

      if (questionsError) {
        return NextResponse.json(
          { error: `Failed to load questions: ${questionsError.message}` },
          { status: 500 }
        );
      }

      const byId = new Map((questionRows ?? []).map((q) => [q.id, q]));
      questions = questionIds
        .map((questionId) => byId.get(questionId))
        .filter(Boolean) as Question[];
    }

    const { data: answers, error: answersError } = await supabase
      .from('multiplayer_answers')
      .select('*')
      .eq('match_id', match.id)
      .order('created_at', { ascending: true });

    if (answersError) {
      return NextResponse.json(
        { error: `Failed to load answers: ${answersError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      match: match as MatchRecord,
      players: {
        player1: player1 as Player,
        player2: player2 as Player,
        me: me as Player,
        opponent: opponent as Player,
      },
      questions,
      answers: (answers ?? []) as Answer[],
      currentUserId: user.id,
    });
  } catch (error) {
    console.error('Match GET route error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}