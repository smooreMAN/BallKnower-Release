import { createClient } from '@/lib/supabase/server';
import { getTier, getEloProgress, TIERS } from '@/lib/elo';
import { SPORTS } from '@/lib/sports';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('player1_id', user!.id)
    .eq('status', 'complete')
    .order('created_at', { ascending: false })
    .limit(20);

  const tier = profile ? getTier(profile.elo) : null;
  const progress = profile ? getEloProgress(profile.elo) : 0;

  // Sport breakdown
  const sportCounts: Record<string, number> = {};
  games?.forEach(g => {
    sportCounts[g.sport] = (sportCounts[g.sport] || 0) + 1;
  });

  const joinDate = profile
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="animate-slide-up space-y-6">
      {/* Profile header */}
      {profile && tier && (
        <div
          className="rounded-2xl p-6 border border-bk-gray-light"
          style={{ background: `linear-gradient(135deg, ${tier.bgColor} 0%, #111 100%)` }}
        >
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
              style={{ background: tier.color + '22', border: `2px solid ${tier.color}` }}
            >
              {tier.emoji}
            </div>
            <div className="flex-1">
              <h1 className="font-display text-4xl text-bk-white tracking-wide">{profile.username}</h1>
              <p className="font-bold" style={{ color: tier.color }}>{tier.label}</p>
              <p className="text-bk-gray-muted text-sm mt-1">Member since {joinDate}</p>
            </div>
            <div className="text-right">
              <div className="font-display text-5xl" style={{ color: tier.color }}>{profile.elo}</div>
              <div className="text-bk-gray-muted text-sm">Rating</div>
            </div>
          </div>

          {/* Tier progress */}
          <div className="mt-5">
            <div className="flex justify-between text-xs text-bk-gray-muted mb-1.5">
              <span>Tier Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-bk-black/50 rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{ width: `${progress}%`, background: tier.color }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      {profile && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Games Played', value: profile.games_played, color: 'text-bk-white' },
            { label: 'Wins', value: profile.wins, color: 'text-green-400' },
            { label: 'Losses', value: profile.losses, color: 'text-red-400' },
            {
              label: 'Win Rate',
              value: profile.games_played > 0 ? `${Math.round(profile.wins / profile.games_played * 100)}%` : '—',
              color: 'text-bk-gold'
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-bk-gray border border-bk-gray-light rounded-xl p-4 text-center">
              <div className={`font-display text-4xl ${color} mb-1`}>{value}</div>
              <div className="text-bk-gray-muted text-xs uppercase tracking-widest font-bold">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tier roadmap */}
      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5">
        <h2 className="font-display text-xl text-bk-white tracking-wide mb-4">TIER ROADMAP</h2>
        <div className="space-y-3">
          {TIERS.map(t => {
            const current = profile && profile.elo >= t.minElo && profile.elo <= t.maxElo;
            const achieved = profile && profile.elo > t.maxElo;
            return (
              <div
                key={t.tier}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all ${
                  current ? 'bg-bk-black border-2' : 'opacity-60'
                }`}
                style={current ? { borderColor: t.color } : {}}
              >
                <span className="text-2xl">{t.emoji}</span>
                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ color: t.color }}>{t.label}</p>
                  <p className="text-xs text-bk-gray-muted">{t.minElo}–{t.tier === 'diamond' ? '∞' : t.maxElo} Elo</p>
                </div>
                {current && <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: t.color + '22', color: t.color }}>Current</span>}
                {achieved && <span className="text-xs font-bold text-green-400">✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sport breakdown */}
      {Object.keys(sportCounts).length > 0 && (
        <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5">
          <h2 className="font-display text-xl text-bk-white tracking-wide mb-4">SPORTS PLAYED</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(sportCounts).map(([sport, count]) => {
              const s = SPORTS.find(s => s.id === sport);
              return (
                <div key={sport} className="text-center p-3 bg-bk-black rounded-xl">
                  <div className="text-2xl mb-1">{s?.emoji || '🏆'}</div>
                  <div className="text-bk-white font-bold text-sm">{count}</div>
                  <div className="text-bk-gray-muted text-xs">{s?.label || sport}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
