import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { getTier, getEloProgress, TIERS } from '@/lib/elo';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  const { data: recentGames } = await supabase
    .from('games')
    .select('*')
    .eq('player1_id', user!.id)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: leaderboard } = await supabase
    .from('leaderboard')
    .select('*')
    .limit(5);

  const tier = profile ? getTier(profile.elo) : null;
  const progress = profile ? getEloProgress(profile.elo) : 0;
  const winRate = profile && profile.games_played > 0
    ? Math.round((profile.wins / profile.games_played) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Elo Card */}
      {profile && tier && (
        <div
          className="rounded-2xl p-6 border border-bk-gray-light relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${tier.bgColor} 0%, #111 100%)` }}
        >
          <div className="relative z-10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-bk-gray-muted text-xs uppercase tracking-widest font-bold mb-1">
                  Your Rating
                </p>
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-7xl" style={{ color: tier.color }}>
                    {profile.elo}
                  </span>
                  <span className="text-4xl">{tier.emoji}</span>
                </div>
                <p className="font-bold text-lg mt-1" style={{ color: tier.color }}>
                  {tier.label}
                </p>
              </div>

              <div className="text-right">
                <div className="text-bk-gray-muted text-xs uppercase tracking-widest mb-3">Stats</div>
                <div className="space-y-1 text-sm">
                  <div><span className="text-bk-gray-muted">Games: </span><span className="text-bk-white font-bold">{profile.games_played}</span></div>
                  <div><span className="text-bk-gray-muted">Wins: </span><span className="text-green-400 font-bold">{profile.wins}</span></div>
                  <div><span className="text-bk-gray-muted">Win %: </span><span className="text-bk-white font-bold">{winRate}%</span></div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-5">
              <div className="flex justify-between text-xs text-bk-gray-muted mb-1.5">
                <span>{tier.label}</span>
                <span>{progress}% to next tier</span>
              </div>
              <div className="w-full bg-bk-black/50 rounded-full h-2">
                <div
                  className="h-2 rounded-full transition-all duration-1000"
                  style={{ width: `${progress}%`, background: tier.color }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Play CTA */}
      <Link
        href="/dashboard/play"
        className="block w-full bg-bk-gold text-bk-black font-display text-3xl tracking-wider text-center py-5 rounded-2xl hover:bg-bk-gold-dark transition-all duration-200 hover:scale-[1.01] active:scale-95 animate-gold-pulse"
      >
        ▶ PLAY NOW
      </Link>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Recent Games */}
        <div className="bg-bk-gray rounded-2xl p-5 border border-bk-gray-light">
          <h2 className="font-display text-xl text-bk-white mb-4 tracking-wide">RECENT GAMES</h2>
          {recentGames && recentGames.length > 0 ? (
            <div className="space-y-3">
              {recentGames.map(game => {
                const won = game.winner_id === user!.id;
                const tied = game.winner_id === null;
                return (
                  <div key={game.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${won ? 'bg-green-400' : tied ? 'bg-yellow-400' : 'bg-red-400'}`} />
                      <span className="text-sm text-bk-gray-muted capitalize">{game.sport.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-bk-white font-bold">{game.player1_score}–{game.player2_score}</span>
                      <span className={`font-bold ${game.elo_change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {game.elo_change >= 0 ? '+' : ''}{game.elo_change}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-bk-gray-muted text-sm">No games yet. Play your first match!</p>
          )}
        </div>

        {/* Leaderboard preview */}
        <div className="bg-bk-gray rounded-2xl p-5 border border-bk-gray-light">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-bk-white tracking-wide">TOP PLAYERS</h2>
            <Link href="/dashboard/leaderboard" className="text-bk-gold text-xs font-bold hover:underline">
              Full Board →
            </Link>
          </div>
          {leaderboard && leaderboard.length > 0 ? (
            <div className="space-y-3">
              {leaderboard.map((entry, i) => {
                const t = getTier(entry.elo);
                return (
                  <div key={entry.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-bk-gray-muted text-sm w-5 text-right font-bold">#{i + 1}</span>
                      <span className="text-sm text-bk-white font-medium">{entry.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm" style={{ color: t.color }}>{t.emoji}</span>
                      <span className="text-sm font-bold" style={{ color: t.color }}>{entry.elo}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-bk-gray-muted text-sm">No ranked players yet. Be the first!</p>
          )}
        </div>
      </div>
    </div>
  );
}
