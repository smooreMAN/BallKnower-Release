'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getTier } from '@/lib/elo';

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

const SECONDS_PER_QUESTION = 15;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [resultMatch, setResultMatch] = useState<MatchRow | null>(
    initialMatch.status === 'complete' ? initialMatch : null
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeredQuestionIndexRef = useRef<number | null>(null);

  const isPlayer1 = currentUserId === match.player1_id;
  const me = isPlayer1 ? player1Profile : player2Profile;
  const opponent = isPlayer1 ? player2Profile : player1Profile;

  const myScore = isPlayer1 ? match.player1_score : match.player2_score;
  const oppScore = isPlayer1 ? match.player2_score : match.player1_score;

  const currentQuestion = useMemo(() => {
    return questions[match.current_question_index] ?? null;
  }, [questions, match.current_question_index]);

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
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
          setMatch(payload.new as MatchRow);
          if ((payload.new as MatchRow).status === 'complete') {
            setResultMatch(payload.new as MatchRow);
            setIsWaiting(false);
            setIsCompleting(false);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, match.id]);

  useEffect(() => {
    if (resultMatch || match.status === 'complete') {
      clearTimer();
      return;
    }

    setTimeLeft(SECONDS_PER_QUESTION);
    setSelectedAnswer(null);
    setIsSubmitting(false);
    answeredQuestionIndexRef.current = null;
    clearTimer();

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();

          if (
            !isWaiting &&
            !isSubmitting &&
            answeredQuestionIndexRef.current !== match.current_question_index
          ) {
            void handleSubmitAnswer(-1);
          }

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [match.current_question_index, match.status, resultMatch]);

  useEffect(() => {
    if (
      !resultMatch &&
      match.current_question_index >= questions.length &&
      match.status !== 'complete' &&
      !isCompleting
    ) {
      clearTimer();
      setIsCompleting(true);

      void fetch(`/api/match/${match.id}/complete`, {
        method: 'POST',
      })
        .then(async (res) => {
          const data = await res.json();
          if (data.match) {
            setResultMatch(data.match as MatchRow);
            setMatch(data.match as MatchRow);
          }
        })
        .finally(() => {
          setIsCompleting(false);
        });
    }
  }, [match, questions.length, resultMatch, isCompleting]);

  const handleSubmitAnswer = async (answerIndex: number) => {
    if (!currentQuestion) return;
    if (isSubmitting || isWaiting) return;
    if (answeredQuestionIndexRef.current === match.current_question_index) return;

    answeredQuestionIndexRef.current = match.current_question_index;
    setSelectedAnswer(answerIndex);
    setIsSubmitting(true);
    clearTimer();

    try {
      const res = await fetch(`/api/match/${match.id}/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerIndex }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(data.error ?? 'Submit failed');
        setIsSubmitting(false);
        return;
      }

      if (data.done) {
        setIsSubmitting(false);
        setIsCompleting(true);

        const completeRes = await fetch(`/api/match/${match.id}/complete`, {
          method: 'POST',
        });

        const completeData = await completeRes.json();

        if (completeData.match) {
          setResultMatch(completeData.match as MatchRow);
          setMatch(completeData.match as MatchRow);
        }

        setIsCompleting(false);
        return;
      }

      if (data.waiting) {
        setIsWaiting(true);
      }

      setIsSubmitting(false);
    } catch (error) {
      console.error('Submit answer failed:', error);
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

  if (resultMatch || match.status === 'complete') {
    const finalMatch = resultMatch ?? match;
    const iAmPlayer1 = currentUserId === finalMatch.player1_id;
    const finalMyScore = iAmPlayer1 ? finalMatch.player1_score : finalMatch.player2_score;
    const finalOppScore = iAmPlayer1 ? finalMatch.player2_score : finalMatch.player1_score;
    const myEloBefore = iAmPlayer1 ? finalMatch.player1_elo_before : finalMatch.player2_elo_before;
    const myEloAfter = iAmPlayer1 ? finalMatch.player1_elo_after : finalMatch.player2_elo_after;
    const myEloChange = iAmPlayer1 ? finalMatch.player1_elo_change : finalMatch.player2_elo_change;
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
              <div className="font-display text-4xl text-bk-white">{myEloBefore ?? me.elo}</div>
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
              <div className="font-display text-4xl" style={{ color: newTier?.color ?? '#F5F0E8' }}>
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

        <div className="flex gap-4">
          <button
            onClick={() => router.push('/dashboard/play')}
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

  const progress = (match.current_question_index / questions.length) * 100;
  const timerPct = (timeLeft / SECONDS_PER_QUESTION) * 100;

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-bk-gray-muted text-sm font-bold">
            Q {match.current_question_index + 1}/{questions.length}
          </span>
          <span className="text-bk-gray-muted text-sm capitalize">
            {match.sport.replace('_', ' ')} · {match.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm font-bold">
          <span className="text-green-400">
            {me.username} {myScore}
          </span>
          <span className="text-bk-gray-muted">vs</span>
          <span className="text-red-400">
            {oppScore} {opponent.username}
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
          {timeLeft}
        </span>
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6 mb-6 animate-pop-in">
        <p className="text-bk-white text-xl font-bold leading-relaxed">{currentQuestion.question}</p>
      </div>

      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, i) => {
          const isSelected = selectedAnswer === i;
          const answered = selectedAnswer !== null;

          let className = 'answer-btn';
          if (answered && isSelected) {
            className += ' wrong';
          }

          return (
            <button
              key={i}
              className={className}
              disabled={answered || isSubmitting || isWaiting}
              onClick={() => void handleSubmitAnswer(i)}
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

      {isWaiting && (
        <div className="text-center">
          <span className="text-bk-gray-muted font-bold">Waiting for opponent...</span>
        </div>
      )}
    </div>
  );
}