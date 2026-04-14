import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type MatchRow = {
  id: string;
  player1_id: string;
  player2_id: string;
  question_ids: string[];
  current_question_index: number;
  player1_score: number;
  player2_score: number;
  status: string;
};

type QuestionRow = {
  id: string;
  correct_index: number;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { answerIndex } = (await req.json()) as { answerIndex: number };

    if (typeof answerIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid answerIndex' }, { status: 400 });
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
      .single<MatchRow>();

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (user.id !== match.player1_id && user.id !== match.player2_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (match.status === 'complete') {
      return NextResponse.json({ error: 'Match already complete' }, { status: 400 });
    }

    const questionIds = Array.isArray(match.question_ids) ? match.question_ids : [];
    const questionIndex = match.current_question_index;

    if (questionIndex >= questionIds.length) {
      return NextResponse.json({ done: true });
    }

    const questionId = questionIds[questionIndex];

    const { data: existingAnswer } = await supabase
      .from('multiplayer_answers')
      .select('id')
      .eq('match_id', id)
      .eq('question_index', questionIndex)
      .eq('player_id', user.id)
      .maybeSingle();

    if (existingAnswer) {
      return NextResponse.json({ error: 'You already answered this question' }, { status: 400 });
    }

    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id, correct_index')
      .eq('id', questionId)
      .single<QuestionRow>();

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    const isCorrect = answerIndex === question.correct_index;

    const { error: insertError } = await supabase
      .from('multiplayer_answers')
      .insert({
        match_id: id,
        question_index: questionIndex,
        player_id: user.id,
        answer_index: answerIndex,
        is_correct: isCorrect,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { data: allAnswersForQuestion, error: allAnswersError } = await supabase
      .from('multiplayer_answers')
      .select('player_id, is_correct')
      .eq('match_id', id)
      .eq('question_index', questionIndex);

    if (allAnswersError) {
      return NextResponse.json({ error: allAnswersError.message }, { status: 500 });
    }

    const bothAnswered = (allAnswersForQuestion?.length ?? 0) >= 2;

    if (!bothAnswered) {
      return NextResponse.json({
        success: true,
        waiting: true,
        isCorrect,
      });
    }

    const player1AnsweredCorrectly = !!allAnswersForQuestion?.find(
      (a) => a.player_id === match.player1_id && a.is_correct
    );

    const player2AnsweredCorrectly = !!allAnswersForQuestion?.find(
      (a) => a.player_id === match.player2_id && a.is_correct
    );

    const nextPlayer1Score = match.player1_score + (player1AnsweredCorrectly ? 1 : 0);
    const nextPlayer2Score = match.player2_score + (player2AnsweredCorrectly ? 1 : 0);
    const nextQuestionIndex = questionIndex + 1;
    const isLastQuestion = nextQuestionIndex >= questionIds.length;

    const { error: updateMatchError } = await supabase
      .from('multiplayer_matches')
      .update({
        player1_score: nextPlayer1Score,
        player2_score: nextPlayer2Score,
        current_question_index: nextQuestionIndex,
        status: isLastQuestion ? 'finishing' : 'active',
      })
      .eq('id', id);

    if (updateMatchError) {
      return NextResponse.json({ error: updateMatchError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      waiting: false,
      isCorrect,
      done: isLastQuestion,
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 });
  }
}