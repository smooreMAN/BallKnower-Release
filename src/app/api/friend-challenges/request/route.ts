import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSharedQuestions } from '@/lib/question-bank';

export async function POST(req: NextRequest) {
  try {
    const { challengedId, sport, difficulty } = await req.json();

    if (!challengedId || typeof challengedId !== 'string') {
      return NextResponse.json({ error: 'challengedId is required' }, { status: 400 });
    }

    if (!sport || typeof sport !== 'string') {
      return NextResponse.json({ error: 'sport is required' }, { status: 400 });
    }

    if (!difficulty || typeof difficulty !== 'string') {
      return NextResponse.json({ error: 'difficulty is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (challengedId === user.id) {
      return NextResponse.json({ error: 'You cannot challenge yourself' }, { status: 400 });
    }

    const { data: challengedUser, error: challengedUserError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', challengedId)
      .maybeSingle();

    if (challengedUserError) {
      console.error('Challenge target lookup error:', challengedUserError);
      return NextResponse.json({ error: 'Failed to find challenged user' }, { status: 500 });
    }

    if (!challengedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let questionIds: string[] = [];

    try {
      const shared = await getSharedQuestions({
        sport,
        difficulty,
        count: 10,
      });

      if (!shared || !Array.isArray(shared.questionIds)) {
        return NextResponse.json(
          { error: 'Question bank returned invalid data' },
          { status: 500 }
        );
      }

      questionIds = shared.questionIds;
    } catch (error) {
      console.error('getSharedQuestions failed:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to load shared questions';

      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (questionIds.length !== 10) {
      return NextResponse.json(
        { error: `Need 10 shared questions, got ${questionIds.length}` },
        { status: 400 }
      );
    }

    const { data: existingPendingMatch } = await supabase
      .from('multiplayer_matches')
      .select('id')
      .eq('player1_id', user.id)
      .eq('player2_id', challengedId)
      .eq('status', 'lobby')
      .maybeSingle();

    if (existingPendingMatch) {
      return NextResponse.json({
        success: true,
        matchId: existingPendingMatch.id,
        username: challengedUser.username,
      });
    }

    const { data: match, error: matchError } = await supabase
      .from('multiplayer_matches')
      .insert({
        player1_id: user.id,
        player2_id: challengedId,
        sport,
        difficulty,
        question_ids: questionIds,
        current_question_index: 0,
        player1_score: 0,
        player2_score: 0,
        player1_ready: false,
        player2_ready: false,
        status: 'lobby',
        winner_id: null,
        started_at: null,
      })
      .select('id')
      .single();

    if (matchError || !match) {
      console.error('Match insert error:', matchError);
      return NextResponse.json(
        { error: matchError?.message || 'Failed to create match' },
        { status: 500 }
      );
    }

    const { error: expireError } = await supabase
      .from('friend_challenges')
      .update({
        status: 'expired',
        responded_at: new Date().toISOString(),
      })
      .eq('challenger_id', user.id)
      .eq('challenged_id', challengedId)
      .eq('status', 'pending');

    if (expireError) {
      console.error('Challenge expire error:', expireError);
      return NextResponse.json(
        { error: 'Failed to clear old pending challenges' },
        { status: 500 }
      );
    }

    const { data: insertedChallenge, error: insertError } = await supabase
      .from('friend_challenges')
      .insert({
        challenger_id: user.id,
        challenged_id: challengedId,
        sport,
        difficulty,
        status: 'pending',
        match_id: match.id,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Challenge insert error:', insertError);
      return NextResponse.json(
        { error: insertError.message || 'Failed to send challenge' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      challengeId: insertedChallenge.id,
      matchId: match.id,
      username: challengedUser.username,
    });
  } catch (error) {
    console.error('Friend challenge request route error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}