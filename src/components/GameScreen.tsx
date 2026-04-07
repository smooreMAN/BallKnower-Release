'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/hooks/useGameStore';
import { SECONDS_PER_QUESTION, calculatePointsFromTimeLeft } from '@/lib/sports';
import ResultsScreen from './ResultsScreen';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];

export default function GameScreen() {
  const router = useRouter();
  const { game, submitAnswer, nextQuestion, resetGame } = useGameStore();
  const [timeLeft, setTimeLeft] = useState(SECONDS_PER_QUESTION);
  const [showNext, setShowNext] = useState(false);
  const [gameResult, setGameResult] = useState<{ eloChange: number; newElo: number; result: 'win' | 'loss' | 'tie' } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeGame = useGameStore(s => s.completeGame);

  const currentQuestion = game?.questions[game.currentIndex];
  const isAnswering = game?.status === 'answering';
  const isComplete = game?.status === 'complete';

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleTimeUp = useCallback(() => {
    clearTimer();
    submitAnswer(-1, 0);
    setShowNext(true);
  }, [submitAnswer]);

  useEffect(() => {
    if (game?.status !== 'playing') return;
    setTimeLeft(SECONDS_PER_QUESTION);
    setShowNext(false);
    clearTimer();

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearTimer();
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [game?.currentIndex, game?.status, handleTimeUp]);

  useEffect(() => {
    if (isAnswering) {
      clearTimer();
      setShowNext(true);
    }
  }, [isAnswering]);

  useEffect(() => {
    if (isComplete && !gameResult) {
      completeGame().then(result => {
        if (result) setGameResult(result);
      });
    }
  }, [isComplete, gameResult, completeGame]);

  if (!game) {
    router.replace('/dashboard/play');
    return null;
  }

  if (game.status === 'loading') {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-bk-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-bk-gray-muted font-bold">Generating your questions...</p>
      </div>
    );
  }

  if (isComplete) {
    return (
      <ResultsScreen
        game={game}
        result={gameResult}
        onPlayAgain={() => {
          resetGame();
          router.push('/dashboard/play');
        }}
        onHome={() => {
          resetGame();
          router.push('/dashboard');
        }}
      />
    );
  }

  if (!currentQuestion) return null;

  const progress = (game.currentIndex / game.questions.length) * 100;
  const timerPct = (timeLeft / SECONDS_PER_QUESTION) * 100;
  const earnedPoints =
    currentQuestion.answerState === 'correct'
      ? calculatePointsFromTimeLeft(SECONDS_PER_QUESTION - currentQuestion.timeSpent)
      : 0;

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-bk-gray-muted text-sm font-bold">
            Q {game.currentIndex + 1}/{game.questions.length}
          </span>
          <span className="text-bk-gray-muted text-sm capitalize">
            {game.sport.replace('_', ' ')} · {game.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm font-bold">
          <span className="text-green-400">You {game.playerScore}</span>
          <span className="text-bk-gray-muted">vs</span>
          <span className="text-red-400">{game.botScore} {game.botName}</span>
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
            style={{ width: `${timerPct}%` }}
          />
        </div>
        <span className={`ml-3 font-display text-xl w-6 text-right ${timeLeft <= 3 ? 'text-red-400' : 'text-bk-gray-muted'}`}>
          {timeLeft}
        </span>
      </div>

      <div
        key={game.currentIndex}
        className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6 mb-6 animate-pop-in"
      >
        <p className="text-bk-white text-xl font-bold leading-relaxed">
          {currentQuestion.question}
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {currentQuestion.options.map((option, i) => {
          const isSelected = currentQuestion.playerAnswer === i;
          const isCorrect = i === currentQuestion.correct_index;
          const answered = isAnswering || currentQuestion.answerState !== 'unanswered';

          let className = 'answer-btn';
          if (answered) {
            if (isCorrect) className += ' correct';
            else if (isSelected && !isCorrect) className += ' wrong';
          }

          return (
            <button
              key={i}
              className={className}
              disabled={answered}
              onClick={() => {
                if (!answered) {
                  clearTimer();
                  submitAnswer(i, timeLeft);
                }
              }}
            >
              <span className="inline-flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 transition-colors ${
                    answered && isCorrect ? 'bg-green-500 text-white' :
                    answered && isSelected && !isCorrect ? 'bg-red-500 text-white' :
                    'bg-bk-gray-light text-bk-gray-muted'
                  }`}
                >
                  {OPTION_LABELS[i]}
                </span>
                {option}
              </span>

              {answered && currentQuestion.botAnswer === i && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-bk-gray-muted font-bold">
                  🤖
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showNext && (
        <div className="animate-slide-up">
          {currentQuestion.answerState === 'correct' && (
            <div className="mb-4 text-center">
              <span className="text-green-400 font-bold text-lg">
                ✓ Correct! +{earnedPoints} {earnedPoints === 1 ? 'point' : 'points'}
              </span>
            </div>
          )}
          {currentQuestion.answerState === 'wrong' && (
            <div className="mb-4 text-center">
              <span className="text-red-400 font-bold text-lg">✗ Wrong</span>
              {currentQuestion.playerAnswer === -1 && (
                <span className="text-bk-gray-muted text-sm ml-2">(time&apos;s up)</span>
              )}
            </div>
          )}

          <button
            onClick={nextQuestion}
            className="w-full bg-bk-gold text-bk-black font-display text-2xl tracking-wider py-4 rounded-2xl hover:bg-bk-gold-dark transition-all duration-200 active:scale-95"
          >
            {game.currentIndex + 1 >= game.questions.length ? 'SEE RESULTS →' : 'NEXT QUESTION →'}
          </button>
        </div>
      )}
    </div>
  );
}