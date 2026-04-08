import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getQuestionsByIds } from '@/lib/question-bank';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { answerIndex } = await req.json();

    if (typeof answerIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid answer index' }, { status: 400 });
    }

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

    if (match.status !== 'active') {
      return NextResponse.json({ error: 'Match is not active' }, { status: 400 });
    }

    const isPlayer =
      user.id === match.player1_id || user.id === match.player2_id;

    if (!isPlayer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const currentIndex = match.current_question_index;

    const { data: existingAnswer } = await supabase
      .from('multiplayer_answers')
      .select('id')
      .eq('match_id', id)
      .eq('question_index', currentIndex)
      .eq('player_id', user.id)
      .maybeSingle();

    if (existingAnswer) {
      return NextResponse.json({ error: 'Answer already submitted' }, { status: 400 });
    }

    const questionIds: string[] = Array.isArray(match.question_ids)
      ? match.question_ids
      : [];

    const questions = await getQuestionsByIds(questionIds);
    const currentQuestion = questions[currentIndex];

    if (!currentQuestion) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const isTimeout = answerIndex === -1;
    const isCorrect = !isTimeout && answerIndex === currentQuestion.correct_index;

    const { error: insertError } = await supabase
      .from('multiplayer_answers')
      .insert({
        match_id: id,
        question_index: currentIndex,
        player_id: user.id,
        answer_index: answerIndex,
        is_correct: isCorrect,
      });

    if (insertError) {
      console.error(insertError);
      return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 });
    }

    if (isCorrect) {
      const scoreField = user.id === match.player1_id ? 'player1_score' : 'player2_score';
      const nextScore = (match[scoreField] ?? 0) + 1;

      const { error: updateError } = await supabase
        .from('multiplayer_matches')
        .update({ [scoreField]: nextScore })
        .eq('id', id);

      if (updateError) {
        console.error(updateError);
        return NextResponse.json({ error: 'Failed to update score' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      isCorrect,
      correctIndex: currentQuestion.correct_index,
    });
  } catch (err) {
    console.error('Submit answer error:', err);
    return NextResponse.json(
      { error: 'Failed to submit answer' },
      { status: 500 }
    );
  }
}