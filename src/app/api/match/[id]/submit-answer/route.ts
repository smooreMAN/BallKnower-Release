import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { SECONDS_PER_QUESTION, calculatePointsFromTimeLeft } from '@/lib/sports';

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

type MultiplayerAnswerRow = {
  player_id: string;
  is_correct: boolean;
  answer_time_left: number | null;
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { answerIndex, timeLeft } = (await req.json()) as {
      answerIndex: number;
      timeLeft?: number;
    };

    if (typeof answerIndex !== 'number') {
      return NextResponse.json({ error: 'Invalid answerIndex' }, { status: 400 });
    }

    const safeTimeLeft =
      typeof timeLeft === 'number'
        ? Math.max(0, Math.min(SECONDS_PER_QUESTION, Math.floor(timeLeft)))
        : 0;

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
      return NextResponse.json({ done: true, match });
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

    const { error: insertError } = await supabase.from('multiplayer_answers').insert({
      match_id: id,
      question_index: questionIndex,
      player_id: user.id,
      answer_index: answerIndex,
      is_correct: isCorrect,
      answer_time_left: safeTimeLeft,
    });

    if (insertError) {
      return NextResponse.json(
        {
          error:
            insertError.message.includes('answer_time_left')
              ? 'Database is missing answer_time_left. Run the SQL fix first.'
              : insertError.message,
        },
        { status: 500 }
      );
    }

    const { data: roundAnswers, error: roundAnswersError } = await supabase
      .from('multiplayer_answers')
      .select('player_id, is_correct, answer_time_left')
      .eq('match_id', id)
      .eq('question_index', questionIndex)
      .order('created_at', { ascending: true });

    if (roundAnswersError) {
      return NextResponse.json({ error: roundAnswersError.message }, { status: 500 });
    }

    const uniquePlayersAnswered = new Set((roundAnswers ?? []).map((answer) => answer.player_id));
    const bothAnswered = uniquePlayersAnswered.size >= 2;

    if (!bothAnswered) {
      return NextResponse.json({
        success: true,
        waiting: true,
        done: false,
      });
    }

    const player1Answer = (roundAnswers ?? []).find(
      (answer) => answer.player_id === match.player1_id
    ) as MultiplayerAnswerRow | undefined;

    const player2Answer = (roundAnswers ?? []).find(
      (answer) => answer.player_id === match.player2_id
    ) as MultiplayerAnswerRow | undefined;

    const player1Points = player1Answer?.is_correct
      ? calculatePointsFromTimeLeft(player1Answer.answer_time_left ?? 0)
      : 0;

    const player2Points = player2Answer?.is_correct
      ? calculatePointsFromTimeLeft(player2Answer.answer_time_left ?? 0)
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
      .eq('current_question_index', questionIndex)
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
      done: isLastQuestion,
      match: updatedMatch,
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    return NextResponse.json({ error: 'Failed to submit answer' }, { status: 500 });
  }
}