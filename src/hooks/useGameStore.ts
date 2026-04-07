import { create } from 'zustand';
import type { BotLevel, Difficulty, GameQuestion, GameState, Sport } from '@/types';
import { BOT_CONFIG, getBotLevelForElo, getDifficultyForElo, simulateBotAnswer } from '@/lib/elo';
import { QUESTIONS_PER_GAME, SECONDS_PER_QUESTION, calculatePointsFromTimeLeft } from '@/lib/sports';

interface GameStore {
  game: GameState | null;
  startGame: (sport: Sport, playerElo: number, gamesPlayed: number) => Promise<void>;
  submitAnswer: (answerIndex: number, timeLeft: number) => void;
  nextQuestion: () => void;
  completeGame: () => Promise<{ eloChange: number; newElo: number; result: 'win' | 'loss' | 'tie' } | null>;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,

  startGame: async (sport: Sport, playerElo: number, gamesPlayed: number) => {
    const botLevel: BotLevel = getBotLevelForElo(playerElo);
    const difficulty: Difficulty = getDifficultyForElo(playerElo);
    const botConfig = BOT_CONFIG[botLevel];

    set({
      game: {
        gameId: '',
        sport,
        difficulty,
        questions: [],
        currentIndex: 0,
        playerScore: 0,
        botScore: 0,
        botLevel,
        botName: botConfig.name,
        botElo: botConfig.elo,
        status: 'loading',
        eloBefore: playerElo,
        eloAfter: playerElo,
        eloChange: 0,
      }
    });

    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, difficulty, count: QUESTIONS_PER_GAME }),
      });
      const data = await res.json();

      const questions: GameQuestion[] = data.questions.map((q: GameQuestion) => ({
        ...q,
        playerAnswer: null,
        botAnswer: null,
        answerState: 'unanswered',
        timeSpent: 0,
      }));

      set(state => ({
        game: state.game ? { ...state.game, questions, status: 'playing' } : null
      }));
    } catch (err) {
      console.error('Failed to load questions:', err);
    }
  },

  submitAnswer: (answerIndex: number, timeLeft: number) => {
    const { game } = get();
    if (!game || game.status !== 'playing') return;

    const question = game.questions[game.currentIndex];
    const isCorrect = answerIndex === question.correct_index;

    const botAnswer = simulateBotAnswer(game.botLevel, question.correct_index);
    const botCorrect = botAnswer === question.correct_index;

    const playerPoints = isCorrect ? calculatePointsFromTimeLeft(timeLeft) : 0;

    const botTimeLeft = botCorrect
      ? Math.floor(Math.random() * SECONDS_PER_QUESTION) + 1
      : 0;

    const botPoints = botCorrect ? calculatePointsFromTimeLeft(botTimeLeft) : 0;

    const updatedQuestions = [...game.questions];
    updatedQuestions[game.currentIndex] = {
      ...question,
      playerAnswer: answerIndex,
      botAnswer,
      answerState: isCorrect ? 'correct' : 'wrong',
      timeSpent: SECONDS_PER_QUESTION - timeLeft,
    };

    set({
      game: {
        ...game,
        questions: updatedQuestions,
        playerScore: game.playerScore + playerPoints,
        botScore: game.botScore + botPoints,
        status: 'answering',
      }
    });
  },

  nextQuestion: () => {
    const { game } = get();
    if (!game) return;

    const nextIndex = game.currentIndex + 1;

    if (nextIndex >= game.questions.length) {
      set({ game: { ...game, status: 'complete', currentIndex: nextIndex } });
    } else {
      const questions = [...game.questions];
      questions[game.currentIndex] = {
        ...questions[game.currentIndex],
        answerState: questions[game.currentIndex].answerState === 'unanswered'
          ? 'revealed'
          : questions[game.currentIndex].answerState,
      };
      set({ game: { ...game, questions, currentIndex: nextIndex, status: 'playing' } });
    }
  },

  completeGame: async () => {
    const { game } = get();
    if (!game) return null;

    try {
      const res = await fetch('/api/game/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport: game.sport,
          difficulty: game.difficulty,
          playerScore: game.playerScore,
          botScore: game.botScore,
          botLevel: game.botLevel,
          questionIds: game.questions.map(q => q.id),
        }),
      });
      const data = await res.json();

      set(state => ({
        game: state.game ? {
          ...state.game,
          eloChange: data.eloChange,
          eloAfter: data.newElo,
        } : null
      }));

      return { eloChange: data.eloChange, newElo: data.newElo, result: data.result };
    } catch {
      return null;
    }
  },

  resetGame: () => set({ game: null }),
}));