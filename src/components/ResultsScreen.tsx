'use client';

import type { GameState } from '@/types';
import { getTier } from '@/lib/elo';

interface Props {
  game: GameState;
  result: { eloChange: number; newElo: number; result: 'win' | 'loss' | 'tie' } | null;
  onPlayAgain: () => void;
  onHome: () => void;
}

export default function ResultsScreen({ game, result, onPlayAgain, onHome }: Props) {
  const isWin = result?.result === 'win';
  const isTie = result?.result === 'tie';
  const isLoss = result?.result === 'loss';

  const newTier = result ? getTier(result.newElo) : null;

  return (
    <div className="max-w-2xl mx-auto animate-pop-in">
      {/* Result banner */}
      <div
        className={`rounded-2xl p-8 text-center mb-6 border-2 ${
          isWin ? 'border-green-500 bg-green-900/20' :
          isTie ? 'border-yellow-500 bg-yellow-900/20' :
          'border-red-500 bg-red-900/20'
        }`}
      >
        <div className="text-6xl mb-3">
          {isWin ? '🏆' : isTie ? '🤝' : '😤'}
        </div>
        <h1 className={`font-display text-6xl tracking-wide mb-2 ${
          isWin ? 'text-green-400' : isTie ? 'text-yellow-400' : 'text-red-400'
        }`}>
          {isWin ? 'YOU WIN!' : isTie ? 'TIE GAME' : 'YOU LOSE'}
        </h1>
        <p className="text-bk-gray-muted text-lg">
          {game.playerScore} – {game.botScore} vs {game.botName}
        </p>
      </div>

      {/* Elo change */}
      {result && (
        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-6 mb-6 text-center">
          <p className="text-bk-gray-muted text-xs uppercase tracking-widest font-bold mb-3">Rating Change</p>
          <div className="flex items-center justify-center gap-6">
            <div>
              <div className="text-bk-gray-muted text-sm mb-1">Before</div>
              <div className="font-display text-4xl text-bk-white">{game.eloBefore}</div>
            </div>
            <div>
              <div className={`font-display text-5xl ${result.eloChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {result.eloChange >= 0 ? '+' : ''}{result.eloChange}
              </div>
            </div>
            <div>
              <div className="text-bk-gray-muted text-sm mb-1">After</div>
              <div className="font-display text-4xl" style={{ color: newTier?.color }}>
                {result.newElo}
              </div>
            </div>
          </div>
          {newTier && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-2xl">{newTier.emoji}</span>
              <span className="font-bold" style={{ color: newTier.color }}>{newTier.label}</span>
            </div>
          )}
        </div>
      )}

      {/* Question review */}
      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5 mb-6">
        <h2 className="font-display text-xl text-bk-white tracking-wide mb-4">QUESTION REVIEW</h2>
        <div className="space-y-3">
          {game.questions.map((q, i) => {
            const correct = q.playerAnswer === q.correct_index;
            const timedOut = q.playerAnswer === -1 || q.playerAnswer === null;
            return (
              <div key={q.id} className="flex items-start gap-3">
                <span className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                  correct ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {correct ? '✓' : '✗'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-bk-white leading-snug">{q.question}</p>
                  {!correct && (
                    <p className="text-xs text-green-400 mt-0.5">
                      ✓ {q.options[q.correct_index]}
                      {timedOut && <span className="text-bk-gray-muted ml-2">(timed out)</span>}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={onPlayAgain}
          className="flex-1 bg-bk-gold text-bk-black font-display text-2xl tracking-wider py-4 rounded-2xl hover:bg-bk-gold-dark transition-all duration-200 active:scale-95"
        >
          PLAY AGAIN
        </button>
        <button
          onClick={onHome}
          className="px-6 border-2 border-bk-gray-light text-bk-white font-bold rounded-2xl hover:border-bk-gold hover:text-bk-gold transition-all duration-200"
        >
          Home
        </button>
      </div>
    </div>
  );
}
