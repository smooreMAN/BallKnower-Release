import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { Difficulty, Sport } from '@/types';
import { getStaticQuestions, shuffle, type StaticQuestion } from '@/lib/staticQuestions';

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const DIFFICULTY_HINTS: Record<Difficulty, string> = {
  easy:   'General knowledge, famous players, recent championships. Anyone who follows sports casually should know this.',
  medium: 'Requires regular sports fan knowledge. Stats, historical facts, trade details from last 5-10 years.',
  hard:   'Requires deep sports knowledge. Obscure stats, historical records, specific game details.',
  elite:  'Extremely difficult. Only a true sports historian/expert would know this. Specific records, rare facts.',
};

const SPORT_LABELS: Record<Sport, string> = {
  nfl: 'NFL Football',
  nba: 'NBA Basketball',
  mlb: 'MLB Baseball',
  nhl: 'NHL Hockey',
  soccer: 'Soccer (MLS, FIFA, Premier League)',
  college_football: 'College Football (NCAA)',
  golf: 'Professional Golf (PGA Tour)',
  general: 'General Sports (mix of all major sports)',
};

async function generateQuestion(sport: Sport, difficulty: Difficulty) {
  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: `You are a sports trivia expert generating questions for a competitive trivia game called BallKnower.

Generate exactly ONE multiple-choice trivia question. Return ONLY valid JSON with no other text.

Rules:
- 4 answer options (A, B, C, D)
- Exactly one correct answer
- All options plausible but clearly only one is right
- No trick questions — clear factual answers
- No ambiguous "which of the following" style — specific factual questions only
- Options should be similar in length/format

Return this exact JSON structure:
{
  "question": "...",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correct_index": 0
}

correct_index is 0-based (0=A, 1=B, 2=C, 3=D).`,
    messages: [{
      role: 'user',
      content: `Sport: ${SPORT_LABELS[sport]}
Difficulty: ${difficulty.toUpperCase()}
Difficulty guidance: ${DIFFICULTY_HINTS[difficulty]}

Generate a trivia question now.`
    }]
  });

  const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
  const parsed = JSON.parse(text.trim());

  if (!parsed.question || !Array.isArray(parsed.options) || parsed.options.length !== 4 || parsed.correct_index === undefined) {
    throw new Error('Invalid question format from AI');
  }

  return parsed as { question: string; options: string[]; correct_index: number };
}

async function getCachedQuestions(sport: Sport, difficulty: Difficulty, count: number) {
  const supabase = await createClient();

  const { data: cached } = await supabase
    .from('questions')
    .select('*')
    .eq('sport', sport)
    .eq('difficulty', difficulty)
    .order('times_used', { ascending: true })
    .limit(count * 3);

  const shuffled = cached ? shuffle([...cached]) : [];
  const fromCache = shuffled.slice(0, Math.min(count, shuffled.length));

 if (fromCache.length > 0) {
  try {
    await supabase.rpc('increment_question_usage', {
      question_ids: fromCache.map((question) => question.id),
    });
  } catch {
    // ignore
  }
}

  

  return { supabase, fromCache };
}

async function getFreshAiQuestions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sport: Sport,
  difficulty: Difficulty,
  count: number,
) {
  if (count <= 0 || !anthropic) return [];

  const freshQuestions: StaticQuestion[] = [];

  for (let i = 0; i < count; i += 1) {
    try {
      const generated = await generateQuestion(sport, difficulty);
      const { data: saved } = await supabase
        .from('questions')
        .insert({ sport, difficulty, ...generated })
        .select('*')
        .single();

      if (saved) {
        freshQuestions.push(saved as StaticQuestion);
      }
    } catch (error) {
      console.error('Question generation error:', error);
    }
  }

  return freshQuestions;
}

export async function POST(req: NextRequest) {
  try {
    const { sport, difficulty, count = 10 }: { sport: Sport; difficulty: Difficulty; count?: number } = await req.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { supabase: authedSupabase, fromCache } = await getCachedQuestions(sport, difficulty, count);
    const missingAfterCache = count - fromCache.length;

    const localQuestions = getStaticQuestions(sport, difficulty, missingAfterCache);
    const missingAfterLocal = count - fromCache.length - localQuestions.length;

    const freshAiQuestions = await getFreshAiQuestions(
      authedSupabase,
      sport,
      difficulty,
      missingAfterLocal,
    );

    const allQuestions = shuffle([
      ...fromCache,
      ...localQuestions,
      ...freshAiQuestions,
    ]).slice(0, count);

    if (allQuestions.length === 0) {
      return NextResponse.json(
        { error: `No questions available for ${sport} (${difficulty}).` },
        { status: 404 },
      );
    }

    return NextResponse.json({
      questions: allQuestions,
      meta: {
        cacheCount: fromCache.length,
        staticCount: localQuestions.length,
        aiCount: freshAiQuestions.length,
      },
    });
  } catch (err) {
    console.error('Questions API error:', err);
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
  }
}
