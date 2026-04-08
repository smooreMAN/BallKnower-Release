import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  _req: Request,
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

    const isPlayer =
      user.id === match.player1_id || user.id === match.player2_id;

    if (!isPlayer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (match.status !== 'active') {
      return NextResponse.json({ error: 'Match is not active' }, { status: 400 });
    }

    const currentIndex = match.current_question_index;

    const { data: roundAnswers, error: answersError } = await supabase
      .from('multiplayer_answers')
      .select('id, player_id')
      .eq('match_id', id)
      .eq('question_index', currentIndex);

    if (answersError) {
      console.error(answersError);
      return NextResponse.json(
        { error: 'Failed to load round answers' },
        { status: 500 }
      );
    }

    const uniquePlayersAnswered = new Set((roundAnswers ?? []).map((a) => a.player_id));

    if (uniquePlayersAnswered.size < 2) {
      return NextResponse.json(
        { error: 'Cannot advance until both players have answered' },
        { status: 400 }
      );
    }

    const totalQuestions = Array.isArray(match.question_ids)
      ? match.question_ids.length
      : 0;

    if (totalQuestions === 0) {
      return NextResponse.json({ error: 'No questions found for match' }, { status: 400 });
    }

    if (currentIndex >= totalQuestions - 1) {
      return NextResponse.json(
        { error: 'This is the final question. Complete the match instead.' },
        { status: 400 }
      );
    }

    const nextIndex = currentIndex + 1;

    const { error: updateError } = await supabase
      .from('multiplayer_matches')
      .update({
        current_question_index: nextIndex,
      })
      .eq('id', id)
      .eq('current_question_index', currentIndex);

    if (updateError) {
      console.error(updateError);
      return NextResponse.json(
        { error: 'Failed to advance question' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      nextQuestionIndex: nextIndex,
    });
  } catch (err) {
    console.error('Advance question error:', err);
    return NextResponse.json(
      { error: 'Failed to advance question' },
      { status: 500 }
    );
  }
}