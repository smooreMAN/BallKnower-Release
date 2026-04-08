import type { SportConfig } from '@/types';

/**
 * Core sport configuration
 * This drives:
 * - Sport selector UI
 * - Game routing
 * - Question API calls
 */
export const SPORTS: SportConfig[] = [
  {
    id: 'nfl',
    label: 'NFL Football',
    emoji: '🏈',
    description: 'Pro football knowledge',
  },
  {
    id: 'nba',
    label: 'NBA Basketball',
    emoji: '🏀',
    description: 'Hardwood expertise',
  },
  {
    id: 'mlb',
    label: 'MLB Baseball',
    emoji: '⚾',
    description: "America's pastime",
  },
  {
    id: 'nhl',
    label: 'NHL Hockey',
    emoji: '🏒',
    description: 'Ice cold trivia',
  },
  {
    id: 'soccer',
    label: 'Soccer / MLS',
    emoji: '⚽',
    description: 'The beautiful game',
  },
  {
    id: 'college_football',
    label: 'College Football',
    emoji: '🎓',
    description: 'CFB fanatics only',
  },
  {
    id: 'golf',
    label: 'Golf',
    emoji: '⛳',
    description: 'Links knowledge',
  },
  {
    id: 'general',
    label: 'General Sports',
    emoji: '🏆',
    description: 'All sports, all eras',
  },
];

/**
 * Game settings
 */
export const GAME_CONFIG = {
  QUESTIONS_PER_GAME: 10,
  SECONDS_PER_QUESTION: 10,
};

export const QUESTIONS_PER_GAME = GAME_CONFIG.QUESTIONS_PER_GAME;
export const SECONDS_PER_QUESTION = GAME_CONFIG.SECONDS_PER_QUESTION;

/**
 * Points system (speed-based scoring)
 * Faster answer = more points
 */
export function calculatePointsFromTimeLeft(timeLeft: number): number {
  if (timeLeft >= 7) return 3;
  if (timeLeft >= 4) return 2;
  if (timeLeft >= 1) return 1;
  return 0;
}

/**
 * Optional helper
 */
export function getSportById(id: string) {
  return SPORTS.find((s) => s.id === id);
}