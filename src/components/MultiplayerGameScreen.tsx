'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Player = {
  id: string;
  username: string;
  elo: number;
  games_played: number;
  wins: number;
  losses: number;
} | null;

type MatchRecord = {
  id: string;
  player1_id: string;
  player2_id: string;
  sport: string;
  difficulty: string;
  question_ids: string[];
  current_question_index: number;
  player1_score: number;
  player2_score: number;
  status: 'active' | 'complete' | 'abandoned';
  winner_id: string | null;
  completed_at: string | null;
  created_at: string;
};

type Question = {
  id: string;
  sport: string;
  difficulty: string;
  question: string;
  options: string[];
  correct_index: number;
  times_used: number;
};

type Answer = {
  id: string;
  match_id: string;
  question_index: number;
  player_id: string;
  answer_index: number;
  is_correct: boolean;
  created_at: string;
};

type InitialData = {
  match: MatchRecord;
  players: {
    player1: Player;
    player2: Player;
    me: Player;
    opponent: Player;
  };
  questions: Question[];
  answers: Answer[];
  currentUserId: string;
};

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const SECONDS_PER_QUESTION = 15;

export default function MultiplayerGameScreen({
  initialData,
}: {
  initialData: InitialData;
}) {
  const router = useRouter();

  const [match, setMatch] = useState<MatchRecord>(initialData.match);
  const [players, setPlayers] = useState(initialData.players);
  const [questions, setQuestions] = useState(initialData.questions);
  const [answers, setAnswers] = useState<Answer[]>(initialData.answers);
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [result, setResult] = useState<null | {
    result: 'win' | 'loss' | 'tie';
    eloChange: number;
    newElo: number;
  }>(null);
  const [error, setError] = useState('');

  const currentIndex = match.current_question_index;
  const currentQuestion = questions[currentIndex];

  const currentQuestionAnswers = useMemo(() => {
    return answers.filter((a) => a.question_index === currentIndex);
  }, [answers, currentIndex]);

  const myAnswer = useMemo(() => {
    return currentQuestionAnswers.find(
      (a) => a.player_id === initialData.currentUserId
    );
  }, [currentQuestionAnswers, initialData.currentUserId]);

  const opponentAnswer = useMemo(() => {
    return currentQuestionAnswers.find(
      (a) => a.player_id !== initialData.currentUserId
    );
  }, [currentQuestionAnswers, initialData.currentUserId]);

  const bothAnswered = Boolean(myAnswer && opponentAnswer);
  const iAmPlayer1 = initialData.currentUserId === match.player1_id;
  const myScore = iAmPlayer1 ? match.player1_score : match.player2_score;
  const opponentScore = iAmPlayer1 ? match.player2_score : match.player1_score;

  const refreshMatch = async () => {
    try {
      setLoadingRefresh(true);
      const res = await fetch(`/api/match/${match.id}`, { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to refresh match');
      }

      setMatch(data.match);
      setPlayers(data.players);
      setQuestions(data.questions);
      setAnswers(data.answers ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRefresh(false);
    }
  };

  const submitAnswer = async (answerIndex: number) => {
    if (!currentQuestion || myAnswer || submitting || match.status !== 'active') {
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const res = await fetch(`/api/match/${match.id}/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerIndex }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit answer');
      }

      await refreshMatch();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const advanceQuestion = async () => {
    if (!bothAnswered || advancing || match.status !== 'active') return;

    try {
      setAdvancing(true);
      setError('');

      const isLastQuestion = currentIndex >= questions.length - 1;
      const endpoint = isLastQuestion
        ? `/api/match/${match.id}/complete`
        : `/api/match/${match.id}/advance`;

      const res = await fetch(endpoint, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to continue');
      }

      if (isLastQuestion) {
        if (data.result) {
          setResult(data.result);
        }
        await refreshMatch();
        return;
      }

      setTimeLeft(SECONDS_PER_QUESTION);
      await refreshMatch();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to continue');
    } finally {
      setAdvancing(false);
    }
  };

  useEffect(() => {
    if (match.status !== 'active') return;
    if (myAnswer) return;
    if (!currentQuestion) return;

    setTimeLeft(SECONDS_PER_QUESTION);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          void submitAnswer(-1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentIndex, match.status]);

  useEffect(() => {
    if (match.status !== 'active') return;

    const interval = setInterval(() => {
      void refreshMatch();
    }, 2000);

    return () => clearInterval(interval);
  }, [match.id, match.status]);

  useEffect(() => {
    if (!bothAnswered || match.status !== 'active') return;

    const timeout = setTimeout(() => {
      void advanceQuestion();
    }, 2500);

    return () => clearTimeout(timeout);
  }, [bothAnswered, currentIndex, match.status]);

  if (!currentQuestion && match.status !== 'complete') {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="w-12 h-12 border-4 border-bk-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-bk-gray-muted">Loading match...</p>
      </div>
    );
  }

  if (match.status === 'complete') {
    const banner =
      result?.result === 'win'
        ? { title: 'YOU WIN!', emoji: '🏆', color: 'text-green-400', border: 'border-green-500 bg-green-900/20' }
        : result?.result === 'loss'
        ? { title: 'YOU LOSE', emoji: '😤', color: 'text-red-400', border: 'border-red-500 bg-red-900/20' }
        : { title: 'TIE GAME', emoji: '🤝', color: 'text-yellow-400', border: 'border-yellow-500 bg-yellow-900/20' };

    return (
      <div className="max-w-2xl mx-auto animate-pop-in">
        <div className={`rounded-2xl p-8 text-center mb-6 border-2 ${banner.border}`}>
          <div className="text-6xl mb-3">{banner.emoji}</div>
          <h1 className={`font-display text-6xl tracking-wide mb-2 ${banner.color}`}>
            {banner.title}
          </h1>
          <p className="text-bk-gray-muted text-lg">
            {myScore} - {opponentScore} vs {players.opponent?.username ?? 'Opponent'}
          </p>
        </div>

        {result && (
          <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6 mb-6 text-center">
            <p className="text-bk-gray-muted text-xs uppercase tracking-widest font-bold mb-3">
              Rating Change
            </p>
            <div className="font-display text-5xl text-bk-gold mb-2">
              {result.eloChange >= 0 ? '+' : ''}
              {result.eloChange}
            </div>
            <div className="text-bk-white text-lg">New Elo: {result.newElo}</div>
          </div>
        )}

        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5 mb-6">
          <h2 className="font-display text-xl text-bk-white tracking-wide mb-4">
            QUESTION REVIEW
          </h2>
          <div className="space-y-3">
            {questions.map((q, i) => {
              const mine = answers.find(
                (a) => a.question_index === i && a.player_id === initialData.currentUserId
              );
              const correct = mine?.is_correct ?? false;

              return (
                <div key={q.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}
                  >
                    {correct ? '✓' : '✗'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-bk-white leading-snug">{q.question}</p>
                    <p className="text-xs text-green-400 mt-0.5">
                      ✓ {q.options[q.correct_index]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full bg-bk-gold text-bk-black font-display text-2xl tracking-wider py-4 rounded-2xl hover:bg-bk-gold-dark transition-all duration-200 active:scale-95"
        >
          BACK TO HOME
        </button>
      </div>
    );
  }

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
          {loadingRefresh && (
            <span className="text-xs text-bk-gray-muted">syncing...</span>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm font-bold">
          <span className="text-green-400">You {myScore}</span>
          <span className="text-bk-gray-muted">vs</span>
          <span className="text-red-400">
            {opponentScore} {players.opponent?.username ?? 'Opponent'}
          </span>
        </div>
      </div>

      <div className="w-full bg-bk-gray-light rounded-full h-1.5 mb-2">
        <div
          className="h-1.5 rounded-full bg-bk-gold transition-all duration-300"
          style={{ width: `${(currentIndex / questions.length) * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex-1 bg-bk-gray rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-1000 ${
              timeLeft <= 5 ? 'bg-red-500' : timeLeft <= 10 ? 'bg-yellow-500' : 'bg-bk-gold'
            }`}
            style={{ width: `${(timeLeft / SECONDS_PER_QUESTION) * 100}%` }}
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
        <p className="text-bk-white text-xl font-bold leading-relaxed">
          {currentQuestion?.question}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {currentQuestion?.options.map((option, i) => {
          const answered = Boolean(myAnswer);
          const isSelected = myAnswer?.answer_index === i;
          const isCorrect = i === currentQuestion.correct_index;

          let className = 'answer-btn';
          if (bothAnswered) {
            if (isCorrect) className += ' correct';
            else if (isSelected && !isCorrect) className += ' wrong';
          }

          return (
            <button
              key={i}
              className={className}
              disabled={answered || submitting}
              onClick={() => void submitAnswer(i)}
            >
              <span className="inline-flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                    bothAnswered && isCorrect
                      ? 'bg-green-500 text-white'
                      : bothAnswered && isSelected && !isCorrect
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

      {error && (
        <div className="mb-4 bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {!myAnswer && (
        <div className="text-center text-bk-gray-muted text-sm">
          Answer before time runs out.
        </div>
      )}

      {myAnswer && !opponentAnswer && (
        <div className="text-center text-bk-gray-muted text-sm font-bold animate-slide-up">
          Waiting for {players.opponent?.username ?? 'opponent'}...
        </div>
      )}

      {bothAnswered && (
        <div className="animate-slide-up text-center">
          <div className="mb-4">
            {myAnswer?.is_correct ? (
              <span className="text-green-400 font-bold text-lg">✓ Correct! +1 point</span>
            ) : (
              <span className="text-red-400 font-bold text-lg">✗ Wrong</span>
            )}
          </div>

          <button
            onClick={() => void advanceQuestion()}
            disabled={advancing}
            className="w-full bg-bk-gold text-bk-black font-display text-2xl tracking-wider py-4 rounded-2xl hover:bg-bk-gold-dark transition-all duration-200 active:scale-95 disabled:opacity-50"
          >
            {advancing
              ? 'LOADING...'
              : currentIndex + 1 >= questions.length
              ? 'SEE RESULTS →'
              : 'NEXT QUESTION →'}
          </button>
        </div>
      )}
    </div>
  );
}