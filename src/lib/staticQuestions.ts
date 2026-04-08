import rawNflQuestions from '@/data/nfl_trivia_1000.json';
import rawNbaQuestions from '@/data/nba_questions_clean.json';
import type { Difficulty, Question, Sport } from '@/types';

type RawNflQuestion = {
  id: number;
  difficulty: string;
  topic: string;
  question: string;
  options: Record<'A' | 'B' | 'C' | 'D', string>;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  answer_text: string;
  explanation: string;
  source: string;
};

type RawNbaQuestion = {
  id: number;
  difficulty: string;
  category: string;
  question: string;
  options: string[];
  answer_index: number;
};

const OPTION_ORDER = ['A', 'B', 'C', 'D'] as const;

export type StaticQuestion = Question & {
  topic?: string;
  category?: string;
  explanation?: string;
  source?: string;
};

function normalizeDifficulty(value: string): Difficulty {
  const normalized = value.toLowerCase();
  if (
    normalized === 'easy' ||
    normalized === 'medium' ||
    normalized === 'hard' ||
    normalized === 'elite'
  ) {
    return normalized;
  }
  return 'medium';
}

function mapRawNflQuestion(raw: RawNflQuestion): StaticQuestion {
  return {
    id: `nfl-${raw.id}`,
    sport: 'nfl',
    difficulty: normalizeDifficulty(raw.difficulty),
    question: raw.question,
    options: OPTION_ORDER.map((key) => raw.options[key]),
    correct_index: OPTION_ORDER.indexOf(raw.correct_answer),
    times_used: 0,
    created_at: new Date(0).toISOString(),
    topic: raw.topic,
    explanation: raw.explanation,
    source: raw.source,
  };
}

function mapRawNbaQuestion(raw: RawNbaQuestion): StaticQuestion {
  return {
    id: `nba-${raw.id}`,
    sport: 'nba',
    difficulty: normalizeDifficulty(raw.difficulty),
    question: raw.question,
    options: raw.options,
    correct_index: raw.answer_index,
    times_used: 0,
    created_at: new Date(0).toISOString(),
    category: raw.category,
  };
}

export const NFL_STATIC_QUESTIONS: StaticQuestion[] =
  (rawNflQuestions as RawNflQuestion[]).map(mapRawNflQuestion);

export const NBA_STATIC_QUESTIONS: StaticQuestion[] =
  (rawNbaQuestions as RawNbaQuestion[]).map(mapRawNbaQuestion);

export const STATIC_QUESTIONS: StaticQuestion[] = [
  ...NFL_STATIC_QUESTIONS,
  ...NBA_STATIC_QUESTIONS,
];

export function getStaticQuestions(
  sport: Sport,
  difficulty: Difficulty,
  count: number,
): StaticQuestion[] {
  const matching = STATIC_QUESTIONS.filter(
    (question) => question.sport === sport && question.difficulty === difficulty,
  );

  return shuffle([...matching]).slice(0, count);
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}