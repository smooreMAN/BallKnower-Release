import rawNflQuestions from '@/data/nfl_trivia_1000.json';
import type { Difficulty, Question, Sport } from '@/types';

type RawQuestion = {
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

const OPTION_ORDER = ['A', 'B', 'C', 'D'] as const;

export type StaticQuestion = Question & {
  topic?: string;
  explanation?: string;
  source?: string;
};

function normalizeDifficulty(value: string): Difficulty {
  const normalized = value.toLowerCase();
  if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard' || normalized === 'elite') {
    return normalized;
  }
  return 'medium';
}

function mapRawQuestion(raw: RawQuestion): StaticQuestion {
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

export const NFL_STATIC_QUESTIONS: StaticQuestion[] = (rawNflQuestions as RawQuestion[]).map(mapRawQuestion);

export function getStaticQuestions(sport: Sport, difficulty: Difficulty, count: number): StaticQuestion[] {
  if (sport !== 'nfl') return [];

  const matching = NFL_STATIC_QUESTIONS.filter(
    (question) => question.sport === sport && question.difficulty === difficulty,
  );

  return shuffle([...matching]).slice(0, count);
}

export function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
