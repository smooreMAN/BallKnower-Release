import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getQuestionsByIds } from '@/lib/question-bank';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const playerIds = [match.player1_id, match.player2_id];

    const { data: players, error: playersError } = await supabase
      .from('profiles')
      .select('id, username, elo, games_played, wins, losses')
      .in('id', playerIds);

    if (playersError) {
      return NextResponse.json(
        { error: 'Failed to load players' },
        { status: 500 }
      );
    }

    const { data: answers, error: answersError } = await supabase
      .from('multiplayer_answers')
      .select('*')
      .eq('match_id', id)
      .order('question_index', { ascending: true })
      .order('created_at', { ascending: true });

    if (answersError) {
      return NextResponse.json(
        { error: 'Failed to load answers' },
        { status: 500 }
      );
    }

    const questionIds: string[] = Array.isArray(match.question_ids)
      ? match.question_ids
      : [];

    const questions = await getQuestionsByIds(questionIds);

    const player1 = players?.find((p) => p.id === match.player1_id) ?? null;
    const player2 = players?.find((p) => p.id === match.player2_id) ?? null;

    return NextResponse.json({
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
    });
  } catch (err) {
    console.error('Fetch match error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch match' },
      { status: 500 }
    );
  }
}