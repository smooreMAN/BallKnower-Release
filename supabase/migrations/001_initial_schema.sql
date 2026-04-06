-- ============================================================
-- BallKnower Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ── PROFILES ─────────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  elo INTEGER NOT NULL DEFAULT 1200,
  games_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  favourite_sport TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ── GAMES ────────────────────────────────────────────────────
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id UUID NOT NULL REFERENCES profiles(id),
  player2_id UUID REFERENCES profiles(id),        -- NULL = AI bot
  player1_score INTEGER NOT NULL DEFAULT 0,
  player2_score INTEGER NOT NULL DEFAULT 0,
  winner_id UUID REFERENCES profiles(id),          -- NULL = tie or in-progress
  sport TEXT NOT NULL DEFAULT 'general',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  player1_elo_before INTEGER NOT NULL,
  player2_elo_before INTEGER NOT NULL DEFAULT 1200,
  elo_change INTEGER NOT NULL DEFAULT 0,            -- change applied to player1
  is_vs_bot BOOLEAN NOT NULL DEFAULT true,
  bot_level TEXT DEFAULT 'silver',                 -- bronze/silver/gold/diamond
  status TEXT NOT NULL DEFAULT 'in_progress',      -- in_progress / complete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own games"
  ON games FOR SELECT USING (
    auth.uid() = player1_id OR auth.uid() = player2_id
  );

CREATE POLICY "Users can create games"
  ON games FOR INSERT WITH CHECK (auth.uid() = player1_id);

CREATE POLICY "Users can update their own games"
  ON games FOR UPDATE USING (auth.uid() = player1_id);

-- ── QUESTION CACHE ───────────────────────────────────────────
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL,       -- ["A", "B", "C", "D"]
  correct_index INTEGER NOT NULL,
  times_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Questions are readable by authenticated users"
  ON questions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Questions can be inserted by authenticated users"
  ON questions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Questions usage can be updated"
  ON questions FOR UPDATE TO authenticated USING (true);

-- ── LEADERBOARD VIEW ─────────────────────────────────────────
CREATE OR REPLACE VIEW leaderboard AS
  SELECT
    id,
    username,
    elo,
    games_played,
    wins,
    losses,
    CASE WHEN games_played > 0 THEN ROUND(wins::NUMERIC / games_played * 100) ELSE 0 END AS win_rate,
    RANK() OVER (ORDER BY elo DESC) AS rank
  FROM profiles
  WHERE games_played > 0
  ORDER BY elo DESC;

-- ── ELO UPDATE FUNCTION ──────────────────────────────────────
-- Call this after a game completes to update both player ratings
CREATE OR REPLACE FUNCTION update_elo_after_game(
  p_game_id UUID
) RETURNS VOID AS $$
DECLARE
  v_game games%ROWTYPE;
  v_p1_elo INTEGER;
  v_p2_elo INTEGER;
  v_k1 INTEGER;
  v_k2 INTEGER;
  v_expected_p1 NUMERIC;
  v_expected_p2 NUMERIC;
  v_actual_p1 NUMERIC;
  v_actual_p2 NUMERIC;
  v_new_p1_elo INTEGER;
  v_new_p2_elo INTEGER;
  v_p1_games INTEGER;
  v_p2_games INTEGER;
BEGIN
  SELECT * INTO v_game FROM games WHERE id = p_game_id;
  
  v_p1_elo := v_game.player1_elo_before;
  v_p2_elo := v_game.player2_elo_before;
  
  -- Get games played for K-factor
  SELECT games_played INTO v_p1_games FROM profiles WHERE id = v_game.player1_id;
  v_p2_games := 30; -- bots always use standard K

  -- K-factor: 32 for new players, 16 for established
  v_k1 := CASE WHEN v_p1_games < 30 THEN 32 ELSE 16 END;
  v_k2 := 16;

  -- Expected scores (Elo formula)
  v_expected_p1 := 1.0 / (1.0 + POWER(10.0, (v_p2_elo - v_p1_elo)::NUMERIC / 400.0));
  v_expected_p2 := 1.0 - v_expected_p1;

  -- Actual scores
  IF v_game.winner_id = v_game.player1_id THEN
    v_actual_p1 := 1.0; v_actual_p2 := 0.0;
  ELSIF v_game.winner_id IS NULL AND v_game.status = 'complete' THEN
    v_actual_p1 := 0.5; v_actual_p2 := 0.5; -- tie
  ELSE
    v_actual_p1 := 0.0; v_actual_p2 := 1.0;
  END IF;

  -- New Elo ratings
  v_new_p1_elo := GREATEST(400, ROUND(v_p1_elo + v_k1 * (v_actual_p1 - v_expected_p1)));
  v_new_p2_elo := GREATEST(400, ROUND(v_p2_elo + v_k2 * (v_actual_p2 - v_expected_p2)));

  -- Update player 1's profile
  UPDATE profiles SET
    elo = v_new_p1_elo,
    games_played = games_played + 1,
    wins = wins + CASE WHEN v_game.winner_id = v_game.player1_id THEN 1 ELSE 0 END,
    losses = losses + CASE WHEN v_game.winner_id IS NOT NULL AND v_game.winner_id != v_game.player1_id THEN 1 ELSE 0 END
  WHERE id = v_game.player1_id;

  -- Update game with elo change
  UPDATE games SET
    elo_change = v_new_p1_elo - v_p1_elo
  WHERE id = p_game_id;

  -- Update player 2 if real player (not bot)
  IF NOT v_game.is_vs_bot AND v_game.player2_id IS NOT NULL THEN
    UPDATE profiles SET
      elo = v_new_p2_elo,
      games_played = games_played + 1,
      wins = wins + CASE WHEN v_game.winner_id = v_game.player2_id THEN 1 ELSE 0 END,
      losses = losses + CASE WHEN v_game.winner_id IS NOT NULL AND v_game.winner_id != v_game.player2_id THEN 1 ELSE 0 END
    WHERE id = v_game.player2_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::TEXT, 8))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── INDEXES ──────────────────────────────────────────────────
CREATE INDEX idx_profiles_elo ON profiles(elo DESC);
CREATE INDEX idx_games_player1 ON games(player1_id, created_at DESC);
CREATE INDEX idx_games_player2 ON games(player2_id, created_at DESC);
CREATE INDEX idx_questions_sport_diff ON questions(sport, difficulty);


-- ── QUESTION USAGE HELPER ───────────────────────────────────
CREATE OR REPLACE FUNCTION increment_question_usage(question_ids UUID[])
RETURNS VOID AS $$
BEGIN
  UPDATE questions
  SET times_used = COALESCE(times_used, 0) + 1
  WHERE id = ANY(question_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
