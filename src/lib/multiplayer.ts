import { calculateNewElo } from '@/lib/elo';
import type { Difficulty } from '@/types';

export function getMatchDifficultyFromElo(eloA: number, eloB: number): Difficulty {
  const avg = Math.round((eloA + eloB) / 2);

  if (avg < 1100) return 'easy';
  if (avg < 1300) return 'medium';
  if (avg < 1550) return 'hard';
  return 'elite';
}

export function getAllowedEloGap(gamesPlayed: number): number {
  if (gamesPlayed < 10) return 300;
  if (gamesPlayed < 25) return 250;
  if (gamesPlayed < 50) return 200;
  return 150;
}

export function canPlayersMatch(
  playerElo: number,
  opponentElo: number,
  playerGamesPlayed: number,
  opponentGamesPlayed: number
): boolean {
  const playerGap = getAllowedEloGap(playerGamesPlayed);
  const opponentGap = getAllowedEloGap(opponentGamesPlayed);
  const allowedGap = Math.max(playerGap, opponentGap);

  return Math.abs(playerElo - opponentElo) <= allowedGap;
}

export function getMatchResult(
  player1Score: number,
  player2Score: number
): {
  player1ActualScore: number;
  player2ActualScore: number;
  winner: 'player1' | 'player2' | 'tie';
} {
  if (player1Score > player2Score) {
    return {
      player1ActualScore: 1,
      player2ActualScore: 0,
      winner: 'player1',
    };
  }

  if (player2Score > player1Score) {
    return {
      player1ActualScore: 0,
      player2ActualScore: 1,
      winner: 'player2',
    };
  }

  return {
    player1ActualScore: 0.5,
    player2ActualScore: 0.5,
    winner: 'tie',
  };
}

export function settleMultiplayerElo(params: {
  player1Elo: number;
  player2Elo: number;
  player1GamesPlayed: number;
  player2GamesPlayed: number;
  player1Score: number;
  player2Score: number;
}) {
  const {
    player1Elo,
    player2Elo,
    player1GamesPlayed,
    player2GamesPlayed,
    player1Score,
    player2Score,
  } = params;

  const result = getMatchResult(player1Score, player2Score);

  const player1NewElo = calculateNewElo(
    player1Elo,
    player2Elo,
    result.player1ActualScore,
    player1GamesPlayed
  );

  const player2NewElo = calculateNewElo(
    player2Elo,
    player1Elo,
    result.player2ActualScore,
    player2GamesPlayed
  );

  return {
    winner: result.winner,
    player1ActualScore: result.player1ActualScore,
    player2ActualScore: result.player2ActualScore,
    player1NewElo,
    player2NewElo,
    player1EloChange: player1NewElo - player1Elo,
    player2EloChange: player2NewElo - player2Elo,
  };
}