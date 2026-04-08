import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { challengedId, sport, difficulty } = await req.json();

    if (!challengedId || !sport || !difficulty) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.id === challengedId) {
      return NextResponse.json({ error: 'You cannot challenge yourself' }, { status: 400 });
    }

    // make sure they are accepted friends
    const { data: friendship, error: friendshipError } = await supabase
      .from('friends')
      .select('id, status, requester_id, addressee_id')
      .eq('status', 'accepted')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${challengedId}),and(requester_id.eq.${challengedId},addressee_id.eq.${user.id})`
      )
      .maybeSingle();

    if (friendshipError) {
      return NextResponse.json({ error: friendshipError.message }, { status: 500 });
    }

    if (!friendship) {
      return NextResponse.json({ error: 'You can only challenge accepted friends' }, { status: 400 });
    }

    // prevent duplicate pending challenge
    const { data: existing } = await supabase
      .from('friend_challenges')
      .select('id')
      .eq('challenger_id', user.id)
      .eq('challenged_id', challengedId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Challenge already sent' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('friend_challenges')
      .insert({
        challenger_id: user.id,
        challenged_id: challengedId,
        sport,
        difficulty,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, challenge: data });
  } catch (error) {
    console.error('friend challenge request error', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}