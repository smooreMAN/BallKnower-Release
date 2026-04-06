import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateNewElo } from '@/lib/elo';
import type { BotLevel, Sport, Difficulty } from '@/types';
import { BOT_CONFIG } from '@/lib/elo';

export async function POST(req: NextRequest) {
  try {
    const {
      sport,
      difficulty,
      playerScore,
      botScore,
      botLevel,
      questionIds,
    }: {
      sport: Sport;
      difficulty: Difficulty;
      playerScore: number;
      botScore: number;
      botLevel: BotLevel;
      questionIds: string[];
    } = await req.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get current player profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const botConfig = BOT_CONFIG[botLevel];
    const playerEloBefore = profile.elo;
    const botElo = botConfig.elo;

    // Determine winner
    let actualScore: number;
    let winnerId: string | null = null;

    if (playerScore > botScore) {
      actualScore = 1;
      winnerId = user.id;
    } else if (playerScore < botScore) {
      actualScore = 0;
    } else {
      actualScore = 0.5; // tie
    }

    const newElo = calculateNewElo(playerEloBefore, botElo, actualScore, profile.games_played);
    const eloChange = newElo - playerEloBefore;

    // Save game record
    const { data: game } = await supabase
      .from('games')
      .insert({
        player1_id: user.id,
        player1_score: playerScore,
        player2_score: botScore,
        winner_id: winnerId,
        sport,
        difficulty,
        player1_elo_before: playerEloBefore,
        player2_elo_before: botElo,
        elo_change: eloChange,
        is_vs_bot: true,
        bot_level: botLevel,
        status: 'complete',
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Update player profile
    await supabase.from('profiles').update({
      elo: newElo,
      games_played: profile.games_played + 1,
      wins: profile.wins + (actualScore === 1 ? 1 : 0),
      losses: profile.losses + (actualScore === 0 ? 1 : 0),
    }).eq('id', user.id);

    return NextResponse.json({
      gameId: game?.id,
      playerEloBefore,
      eloChange,
      newElo,
      result: actualScore === 1 ? 'win' : actualScore === 0 ? 'loss' : 'tie',
    });
  } catch (err) {
    console.error('Game complete API error:', err);
    return NextResponse.json({ error: 'Failed to save game' }, { status: 500 });
  }
}
