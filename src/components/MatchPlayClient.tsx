'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

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
};

type QuestionRow = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
};

type Props = {
  currentUserId: string;
  initialMatch: MatchRow;
  questions: QuestionRow[];
};

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const SECONDS_PER_QUESTION = 10;

export default function MatchPlayClient({
  currentUserId,
  initialMatch,
  questions,
}: Props) {
  const router = useRouter();

  const [match, setMatch] = useState<MatchRow>(initialMatch);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasSubmittedThisQuestion, setHasSubmittedThisQuestion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [error, setError] = useState('');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceInFlightRef = useRef(false);
  const hasUnmountedRef = useRef(false);
  const lastQuestionIndexRef = useRef<number>(initialMatch.current_question_index);

  const myScore =
    currentUserId === match.player1_id ? match.player1_score : match.player2_score;

  const opponentScore =
    currentUserId === match.player1_id ? match.player2_score : match.player1_score;

  const currentQuestion = useMemo(() => {
    return questions[match.current_question_index] ?? null;
  }, [questions, match.current_question_index]);

  const isFinished = match.status === 'completed' || !!match.winner_id;

  const resultText = useMemo(() => {
    if (!isFinished) return null;
    if (!match.winner_id) return 'TIE GAME';
    return match.winner_id === currentUserId ? 'YOU WIN' : 'YOU LOSE';
  }, [isFinished, match.winner_id, currentUserId]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resetForNewQuestion = useCallback((newIndex: number) => {
    lastQuestionIndexRef.current = newIndex;
    setSelectedAnswer(null);
    setHasSubmittedThisQuestion(false);
    setIsSubmitting(false);
    setWaitingForOpponent(false);
    setError('');
    setTimeLeft(SECONDS_PER_QUESTION);
    advanceInFlightRef.current = false;
  }, []);

  const fetchLatestMatch = useCallback(async () => {
    try {
      const res = await fetch(`/api/match/${match.id}`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!res.ok) return null;

      const data = await res.json().catch(() => null);
      if (!data?.match) return null;

      const latest = data.match as MatchRow;

      if (!hasUnmountedRef.current) {
        setMatch(latest);

        if (latest.current_question_index !== lastQuestionIndexRef.current) {
          resetForNewQuestion(latest.current_question_index);
        }

        if (latest.status === 'completed' || latest.winner_id) {
          clearTimer();
          setWaitingForOpponent(false);
          setIsSubmitting(false);
          advanceInFlightRef.current = false;
        }
      }

      return latest;
    } catch (err) {
      console.error('Polling match failed:', err);
      return null;
    }
  }, [match.id, clearTimer, resetForNewQuestion]);

  const tryAdvanceMatch = useCallback(async () => {
    if (advanceInFlightRef.current) return;

    advanceInFlightRef.current = true;

    try {
      const res = await fetch(`/api/match/${match.id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIndex: lastQuestionIndexRef.current,
        }),
      });

      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.match && !hasUnmountedRef.current) {
          const latest = data.match as MatchRow;
          setMatch(latest);

          if (latest.current_question_index !== lastQuestionIndexRef.current) {
            resetForNewQuestion(latest.current_question_index);
          }

          if (latest.status === 'completed' || latest.winner_id) {
            clearTimer();
            setWaitingForOpponent(false);
            setIsSubmitting(false);
          }
        }
      }
    } catch (err) {
      console.error('Advance match failed:', err);
    } finally {
      advanceInFlightRef.current = false;
    }
  }, [match.id, clearTimer, resetForNewQuestion]);

  const submitAnswer = async (answerIndex: number) => {
    if (!currentQuestion) return;
    if (hasSubmittedThisQuestion || isSubmitting || isFinished) return;

    setError('');
    setSelectedAnswer(answerIndex);
    setHasSubmittedThisQuestion(true);
    setIsSubmitting(true);
    setWaitingForOpponent(true);
    clearTimer();

    try {
      const res = await fetch(`/api/match/${match.id}/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIndex: match.current_question_index,
          answerIndex,
          questionId: currentQuestion.id,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || 'Failed to submit answer');
        setWaitingForOpponent(false);
        setIsSubmitting(false);
        return;
      }

      await fetchLatestMatch();
      await tryAdvanceMatch();
      await fetchLatestMatch();
    } catch (err) {
      console.error('Submit answer failed:', err);
      setError('Failed to submit answer');
      setWaitingForOpponent(false);
      setIsSubmitting(false);
    }
  };

  const handleTimeUp = useCallback(async () => {
    if (!currentQuestion) return;
    if (hasSubmittedThisQuestion || isFinished) return;

    setError('');
    setSelectedAnswer(null);
    setHasSubmittedThisQuestion(true);
    setIsSubmitting(true);
    setWaitingForOpponent(true);
    clearTimer();

    try {
      const res = await fetch(`/api/match/${match.id}/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionIndex: match.current_question_index,
          answerIndex: -1,
          questionId: currentQuestion.id,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || 'Failed to submit timeout answer');
        setWaitingForOpponent(false);
        setIsSubmitting(false);
        return;
      }

      await fetchLatestMatch();
      await tryAdvanceMatch();
      await fetchLatestMatch();
    } catch (err) {
      console.error('Timeout submit failed:', err);
      setError('Failed to submit timeout answer');
      setWaitingForOpponent(false);
      setIsSubmitting(false);
    }
  }, [
    currentQuestion,
    hasSubmittedThisQuestion,
    isFinished,
    clearTimer,
    match.id,
    match.current_question_index,
    fetchLatestMatch,
    tryAdvanceMatch,
  ]);

  useEffect(() => {
    hasUnmountedRef.current = false;
    return () => {
      hasUnmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    if (!currentQuestion) return;
    if (isFinished) return;
    if (hasSubmittedThisQuestion) return;

    clearTimer();
    setTimeLeft(SECONDS_PER_QUESTION);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          void handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [
    match.current_question_index,
    currentQuestion,
    isFinished,
    hasSubmittedThisQuestion,
    handleTimeUp,
    clearTimer,
  ]);

  useEffect(() => {
    clearPoll();

    pollRef.current = setInterval(async () => {
      const latest = await fetchLatestMatch();

      if (!latest) return;

      if (
        waitingForOpponent &&
        !latest.winner_id &&
        latest.status !== 'completed'
      ) {
        await tryAdvanceMatch();
      }
    }, 1000);

    return clearPoll;
  }, [fetchLatestMatch, tryAdvanceMatch, waitingForOpponent, clearPoll]);

  useEffect(() => {
    if (isFinished) {
      clearTimer();
      setWaitingForOpponent(false);
      setIsSubmitting(false);
    }
  }, [isFinished, clearTimer]);

  const progress = questions.length
    ? ((match.current_question_index + 1) / questions.length) * 100
    : 0;

  if (!currentQuestion && !isFinished) {
    return (
      <div className="animate-slide-up">
        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-8 text-center">
          <div className="w-10 h-10 mx-auto mb-4 border-4 border-bk-gold border-t-transparent rounded-full animate-spin" />
          <h1 className="font-display text-4xl text-bk-white mb-2">LOADING MATCH</h1>
          <p className="text-bk-gray-muted">Getting the next question ready...</p>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto animate-pop-in">
        <div
          className={`rounded-2xl p-8 text-center mb-6 border-2 ${
            match.winner_id === currentUserId
              ? 'border-green-500 bg-green-900/20'
              : match.winner_id
                ? 'border-red-500 bg-red-900/20'
                : 'border-yellow-500 bg-yellow-900/20'
          }`}
        >
          <div className="text-6xl mb-3">
            {match.winner_id === currentUserId ? '🏆' : match.winner_id ? '😤' : '🤝'}
          </div>
          <h1
            className={`font-display text-6xl tracking-wide mb-2 ${
              match.winner_id === currentUserId
                ? 'text-green-400'
                : match.winner_id
                  ? 'text-red-400'
                  : 'text-yellow-400'
            }`}
          >
            {resultText}
          </h1>
          <p className="text-bk-gray-muted text-lg">
            Final Score: {myScore} - {opponentScore}
          </p>
        </div>

        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6 mb-6 text-center">
          <p className="text-xs uppercase tracking-widest text-bk-gray-muted font-bold mb-3">
            Match Summary
          </p>
          <div className="flex items-center justify-center gap-8">
            <div>
              <div className="text-bk-gray-muted text-sm mb-1">You</div>
              <div className="font-display text-5xl text-green-400">{myScore}</div>
            </div>
            <div className="text-bk-gray-muted font-display text-4xl">VS</div>
            <div>
              <div className="text-bk-gray-muted text-sm mb-1">Opponent</div>
              <div className="font-display text-5xl text-red-400">{opponentScore}</div>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex-1 bg-bk-gold text-bk-black font-display text-2xl tracking-wider py-4 rounded-2xl hover:bg-bk-gold-dark transition-all duration-200 active:scale-95"
          >
            HOME
          </button>
          <button
            onClick={() => router.push('/dashboard/friends')}
            className="px-6 border-2 border-bk-gray-light text-bk-white font-bold rounded-2xl hover:border-bk-gold hover:text-bk-gold transition-all duration-200"
          >
            Friends
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-bk-gray-muted text-sm font-bold">
            Q {Math.min(match.current_question_index + 1, questions.length)}/{questions.length}
          </span>
          <span className="text-bk-gray-muted text-sm capitalize">
            {match.sport.replace('_', ' ')} · {match.difficulty}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm font-bold">
          <span className="text-green-400">You {myScore}</span>
          <span className="text-bk-gray-muted">vs</span>
          <span className="text-red-400">{opponentScore} Opponent</span>
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
              timeLeft <= 3 ? 'bg-red-500' : timeLeft <= 6 ? 'bg-yellow-500' : 'bg-bk-gold'
            }`}
            style={{ width: `${(timeLeft / SECONDS_PER_QUESTION) * 100}%` }}
          />
        </div>
        <span
          className={`ml-3 font-display text-xl w-6 text-right ${
            timeLeft <= 3 ? 'text-red-400' : 'text-bk-gray-muted'
          }`}
        >
          {timeLeft}
        </span>
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6 mb-6 animate-pop-in">
        <p className="text-bk-white text-xl font-bold leading-relaxed">
          {currentQuestion?.question}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {currentQuestion?.options.map((option, i) => {
          const isSelected = selectedAnswer === i;
          const disabled = hasSubmittedThisQuestion || isSubmitting;

          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => void submitAnswer(i)}
              className={`answer-btn ${isSelected ? 'border-bk-gold bg-bk-gold/10' : ''}`}
            >
              <span className="inline-flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 bg-bk-gray-light text-bk-gray-muted">
                  {OPTION_LABELS[i]}
                </span>
                {option}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {waitingForOpponent && (
        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5 text-center animate-slide-up">
          <div className="w-8 h-8 mx-auto mb-3 border-4 border-bk-gold border-t-transparent rounded-full animate-spin" />
          <p className="font-bold text-bk-white mb-1">Answer locked in</p>
          <p className="text-bk-gray-muted text-sm">Waiting for the other player...</p>
        </div>
      )}
    </div>
  );
}