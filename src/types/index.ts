// ── Database Types ────────────────────────────────────────────
export interface Profile {
  id: string;
  username: string;
  elo: number;
  games_played: number;
  wins: number;
  losses: number;
  favourite_sport: string;
  created_at: string;
}

export interface Game {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  sport: Sport;
  difficulty: Difficulty;
  player1_elo_before: number;
  player2_elo_before: number;
  elo_change: number;
  is_vs_bot: boolean;
  bot_level: BotLevel | null;
  status: 'in_progress' | 'complete';
  created_at: string;
  completed_at: string | null;
}

export interface Question {
  id: string;
  sport: Sport;
  difficulty: Difficulty;
  question: string;
  options: string[];
  correct_index: number;
  times_used: number;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  username: string;
  elo: number;
  games_played: number;
  wins: number;
  losses: number;
  win_rate: number;
  rank: number;
}

// ── Game Types ────────────────────────────────────────────────
export type Sport =
  | 'nfl'
  | 'nba'
  | 'mlb'
  | 'nhl'
  | 'soccer'
  | 'college_football'
  | 'golf'
  | 'general';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'elite';

export type BotLevel = 'bronze' | 'silver' | 'gold' | 'diamond';

export type AnswerState = 'unanswered' | 'correct' | 'wrong' | 'revealed';

export interface GameQuestion extends Question {
  playerAnswer: number | null;
  botAnswer: number | null;
  answerState: AnswerState;
  timeSpent: number; // seconds
}

export interface GameState {
  gameId: string;
  sport: Sport;
  difficulty: Difficulty;
  questions: GameQuestion[];
  currentIndex: number;
  playerScore: number;
  botScore: number;
  botLevel: BotLevel;
  botName: string;
  botElo: number;
  status: 'loading' | 'playing' | 'answering' | 'complete';
  eloBefore: number;
  eloAfter: number;
  eloChange: number;
}

// ── Elo Types ─────────────────────────────────────────────────
export type EloTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface TierInfo {
  tier: EloTier;
  label: string;
  minElo: number;
  maxElo: number;
  color: string;
  bgColor: string;
  emoji: string;
}

// ── Sport Config ──────────────────────────────────────────────
export interface SportConfig {
  id: Sport;
  label: string;
  emoji: string;
  description: string;
}
