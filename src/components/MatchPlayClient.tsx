'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTier } from '@/lib/elo';
import { SECONDS_PER_QUESTION, calculatePointsFromTimeLeft } from '@/lib/sports';

type MatchRow = {
  id: string;
  player1_id: string;
  player2_id: string;
  sport: string;
  difficulty: string;
  status: string;
  question_ids: string[];
  current_question_index: number;
  player1_score: number;
  player2_score: number;
  player1_ready: boolean;
  player2_ready: boolean;
  started_at: string | null;
  winner_id: string | null;
  created_at: string;
  completed_at: string | null;
  player1_elo_before: number | null;
  player2_elo_before: number | null;
  player1_elo_after: number | null;
  player2_elo_after: number | null;
  player1_elo_change: number | null;
  player2_elo_change: number | null;
};

type QuestionRow = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
};

type ProfileLite = {
  id: string;
  username: string;
  elo: number;
};

type AnswerRow = {
  id: string;
  match_id: string;
  question_index: number;
  player_id: string;
  answer_index: number;
  is_correct: boolean;
  answer_time_left?: number | null;
  created_at: string;
};

type MatchApiPayload = {
  match: MatchRow;
  players: {
    player1: ProfileLite | null;
    player2: ProfileLite | null;
    me: ProfileLite | null;
    opponent: ProfileLite | null;
  };
  questions: QuestionRow[];
  answers: AnswerRow[];
  currentUserId: string;
};

type Props = {
  initialMatch: MatchRow;
  initialQuestions: QuestionRow[];
  currentUserId: string;
  player1Profile: ProfileLite;
  player2Profile: ProfileLite;
};

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function MatchPlayClient({
  initialMatch,
  initialQuestions,
  currentUserId,
  player1Profile,
  player2Profile,
}: Props) {
  const router = useRouter();

  const [match, setMatch] = useState<MatchRow>(initialMatch);
  const [questions, setQuestions] = useState<QuestionRow[]>(initialQuestions);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedQuestionIndexRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  const isPlayer1 = currentUserId === match.player1_id;
  const me = isPlayer1 ? player1Profile : player2Profile;
  const opponent = isPlayer1 ? player2Profile : player1Profile;
  const myScore = isPlayer1 ? match.player1_score : match.player2_score;
  const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;

  const currentIndex = match.current_question_index;
  const currentQuestion = currentIndex < questions.length ? questions[currentIndex] : null;
  const isComplete = match.status === 'complete' || currentIndex >= questions.length;

  const currentRoundAnswers = useMemo(
    () => answers.filter((answer) => answer.question_index === currentIndex),
    [answers, currentIndex]
  );

  const myAnswer = useMemo(
    () => currentRoundAnswers.find((answer) => answer.player_id === currentUserId) ?? null,
    [currentRoundAnswers, currentUserId]
  );

  const opponentAnswer = useMemo(
    () => currentRoundAnswers.find((answer) => answer.player_id !== currentUserId) ?? null,
    [currentRoundAnswers, currentUserId]
  );

  const bothAnswered = Boolean(myAnswer && opponentAnswer);
  const answered = Boolean(myAnswer);
  const selectedWasCorrect = Boolean(myAnswer?.is_correct);
  const earnedPoints =
    myAnswer?.is_correct && typeof myAnswer.answer_time_left === 'number'
      ? calculatePointsFromTimeLeft(myAnswer.answer_time_left)
      : 0;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const applyPayload = useCallback((payload: MatchApiPayload) => {
    setMatch(payload.match);
    setQuestions(payload.questions);
    setAnswers(payload.answers ?? []);

    if (payload.match.current_question_index !== submittedQuestionIndexRef.current) {
      submittedQuestionIndexRef.current = null;
    }
  }, []);

  const refreshMatch = useCallback(
    async (showSpinner = false) => {
      try {
        if (showSpinner) setIsRefreshing(true);

        const res = await fetch(`/api/match/${match.id}`, {
          cache: 'no-store',
        });

        const data = (await res.json()) as MatchApiPayload & { error?: string };

        if (!res.ok) {
          throw new Error(data.error || 'Failed to refresh match');
        }

        applyPayload(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (showSpinner) setIsRefreshing(false);
      }
    },
    [applyPayload, match.id]
  );

  const finalizeMatch = useCallback(async () => {
    if (isCompleting) return;

    try {
      setIsCompleting(true);
      clearTimer();

      const res = await fetch(`/api/match/${match.id}/complete`, {
        method: 'POST',
      });

      const data = (await res.json()) as { match?: MatchRow; error?: string };

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete match');
      }

      if (data.match) {
        setMatch(data.match);
      }

      await refreshMatch();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to complete match');
    } finally {
      setIsCompleting(false);
    }
  }, [clearTimer, isCompleting, match.id, refreshMatch]);

  const submitAnswer = useCallback(
    async (answerIndex: number, answerTimeLeft: number) => {
      if (!currentQuestion || answered || isSubmitting || isComplete) return;
      if (submittedQuestionIndexRef.current === currentIndex) return;

      try {
        submittedQuestionIndexRef.current = currentIndex;
        setIsSubmitting(true);
        setError('');
        clearTimer();

        const res = await fetch(`/api/match/${match.id}/submit-answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answerIndex, timeLeft: answerTimeLeft }),
        });

        const data = (await res.json()) as { match?: MatchRow; error?: string; done?: boolean };

        if (!res.ok) {
          throw new Error(data.error || 'Failed to submit answer');
        }

        if (data.match) {
          setMatch(data.match);
        }

        await refreshMatch();

        if (data.done) {
          await finalizeMatch();
        }
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to submit answer');
        submittedQuestionIndexRef.current = null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [answered, clearTimer, currentIndex, currentQuestion, finalizeMatch, isComplete, isSubmitting, match.id, refreshMatch]
  );

  useEffect(() => {
    mountedRef.current = true;
    void refreshMatch(true);
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer, refreshMatch]);

  useEffect(() => {
    if (isComplete || !currentQuestion || answered) {
      clearTimer();
      return;
    }

    setTimeLeft(SECONDS_PER_QUESTION);
    clearTimer();

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          void submitAnswer(-1, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [answered, clearTimer, currentIndex, currentQuestion, isComplete, submitAnswer]);

  useEffect(() => {
    if (isComplete) return;

    const interval = setInterval(() => {
      void refreshMatch();
    }, 1500);

    return () => clearInterval(interval);
  }, [isComplete, refreshMatch]);

  useEffect(() => {
    if (!isComplete && currentIndex >= questions.length && questions.length > 0) {
      void finalizeMatch();
    }
  }, [currentIndex, finalizeMatch, isComplete, questions.length]);

  if (isCompleting) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-bk-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-bk-gray-muted font-bold">Finalizing match...</p>
      </div>
    );
  }

  if (isComplete) {
    const myEloBefore = isPlayer1 ? match.player1_elo_before : match.player2_elo_before;
    const myEloAfter = isPlayer1 ? match.player1_elo_after : match.player2_elo_after;
    const myEloChange = isPlayer1 ? match.player1_elo_change : match.player2_elo_change;
    const isWin = match.winner_id === currentUserId;
    const isTie = match.winner_id === null;
    const newTier = myEloAfter ? getTier(myEloAfter) : null;

    return (
      <div className="max-w-2xl mx-auto animate-pop-in">
        <div
          className={`rounded-2xl p-8 text-center mb-6 border-2 ${
            isTie
              ? 'border-yellow-500 bg-yellow-900/20'
              : isWin
              ? 'border-green-500 bg-green-900/20'
              : 'border-red-500 bg-red-900/20'
          }`}
        >
          <div className="text-6xl mb-3">{isTie ? '🤝' : isWin ? '🏆' : '😤'}</div>
          <h1
            className={`font-display text-6xl tracking-wide mb-2 ${
              isTie ? 'text-yellow-400' : isWin ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {isTie ? 'TIE GAME' : isWin ? 'YOU WIN!' : 'YOU LOSE'}
          </h1>
          <p className="text-bk-gray-muted text-lg">
            {myScore} – {opponentScore} vs {opponent.username}
          </p>
        </div>

        {myEloAfter !== null && myEloBefore !== null && myEloChange !== null && (
          <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6 mb-6 text-center">
            <p className="text-bk-gray-muted text-xs uppercase tracking-widest font-bold mb-3">
              Rating Change
            </p>
            <div className="flex items-center justify-center gap-6">
              <div>
                <div className="text-bk-gray-muted text-sm mb-1">Before</div>
                <div className="font-display text-4xl text-bk-white">{myEloBefore}</div>
              </div>
              <div>
                <div className={`font-display text-5xl ${myEloChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {myEloChange >= 0 ? '+' : ''}
                  {myEloChange}
                </div>
              </div>
              <div>
                <div className="text-bk-gray-muted text-sm mb-1">After</div>
                <div className="font-display text-4xl" style={{ color: newTier?.color ?? '#F5F0E8' }}>
                  {myEloAfter}
                </div>
              </div>
            </div>
            {newTier && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <span className="text-2xl">{newTier.emoji}</span>
                <span className="font-bold" style={{ color: newTier.color }}>
                  {newTier.label}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5 mb-6">
          <h2 className="font-display text-xl text-bk-white tracking-wide mb-4">QUESTION REVIEW</h2>
          <div className="space-y-3">
            {questions.map((question, index) => {
              const roundAnswer = answers.find(
                (answer) => answer.question_index === index && answer.player_id === currentUserId
              );
              const correct = roundAnswer?.is_correct ?? false;
              const timedOut = roundAnswer?.answer_index === -1;

              return (
                <div key={question.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    {correct ? '✓' : '✗'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-bk-white leading-snug">{question.question}</p>
                    {!correct && (
                      <p className="text-xs text-green-400 mt-0.5">
                        ✓ {question.options[question.correct_index]}
                        {timedOut && <span className="text-bk-gray-muted ml-2">(timed out)</span>}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => router.push('/dashboard/friends')}
            className="flex-1 bg-bk-gold text-bk-black font-display text-2xl tracking-wider py-4 rounded-2xl hover:bg-bk-gold-dark transition-all duration-200 active:scale-95"
          >
            PLAY AGAIN
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 border-2 border-bk-gray-light text-bk-white font-bold rounded-2xl hover:border-bk-gold hover:text-bk-gold transition-all duration-200"
          >
            Home
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-bk-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-bk-gray-muted font-bold">Loading question...</p>
      </div>
    );
  }

  const progress = (currentIndex / questions.length) * 100;
  const timerPct = (timeLeft / SECONDS_PER_QUESTION) * 100;

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-bk-gray-muted text-sm font-bold">
            Q {currentIndex + 1}/{questions.length}
          </span>
          <span className="text-bk-gray-muted text-sm capitalize">
            {match.sport.replace('_', ' ')} · {match.difficulty}
          </span>
          {isRefreshing && <span className="text-xs text-bk-gray-muted">syncing...</span>}
        </div>
        <div className="flex items-center gap-4 text-sm font-bold">
          <span className="text-green-400">You {myScore}</span>
          <span className="text-bk-gray-muted">vs</span>
          <span className="text-red-400">
            {opponentScore} {opponent.username}
          </span>
        </div>
      </div>

      <div className="w-full bg-bk-gray-light rounded-full h-1.5 mb-2">
        <div
          className="h-1.5 rounded-full bg-bk-gold transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 bg-bk-gray rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${
              timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-yellow-500' : 'bg-bk-gold'
            }`}
            style={{ width: `${timerPct}%` }}
          />
        </div>
        <span
          className={`ml-3 font-display text-xl w-6 text-right ${
            timeLeft <= 5 ? 'text-red-400' : 'text-bk-gray-muted'
          }`}
        >
          {answered ? 0 : timeLeft}
        </span>
      </div>

      <div key={currentIndex} className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6 mb-6 animate-pop-in">
        <p className="text-bk-white text-xl font-bold leading-relaxed">{currentQuestion.question}</p>
      </div>

      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, index) => {
          const isSelected = myAnswer?.answer_index === index;
          const isCorrect = index === currentQuestion.correct_index;

          let className = 'answer-btn';
          if (answered) {
            if (isCorrect) className += ' correct';
            else if (isSelected) className += ' wrong';
          }

          return (
            <button
              key={index}
              className={className}
              disabled={answered || isSubmitting}
              onClick={() => void submitAnswer(index, timeLeft)}
            >
              <span className="inline-flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                    answered && isCorrect
                      ? 'bg-green-500 text-white'
                      : answered && isSelected && !isCorrect
                      ? 'bg-red-500 text-white'
                      : 'bg-bk-gray-light text-bk-gray-muted'
                  }`}
                >
                  {OPTION_LABELS[index]}
                </span>
                {option}
              </span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="animate-slide-up">
          {selectedWasCorrect ? (
            <div className="mb-4 text-center">
              <span className="text-green-400 font-bold text-lg">
                ✓ Correct! +{earnedPoints} {earnedPoints === 1 ? 'point' : 'points'}
              </span>
            </div>
          ) : (
            <div className="mb-4 text-center">
              <span className="text-red-400 font-bold text-lg">✗ Wrong</span>
              {myAnswer?.answer_index === -1 && (
                <span className="text-bk-gray-muted text-sm ml-2">(time&apos;s up)</span>
              )}
            </div>
          )}
        </div>
      )}

      {!answered && (
        <div className="text-center text-bk-gray-muted text-sm">Answer before time runs out.</div>
      )}

      {answered && !opponentAnswer && (
        <div className="text-center text-bk-gray-muted text-sm font-bold animate-slide-up">
          Waiting for {opponent.username}...
        </div>
      )}

      {bothAnswered && !isComplete && (
        <div className="text-center text-bk-gray-muted text-sm font-bold animate-slide-up">
          {currentIndex + 1 >= questions.length ? 'Finishing match...' : 'Loading next question...'}
        </div>
      )}

      {error && (
        <div className="mt-4 bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}