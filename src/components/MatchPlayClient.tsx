'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
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
  const supabase = createClient();

  const [match, setMatch] = useState<MatchRow>(initialMatch);
  const [questions] = useState<QuestionRow[]>(initialQuestions);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [submittedTimeLeft, setSubmittedTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [resultMatch, setResultMatch] = useState<MatchRow | null>(
    initialMatch.status === 'complete' ? initialMatch : null
  );
  const [error, setError] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeredQuestionIndexRef = useRef<number | null>(null);
  const completingRef = useRef(false);

  const isPlayer1 = currentUserId === match.player1_id;
  const me = isPlayer1 ? player1Profile : player2Profile;
  const opponent = isPlayer1 ? player2Profile : player1Profile;

  const myScore = isPlayer1 ? match.player1_score : match.player2_score;
  const oppScore = isPlayer1 ? match.player2_score : match.player1_score;

  const isMatchFinished =
    !!resultMatch ||
    match.status === 'complete' ||
    match.current_question_index >= questions.length;

  const currentQuestion = useMemo(() => {
    if (match.current_question_index >= questions.length) return null;
    return questions[match.current_question_index] ?? null;
  }, [questions, match.current_question_index]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = null;
  };

  const finalizeMatch = async () => {
    if (completingRef.current) return;

    completingRef.current = true;
    setIsCompleting(true);
    clearTimer();

    try {
      const res = await fetch(`/api/match/${match.id}/complete`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete match');
      }

      if (data.match) {
        setMatch(data.match as MatchRow);
        setResultMatch(data.match as MatchRow);
        setIsWaiting(false);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to complete match');
    } finally {
      setIsCompleting(false);
      completingRef.current = false;
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel(`match-${match.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'multiplayer_matches',
          filter: `id=eq.${match.id}`,
        },
        (payload) => {
          const updated = payload.new as MatchRow;
          const previousIndex = match.current_question_index;

          setMatch(updated);

          if (
            updated.status === 'complete' ||
            updated.current_question_index >= questions.length
          ) {
            setResultMatch(updated);
            setIsWaiting(false);
            setIsCompleting(false);
            clearTimer();
            return;
          }

          if (updated.current_question_index !== previousIndex) {
            setSelectedAnswer(null);
            setSubmittedTimeLeft(null);
            setIsSubmitting(false);
            setIsWaiting(false);
            answeredQuestionIndexRef.current = null;
            setError('');
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, match.id, match.current_question_index, questions.length]);

  useEffect(() => {
    if (isMatchFinished) {
      clearTimer();
      return;
    }

    if (!currentQuestion) return;

    setTimeLeft(SECONDS_PER_QUESTION);
    clearTimer();

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();

          if (
            !isSubmitting &&
            !isWaiting &&
            answeredQuestionIndexRef.current !== match.current_question_index
          ) {
            void handleSubmitAnswer(-1, 0);
          }

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [
    match.current_question_index,
    match.status,
    isMatchFinished,
    currentQuestion,
    isSubmitting,
    isWaiting,
  ]);

  useEffect(() => {
    if (
      !resultMatch &&
      (match.status === 'finishing' ||
        match.status === 'complete' ||
        match.current_question_index >= questions.length)
    ) {
      void finalizeMatch();
    }
  }, [match.status, match.current_question_index, questions.length, resultMatch]);

  const handleSubmitAnswer = async (answerIndex: number, answerTimeLeft: number) => {
    if (!currentQuestion) return;
    if (isSubmitting || isWaiting || isCompleting) return;
    if (answeredQuestionIndexRef.current === match.current_question_index) return;
    if (match.status !== 'active' && match.status !== 'finishing') return;

    answeredQuestionIndexRef.current = match.current_question_index;
    setSelectedAnswer(answerIndex);
    setSubmittedTimeLeft(answerTimeLeft);
    setIsSubmitting(true);
    setError('');
    clearTimer();

    try {
      const res = await fetch(`/api/match/${match.id}/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answerIndex,
          timeLeft: answerTimeLeft,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit answer');
      }

      if (data.match) {
        setMatch(data.match as MatchRow);
      }

      if (data.done) {
        setIsSubmitting(false);
        await finalizeMatch();
        return;
      }

      if (data.waiting) {
        setIsWaiting(true);
      } else {
        setIsWaiting(false);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
      answeredQuestionIndexRef.current = null;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCompleting) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-bk-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-bk-gray-muted font-bold">Finalizing match...</p>
      </div>
    );
  }

  if (isMatchFinished) {
    const finalMatch = resultMatch ?? match;
    const finalIsPlayer1 = currentUserId === finalMatch.player1_id;
    const finalMyScore = finalIsPlayer1 ? finalMatch.player1_score : finalMatch.player2_score;
    const finalOppScore = finalIsPlayer1 ? finalMatch.player2_score : finalMatch.player1_score;
    const myEloBefore = finalIsPlayer1
      ? finalMatch.player1_elo_before
      : finalMatch.player2_elo_before;
    const myEloAfter = finalIsPlayer1
      ? finalMatch.player1_elo_after
      : finalMatch.player2_elo_after;
    const myEloChange = finalIsPlayer1
      ? finalMatch.player1_elo_change
      : finalMatch.player2_elo_change;

    const iWon = finalMatch.winner_id === currentUserId;
    const isTie = finalMatch.winner_id === null;
    const newTier = myEloAfter ? getTier(myEloAfter) : null;

    return (
      <div className="max-w-2xl mx-auto animate-pop-in">
        <div
          className={`rounded-2xl p-8 text-center mb-6 border-2 ${
            isTie
              ? 'border-yellow-500 bg-yellow-900/20'
              : iWon
              ? 'border-green-500 bg-green-900/20'
              : 'border-red-500 bg-red-900/20'
          }`}
        >
          <div className="text-6xl mb-3">{isTie ? '🤝' : iWon ? '🏆' : '😤'}</div>
          <h1
            className={`font-display text-6xl tracking-wide mb-2 ${
              isTie ? 'text-yellow-400' : iWon ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {isTie ? 'TIE GAME' : iWon ? 'YOU WIN!' : 'YOU LOSE'}
          </h1>
          <p className="text-bk-gray-muted text-lg">
            {finalMyScore} – {finalOppScore} vs {opponent.username}
          </p>
        </div>

        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6 mb-6 text-center">
          <p className="text-bk-gray-muted text-xs uppercase tracking-widest font-bold mb-3">
            Rating Change
          </p>

          <div className="flex items-center justify-center gap-6">
            <div>
              <div className="text-bk-gray-muted text-sm mb-1">Before</div>
              <div className="font-display text-4xl text-bk-white">
                {myEloBefore ?? me.elo}
              </div>
            </div>

            <div>
              <div
                className={`font-display text-5xl ${
                  (myEloChange ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {(myEloChange ?? 0) >= 0 ? '+' : ''}
                {myEloChange ?? 0}
              </div>
            </div>

            <div>
              <div className="text-bk-gray-muted text-sm mb-1">After</div>
              <div
                className="font-display text-4xl"
                style={{ color: newTier?.color ?? '#F5F0E8' }}
              >
                {myEloAfter ?? me.elo}
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

        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5 mb-6">
          <h2 className="font-display text-xl text-bk-white tracking-wide mb-3">
            MATCH SUMMARY
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bk-black rounded-xl p-4 text-center">
              <p className="text-bk-gray-muted text-xs uppercase tracking-widest font-bold mb-1">
                Your Score
              </p>
              <p className="font-display text-4xl text-green-400">{finalMyScore}</p>
            </div>

            <div className="bg-bk-black rounded-xl p-4 text-center">
              <p className="text-bk-gray-muted text-xs uppercase tracking-widest font-bold mb-1">
                Opponent
              </p>
              <p className="font-display text-4xl text-red-400">{finalOppScore}</p>
            </div>
          </div>

          <p className="text-bk-gray-muted text-sm mt-4 text-center">
            Multiplayer now uses the same speed scoring system as solo:
            <span className="text-bk-white font-bold"> 3 / 2 / 1 points</span> based on how fast you answer.
          </p>
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
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="w-12 h-12 border-4 border-bk-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-bk-gray-muted font-bold">Loading match...</p>
      </div>
    );
  }

  const timerPct = (timeLeft / SECONDS_PER_QUESTION) * 100;
  const selectedWasCorrect =
    selectedAnswer !== null && selectedAnswer === currentQuestion.correct_index;
  const earnedPoints =
    selectedWasCorrect && submittedTimeLeft !== null
      ? calculatePointsFromTimeLeft(submittedTimeLeft)
      : 0;

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
          <span className="text-red-400">
            {oppScore} {opponent.username}
          </span>
        </div>
      </div>

      <div className="w-full bg-bk-gray-light rounded-full h-1.5 mb-2">
        <div
          className="h-1.5 rounded-full bg-bk-gold transition-all duration-300"
          style={{
            width: `${(match.current_question_index / questions.length) * 100}%`,
          }}
        />
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 bg-bk-gray rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${
              timeLeft <= 3 ? 'bg-red-500' : timeLeft <= 6 ? 'bg-yellow-500' : 'bg-bk-gold'
            }`}
            style={{ width: `${timerPct}%` }}
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
          {currentQuestion.question}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, i) => {
          const isSelected = selectedAnswer === i;
          const answered = selectedAnswer !== null;

          let className = 'answer-btn';
          if (answered) {
            if (i === currentQuestion.correct_index) className += ' correct';
            else if (isSelected) className += ' wrong';
          }

          return (
            <button
              key={i}
              className={className}
              disabled={answered || isSubmitting || isWaiting || isCompleting}
              onClick={() => {
                if (!answered) {
                  void handleSubmitAnswer(i, timeLeft);
                }
              }}
            >
              <span className="inline-flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                    answered && i === currentQuestion.correct_index
                      ? 'bg-green-500 text-white'
                      : answered && isSelected && i !== currentQuestion.correct_index
                      ? 'bg-red-500 text-white'
                      : 'bg-bk-gray-light text-bk-gray-muted'
                  }`}
                >
                  {OPTION_LABELS[i]}
                </span>
                {option}
              </span>
            </button>
          );
        })}
      </div>

      {selectedAnswer !== null && (
        <div className="mb-4 text-center">
          {selectedWasCorrect ? (
            <span className="text-green-400 font-bold text-lg">
              ✓ Correct! +{earnedPoints} {earnedPoints === 1 ? 'point' : 'points'}
            </span>
          ) : (
            <span className="text-red-400 font-bold text-lg">
              ✗ Wrong
              {selectedAnswer === -1 ? (
                <span className="text-bk-gray-muted text-sm ml-2">(time&apos;s up)</span>
              ) : null}
            </span>
          )}
        </div>
      )}

      {isWaiting && (
        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5 text-center">
          <div className="w-10 h-10 border-4 border-bk-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-bold text-bk-white">Waiting for {opponent.username}...</p>
          <p className="text-bk-gray-muted text-sm mt-1">
            Scores update automatically when both answers are in.
          </p>
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