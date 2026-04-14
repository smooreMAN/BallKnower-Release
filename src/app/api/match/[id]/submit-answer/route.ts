import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculatePointsFromTimeLeft, SECONDS_PER_QUESTION } from '@/lib/sports';

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
    const body = (await req.json()) as { answerIndex: number; timeLeft?: number };

    const answerIndex = body.answerIndex;
    const rawTimeLeft = typeof body.timeLeft === 'number' ? body.timeLeft : 0;
    const safeTimeLeft = Math.max(0, Math.min(SECONDS_PER_QUESTION, Math.floor(rawTimeLeft)));

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
      .select('player_id, answer_index, is_correct')
      .eq('match_id', id)
      .eq('question_index', questionIndex);

    if (allAnswersError) {
      return NextResponse.json({ error: allAnswersError.message }, { status: 500 });
    }

    const uniquePlayersAnswered = new Set((allAnswersForQuestion ?? []).map((a) => a.player_id));
    const bothAnswered = uniquePlayersAnswered.size >= 2;

    if (!bothAnswered) {
      return NextResponse.json({
        success: true,
        waiting: true,
        isCorrect,
      });
    }

    const player1Answer = allAnswersForQuestion?.find((a) => a.player_id === match.player1_id);
    const player2Answer = allAnswersForQuestion?.find((a) => a.player_id === match.player2_id);

    const player1Points =
      player1Answer?.is_correct
        ? user.id === match.player1_id
          ? calculatePointsFromTimeLeft(safeTimeLeft)
          : 1
        : 0;

    const player2Points =
      player2Answer?.is_correct
        ? user.id === match.player2_id
          ? calculatePointsFromTimeLeft(safeTimeLeft)
          : 1
        : 0;

    const nextPlayer1Score = match.player1_score + player1Points;
    const nextPlayer2Score = match.player2_score + player2Points;
    const nextQuestionIndex = questionIndex + 1;
    const isLastQuestion = nextQuestionIndex >= questionIds.length;

    const { data: updatedMatch, error: updateMatchError } = await supabase
      .from('multiplayer_matches')
      .update({
        player1_score: nextPlayer1Score,
        player2_score: nextPlayer2Score,
        current_question_index: nextQuestionIndex,
        status: isLastQuestion ? 'finishing' : 'active',
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateMatchError || !updatedMatch) {
      return NextResponse.json(
        { error: updateMatchError?.message || 'Failed to update match' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      waiting: false,
      isCorrect,
      done: isLastQuestion,
      match: updatedMatch,
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 });
  }
}