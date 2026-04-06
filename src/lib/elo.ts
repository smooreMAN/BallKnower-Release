import type { BotLevel, Difficulty, EloTier, TierInfo } from '@/types';

// ── Elo Formula ───────────────────────────────────────────────
export function calculateExpectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

export function getKFactor(gamesPlayed: number): number {
  return gamesPlayed < 30 ? 32 : 16;
}

export function calculateNewElo(
  currentElo: number,
  opponentElo: number,
  actualScore: number, // 1 = win, 0.5 = draw, 0 = loss
  gamesPlayed: number
): number {
  const expected = calculateExpectedScore(currentElo, opponentElo);
  const k = getKFactor(gamesPlayed);
  return Math.max(400, Math.round(currentElo + k * (actualScore - expected)));
}

export function getEloChange(
  playerElo: number,
  opponentElo: number,
  actualScore: number,
  gamesPlayed: number
): number {
  const newElo = calculateNewElo(playerElo, opponentElo, actualScore, gamesPlayed);
  return newElo - playerElo;
}

// ── Tier System ───────────────────────────────────────────────
export const TIERS: TierInfo[] = [
  { tier: 'bronze',   label: 'Ball Rookie',   minElo: 0,    maxElo: 1099, color: '#CD7F32', bgColor: '#2D1A0A', emoji: '🥉' },
  { tier: 'silver',   label: 'Ball Knower',   minElo: 1100, maxElo: 1299, color: '#C0C0C0', bgColor: '#1A1A1A', emoji: '🥈' },
  { tier: 'gold',     label: 'Ball Expert',   minElo: 1300, maxElo: 1499, color: '#F5A623', bgColor: '#2A1A00', emoji: '🥇' },
  { tier: 'platinum', label: 'Ball Genius',   minElo: 1500, maxElo: 1699, color: '#3B6EF8', bgColor: '#0A0F2A', emoji: '💎' },
  { tier: 'diamond',  label: 'Ball God',      minElo: 1700, maxElo: 9999, color: '#E879F9', bgColor: '#1A0A2A', emoji: '👑' },
];

export function getTier(elo: number): TierInfo {
  return TIERS.find(t => elo >= t.minElo && elo <= t.maxElo) ?? TIERS[0];
}

export function getEloProgress(elo: number): number {
  const tier = getTier(elo);
  if (tier.tier === 'diamond') return 100;
  const range = tier.maxElo - tier.minElo;
  const progress = elo - tier.minElo;
  return Math.round((progress / range) * 100);
}

// ── Bot System ────────────────────────────────────────────────
export const BOT_CONFIG: Record<BotLevel, {
  name: string;
  elo: number;
  accuracy: number; // 0-1, chance of answering correctly
  description: string;
}> = {
  bronze:  { name: 'BronzeBot',  elo: 900,  accuracy: 0.45, description: 'Just getting started' },
  silver:  { name: 'SilverBot',  elo: 1200, accuracy: 0.65, description: 'Knows the basics' },
  gold:    { name: 'GoldBot',    elo: 1400, accuracy: 0.80, description: 'Tough competition' },
  diamond: { name: 'DiamondBot', elo: 1800, accuracy: 0.95, description: 'Near-perfect recall' },
};

export function getBotLevelForElo(playerElo: number): BotLevel {
  if (playerElo < 1100) return 'bronze';
  if (playerElo < 1350) return 'silver';
  if (playerElo < 1600) return 'gold';
  return 'diamond';
}

export function simulateBotAnswer(botLevel: BotLevel, correctIndex: number): number {
  const { accuracy } = BOT_CONFIG[botLevel];
  if (Math.random() < accuracy) return correctIndex;
  // Pick a random wrong answer
  const wrong = [0, 1, 2, 3].filter(i => i !== correctIndex);
  return wrong[Math.floor(Math.random() * wrong.length)];
}

// ── Difficulty from Elo ───────────────────────────────────────
export function getDifficultyForElo(elo: number): Difficulty {
  if (elo < 1100) return 'easy';
  if (elo < 1350) return 'medium';
  if (elo < 1600) return 'hard';
  return 'elite';
}
