import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSharedQuestions } from '@/lib/question-bank';

export async function POST(req: NextRequest) {
  try {
    const { challengeId, action } = await req.json();

    if (!challengeId || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    if (action !== 'accepted' && action !== 'declined') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: challenge, error: challengeError } = await supabase
      .from('friend_challenges')
      .select('*')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: 'Challenge not found' }, { status: 404 });
    }

    if (challenge.challenged_id !== user.id) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
    }

    if (challenge.status !== 'pending') {
      return NextResponse.json({ error: 'Challenge already handled' }, { status: 400 });
    }

    if (challenge.challenger_id === challenge.challenged_id) {
      return NextResponse.json({ error: 'Invalid self challenge' }, { status: 400 });
    }

    if (action === 'declined') {
      const { error } = await supabase
        .from('friend_challenges')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('id', challengeId)
        .eq('status', 'pending');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, removed: true });
    }

    const { questionIds } = await getSharedQuestions({
      sport: challenge.sport,
      difficulty: challenge.difficulty,
      count: 10,
    });

    const { data: match, error: matchError } = await supabase
      .from('multiplayer_matches')
      .insert({
        player1_id: challenge.challenger_id,
        player2_id: challenge.challenged_id,
        sport: challenge.sport,
        difficulty: challenge.difficulty,
        question_ids: questionIds,
        current_question_index: 0,
        player1_score: 0,
        player2_score: 0,
        status: 'active',
        winner_id: null,
      })
      .select()
      .single();

    if (matchError || !match) {
      return NextResponse.json(
        { error: matchError?.message || 'Failed to create match' },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from('friend_challenges')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
        match_id: match.id,
      })
      .eq('id', challengeId)
      .eq('status', 'pending');

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, matchId: match.id });
  } catch (error) {
    console.error('friend challenge respond error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}