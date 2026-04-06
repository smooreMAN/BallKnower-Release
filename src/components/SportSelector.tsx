'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Profile, Sport } from '@/types';
import { SPORTS } from '@/lib/sports';
import { getBotLevelForElo, getDifficultyForElo, BOT_CONFIG, getTier } from '@/lib/elo';
import { useGameStore } from '@/hooks/useGameStore';

export default function SportSelector({ profile }: { profile: Profile | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Sport | null>(null);
  const [starting, setStarting] = useState(false);
  const startGame = useGameStore(s => s.startGame);

  const botLevel = profile ? getBotLevelForElo(profile.elo) : 'silver';
  const difficulty = profile ? getDifficultyForElo(profile.elo) : 'medium';
  const botConfig = BOT_CONFIG[botLevel];
  const tier = profile ? getTier(profile.elo) : null;

  const handleStart = async () => {
    if (!selected || !profile) return;
    setStarting(true);
    await startGame(selected, profile.elo, profile.games_played);
    router.push('/dashboard/game');
  };

  return (
    <div className="space-y-6">
      {/* Bot preview */}
      {profile && tier && (
        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-bk-gray-muted uppercase tracking-widest font-bold mb-1">Your Opponent</p>
            <p className="text-bk-white font-bold text-lg">{botConfig.name}</p>
            <p className="text-bk-gray-muted text-sm">{botConfig.description}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-bk-gray-muted uppercase tracking-widest font-bold mb-1">Difficulty</p>
            <p className="text-bk-gold font-bold text-lg capitalize">{difficulty}</p>
            <p className="text-bk-gray-muted text-sm">Elo {botConfig.elo}</p>
          </div>
        </div>
      )}

      {/* Sport grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SPORTS.map(sport => (
          <button
            key={sport.id}
            onClick={() => setSelected(sport.id)}
            className={`p-5 rounded-2xl border-2 text-center transition-all duration-200 hover:scale-105 active:scale-95 ${
              selected === sport.id
                ? 'border-bk-gold bg-bk-gold/10 scale-105'
                : 'border-bk-gray-light bg-bk-gray hover:border-bk-gold/50'
            }`}
          >
            <div className="text-4xl mb-2">{sport.emoji}</div>
            <div className="font-bold text-sm text-bk-white leading-tight">{sport.label}</div>
            <div className="text-xs text-bk-gray-muted mt-1 hidden sm:block">{sport.description}</div>
          </button>
        ))}
      </div>

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={!selected || starting}
        className="w-full bg-bk-gold text-bk-black font-display text-3xl tracking-wider py-5 rounded-2xl hover:bg-bk-gold-dark transition-all duration-200 hover:scale-[1.01] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {starting ? 'LOADING QUESTIONS...' : selected ? `▶ PLAY ${SPORTS.find(s => s.id === selected)?.label.toUpperCase()}` : 'SELECT A SPORT'}
      </button>
    </div>
  );
}
