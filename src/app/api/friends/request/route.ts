import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId || '').trim();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (user.id === userId) {
      return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 });
    }

    const { data: targetProfile, error: targetError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('id', userId)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('friends')
      .select('id, requester_id, addressee_id, status')
      .or(
        `and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`
      );

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    if (existingRows && existingRows.length > 0) {
      return NextResponse.json({ error: 'Friend request already exists' }, { status: 400 });
    }

    const { error: insertError } = await supabase.from('friends').insert({
      requester_id: user.id,
      addressee_id: userId,
      status: 'pending',
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      username: targetProfile.username,
    });
  } catch (error) {
    console.error('Friend request error:', error);
    return NextResponse.json({ error: 'Failed to send friend request' }, { status: 500 });
  }
}