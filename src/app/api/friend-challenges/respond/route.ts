import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    if (!challenge.match_id) {
      return NextResponse.json({ error: 'Challenge has no match attached' }, { status: 500 });
    }

    const { data: match, error: matchError } = await supabase
      .from('multiplayer_matches')
      .select('id')
      .eq('id', challenge.match_id)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: 'Linked match not found' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('friend_challenges')
      .update({
        status: 'accepted',
        responded_at: new Date().toISOString(),
      })
      .eq('id', challengeId)
      .eq('status', 'pending');

    if (updateError) {
      console.error('friend_challenges update error:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, matchId: match.id });
  } catch (error) {
    console.error('friend challenge respond error', error);

    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}