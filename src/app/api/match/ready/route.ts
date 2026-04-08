import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { matchId } = await req.json();

    const { data: match } = await supabase
      .from('multiplayer_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const update: any = {};

    if (match.player1_id === user.id) {
      update.player1_ready = true;
    }

    if (match.player2_id === user.id) {
      update.player2_ready = true;
    }

    const { data: updatedMatch } = await supabase
      .from('multiplayer_matches')
      .update(update)
      .eq('id', matchId)
      .select('*')
      .single();

    // If both ready → start game
    if (updatedMatch.player1_ready && updatedMatch.player2_ready) {
      await supabase
        .from('multiplayer_matches')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .eq('id', matchId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}