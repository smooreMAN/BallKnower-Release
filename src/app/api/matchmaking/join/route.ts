import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canPlayersMatch, getMatchDifficultyFromElo } from '@/lib/multiplayer';
import { getSharedQuestions } from '@/lib/question-bank';

export async function POST(req: NextRequest) {
  try {
    const { sport } = await req.json();

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { data: existingQueue } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (existingQueue?.match_id) {
      return NextResponse.json({
        status: 'matched',
        matchId: existingQueue.match_id,
      });
    }

    if (existingQueue) {
      return NextResponse.json({ status: 'already_in_queue' });
    }

    const { data: queue } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('sport', sport)
      .eq('status', 'searching')
      .is('match_id', null)
      .neq('user_id', user.id)
      .order('created_at', { ascending: true });

    let opponent: {
      id: string;
      user_id: string;
      sport: string;
      elo: number;
      status: string;
      match_id: string | null;
      created_at: string;
    } | null = null;

    if (queue) {
      for (const q of queue) {
        if (
          canPlayersMatch(
            profile.elo,
            q.elo,
            profile.games_played,
            20
          )
        ) {
          opponent = q;
          break;
        }
      }
    }

    if (opponent) {
      const difficulty = getMatchDifficultyFromElo(profile.elo, opponent.elo);

      const { questionIds } = await getSharedQuestions({
        sport,
        difficulty,
        count: 10,
      });

      const { data: match, error: matchError } = await supabase
        .from('multiplayer_matches')
        .insert({
          player1_id: opponent.user_id,
          player2_id: user.id,
          sport,
          difficulty,
          question_ids: questionIds,
        })
        .select()
        .single();

      if (matchError || !match) {
        console.error(matchError);
        return NextResponse.json(
          { error: 'Failed to create match' },
          { status: 500 }
        );
      }

      await supabase
        .from('matchmaking_queue')
        .update({
          status: 'matched',
          match_id: match.id,
        })
        .eq('id', opponent.id);

      return NextResponse.json({
        status: 'matched',
        matchId: match.id,
      });
    }

    const { error: insertError } = await supabase
      .from('matchmaking_queue')
      .insert({
        user_id: user.id,
        sport,
        elo: profile.elo,
        status: 'searching',
      });

    if (insertError) {
      console.error(insertError);
      return NextResponse.json(
        { error: 'Failed to join queue' },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: 'searching' });
  } catch (err) {
    console.error('Matchmaking error:', err);
    return NextResponse.json(
      { error: 'Matchmaking failed' },
      { status: 500 }
    );
  }
}