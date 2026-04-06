# 🏀 BallKnower

Sports trivia. Global Elo rankings. AI-powered questions. Built to ship fast.

---

## Stack

- **Next.js 15** (App Router)
- **Supabase** (Auth + Postgres + Realtime)
- **Anthropic Claude** (AI question generation)
- **Zustand** (game state)
- **Tailwind CSS** (styling)
- **Vercel** (deployment)

---

## Local Setup

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/ballknower
cd ballknower
npm install
```

### 2. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Go to **SQL Editor** → paste the contents of `supabase/migrations/001_initial_schema.sql` → Run
3. Get your keys from **Settings → API**

### 3. Environment Variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
ANTHROPIC_API_KEY=sk-ant-your-key
```

Get your Anthropic API key at [console.anthropic.com](https://console.anthropic.com).

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add the same environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── questions/route.ts     # AI question generation
│   │   └── game/complete/route.ts # Save result + Elo update
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── dashboard/
│       ├── page.tsx               # Home with Elo card
│       ├── play/page.tsx          # Sport selection
│       ├── game/page.tsx          # Active gameplay
│       ├── leaderboard/page.tsx   # Global rankings
│       └── profile/page.tsx       # User stats
├── components/
│   ├── LandingPage.tsx
│   ├── DashboardNav.tsx
│   ├── SportSelector.tsx
│   ├── GameScreen.tsx             # Core game UI
│   └── ResultsScreen.tsx
├── hooks/
│   └── useGameStore.ts            # Zustand game state
├── lib/
│   ├── elo.ts                     # Elo formula + tiers + bots
│   ├── sports.ts                  # Sport configs
│   └── supabase/
│       ├── client.ts              # Browser client
│       └── server.ts              # Server client
└── types/
    └── index.ts                   # All TypeScript types
```

---

## Elo System

- All players start at **1200**
- K-factor: **32** for first 30 games, **16** after
- Formula: `E = 1 / (1 + 10^((opponent - player) / 400))`
- Minimum rating: **400**

| Tier | Range | Label |
|------|-------|-------|
| 🥉 Bronze | 0–1099 | Ball Rookie |
| 🥈 Silver | 1100–1299 | Ball Knower |
| 🥇 Gold | 1300–1499 | Ball Expert |
| 💎 Platinum | 1500–1699 | Ball Genius |
| 👑 Diamond | 1700+ | Ball God |

---

## AI Bots

Bots fill matches when no real player is available. Their difficulty is matched to your Elo:

| Bot | Elo | Accuracy |
|-----|-----|----------|
| BronzeBot | 900 | 45% |
| SilverBot | 1200 | 65% |
| GoldBot | 1400 | 80% |
| DiamondBot | 1800 | 95% |

---

## Phase 2 Roadmap

- [ ] Real-time PvP matchmaking (Supabase Realtime)
- [ ] Image-based questions (identify player/team)
- [ ] Daily challenge mode
- [ ] Streaks + achievements
- [ ] PWA / mobile app wrapper


## NFL Question Bank

This repo now includes a built-in NFL question bank sourced from the uploaded `nfl_trivia_1000.json` set. The included data contains 1,000 multiple-choice NFL questions split across Easy, Medium, and Hard difficulties.

How question loading works now:

1. Pull matching questions from Supabase `questions` cache
2. Fill any remaining NFL gaps from the bundled local NFL question bank
3. Only use Anthropic as a fallback when cache + local bank are not enough

### Seed the bundled NFL set into Supabase

Add this environment variable locally before seeding:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Then run:

```bash
npm run seed:nfl
```

This inserts the local NFL bank into the `questions` table so gameplay can use Supabase-first reads with no AI cost for NFL.
