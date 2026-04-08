import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body?.userId;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const cleanedUserId = userId.trim();

    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: authError?.message || 'Unauthorized' },
        { status: 401 }
      );
    }

    if (cleanedUserId === user.id) {
      return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 });
    }

    const { data: targetUser, error: targetError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', cleanedUserId)
      .maybeSingle();

    if (targetError) {
      return NextResponse.json(
        { error: `Target lookup failed: ${targetError.message}` },
        { status: 500 }
      );
    }

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: existingFriend, error: existingFriendError } = await supabase
      .from('friends')
      .select('id, status, requester_id, addressee_id')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${cleanedUserId}),and(requester_id.eq.${cleanedUserId},addressee_id.eq.${user.id})`
      )
      .maybeSingle();

    if (existingFriendError) {
      return NextResponse.json(
        { error: `Existing request lookup failed: ${existingFriendError.message}` },
        { status: 500 }
      );
    }

    if (existingFriend) {
      if (existingFriend.status === 'accepted') {
        return NextResponse.json({ error: 'You are already friends' }, { status: 400 });
      }

      if (existingFriend.status === 'pending') {
        return NextResponse.json({ error: 'A friend request already exists' }, { status: 400 });
      }
    }

    const { error: insertError } = await supabase.from('friends').insert({
      requester_id: user.id,
      addressee_id: cleanedUserId,
      status: 'pending',
    });

    if (insertError) {
      return NextResponse.json(
        { error: `Insert failed: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      username: targetUser.username,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}