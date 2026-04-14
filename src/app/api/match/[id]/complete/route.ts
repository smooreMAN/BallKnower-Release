import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateNewElo } from '@/lib/elo';

type MatchRow = {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  status: string;
  winner_id: string | null;
  player1_elo_before: number | null;
  player2_elo_before: number | null;
  player1_elo_after: number | null;
  player2_elo_after: number | null;
  player1_elo_change: number | null;
  player2_elo_change: number | null;
};

type ProfileRow = {
  id: string;
  elo: number;
  games_played: number;
  wins: number;
  losses: number;
};

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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

    if (
      match.status === 'complete' &&
      match.player1_elo_after !== null &&
      match.player2_elo_after !== null
    ) {
      return NextResponse.json({ match });
    }

    const { data: player1, error: player1Error } = await supabase
      .from('profiles')
      .select('id, elo, games_played, wins, losses')
      .eq('id', match.player1_id)
      .single<ProfileRow>();

    const { data: player2, error: player2Error } = await supabase
      .from('profiles')
      .select('id, elo, games_played, wins, losses')
      .eq('id', match.player2_id)
      .single<ProfileRow>();

    if (player1Error || !player1 || player2Error || !player2) {
      return NextResponse.json({ error: 'Could not load player profiles' }, { status: 500 });
    }

    let player1Actual = 0.5;
    let player2Actual = 0.5;
    let winnerId: string | null = null;

    if (match.player1_score > match.player2_score) {
      player1Actual = 1;
      player2Actual = 0;
      winnerId = match.player1_id;
    } else if (match.player2_score > match.player1_score) {
      player1Actual = 0;
      player2Actual = 1;
      winnerId = match.player2_id;
    }

    const player1EloBefore = player1.elo;
    const player2EloBefore = player2.elo;

    const player1EloAfter = calculateNewElo(
      player1EloBefore,
      player2EloBefore,
      player1Actual,
      player1.games_played
    );

    const player2EloAfter = calculateNewElo(
      player2EloBefore,
      player1EloBefore,
      player2Actual,
      player2.games_played
    );

    const player1EloChange = player1EloAfter - player1EloBefore;
    const player2EloChange = player2EloAfter - player2EloBefore;

    const { error: matchUpdateError } = await supabase
      .from('multiplayer_matches')
      .update({
        status: 'complete',
        winner_id: winnerId,
        completed_at: new Date().toISOString(),
        player1_elo_before: player1EloBefore,
        player2_elo_before: player2EloBefore,
        player1_elo_after: player1EloAfter,
        player2_elo_after: player2EloAfter,
        player1_elo_change: player1EloChange,
        player2_elo_change: player2EloChange,
      })
      .eq('id', id);

    if (matchUpdateError) {
      return NextResponse.json({ error: matchUpdateError.message }, { status: 500 });
    }

    const { error: player1UpdateError } = await supabase
      .from('profiles')
      .update({
        elo: player1EloAfter,
        games_played: player1.games_played + 1,
        wins: player1.wins + (winnerId === player1.id ? 1 : 0),
        losses: player1.losses + (winnerId === player2.id ? 1 : 0),
      })
      .eq('id', player1.id);

    if (player1UpdateError) {
      return NextResponse.json({ error: player1UpdateError.message }, { status: 500 });
    }

    const { error: player2UpdateError } = await supabase
      .from('profiles')
      .update({
        elo: player2EloAfter,
        games_played: player2.games_played + 1,
        wins: player2.wins + (winnerId === player2.id ? 1 : 0),
        losses: player2.losses + (winnerId === player1.id ? 1 : 0),
      })
      .eq('id', player2.id);

    if (player2UpdateError) {
      return NextResponse.json({ error: player2UpdateError.message }, { status: 500 });
    }

    const { data: finalMatch, error: finalMatchError } = await supabase
      .from('multiplayer_matches')
      .select('*')
      .eq('id', id)
      .single<MatchRow>();

    if (finalMatchError || !finalMatch) {
      return NextResponse.json({ error: 'Match completed but could not reload it' }, { status: 500 });
    }

    return NextResponse.json({ match: finalMatch });
  } catch (error) {
    console.error('Multiplayer complete error:', error);
    return NextResponse.json({ error: 'Failed to complete match' }, { status: 500 });
  }
}