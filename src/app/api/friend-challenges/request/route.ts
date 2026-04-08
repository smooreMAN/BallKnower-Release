import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    const { data: existingChallenge, error: existingChallengeError } = await supabase
      .from('friend_challenges')
      .select('id, status')
      .eq('challenger_id', user.id)
      .eq('challenged_id', challengedId)
      .in('status', ['pending', 'accepted'])
      .maybeSingle();

    if (existingChallengeError) {
      console.error('Existing challenge lookup error:', existingChallengeError);
      return NextResponse.json({ error: 'Failed to check existing challenges' }, { status: 500 });
    }

    if (existingChallenge) {
      return NextResponse.json({ error: 'Challenge already exists' }, { status: 400 });
    }

    const { data: insertedChallenge, error: insertError } = await supabase
      .from('friend_challenges')
      .insert({
        challenger_id: user.id,
        challenged_id: challengedId,
        sport,
        difficulty,
        status: 'pending',
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
      username: challengedUser.username,
    });
  } catch (error) {
    console.error('Friend challenge request route error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}