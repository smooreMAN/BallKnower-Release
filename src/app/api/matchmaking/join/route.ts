import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { canPlayersMatch, getMatchDifficultyFromElo } from '@/lib/multiplayer';
import { getSharedQuestions } from '@/lib/question-bank';

export async function POST(req: NextRequest) {
  try {
    const { sport } = await req.json();

    if (!sport) {
      return NextResponse.json({ error: 'Sport is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Check if this user is already in queue or already matched
    const { data: existingQueue, error: existingQueueError } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Ignore "no rows" style cases, but fail on real errors if needed
    if (existingQueueError && existingQueueError.code !== 'PGRST116') {
      console.error(existingQueueError);
      return NextResponse.json(
        { error: 'Failed to check existing queue state' },
        { status: 500 }
      );
    }

    // If this user has already been matched, return the match immediately
    if (existingQueue?.match_id) {
      return NextResponse.json({
        status: 'matched',
        matchId: existingQueue.match_id,
      });
    }

    // If they are already searching, let frontend keep polling this endpoint
    if (existingQueue && existingQueue.status === 'searching') {
      return NextResponse.json({ status: 'searching' });
    }

    // Find another searching player in same sport
    const { data: queue, error: queueError } = await supabase
      .from('matchmaking_queue')
      .select('*')
      .eq('sport', sport)
      .eq('status', 'searching')
      .is('match_id', null)
      .neq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (queueError) {
      console.error(queueError);
      return NextResponse.json(
        { error: 'Failed to search matchmaking queue' },
        { status: 500 }
      );
    }

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
        if (canPlayersMatch(profile.elo, q.elo, profile.games_played, 20)) {
          opponent = q;
          break;
        }
      }
    }

    // If opponent found, create active match immediately
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
          status: 'active',
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

      // Mark opponent queue row as matched
      const { error: updateOpponentError } = await supabase
        .from('matchmaking_queue')
        .update({
          status: 'matched',
          match_id: match.id,
        })
        .eq('id', opponent.id);

      if (updateOpponentError) {
        console.error(updateOpponentError);
        return NextResponse.json(
          { error: 'Failed to update opponent queue' },
          { status: 500 }
        );
      }

      // Optional but cleaner: create/update current user's queue row too
      const { error: insertCurrentQueueError } = await supabase
        .from('matchmaking_queue')
        .insert({
          user_id: user.id,
          sport,
          elo: profile.elo,
          status: 'matched',
          match_id: match.id,
        });

      // If insert fails because row already exists, try updating instead
      if (insertCurrentQueueError) {
        const { error: updateCurrentQueueError } = await supabase
          .from('matchmaking_queue')
          .update({
            status: 'matched',
            match_id: match.id,
          })
          .eq('user_id', user.id);

        if (updateCurrentQueueError) {
          console.error(updateCurrentQueueError);
          return NextResponse.json(
            { error: 'Failed to update current user queue' },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        status: 'matched',
        matchId: match.id,
      });
    }

    // No opponent found: put this user into searching queue
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