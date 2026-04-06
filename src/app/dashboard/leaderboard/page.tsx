import { createClient } from '@/lib/supabase/server';
import { getTier } from '@/lib/elo';

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: entries } = await supabase
    .from('leaderboard')
    .select('*')
    .limit(50);

  const { data: myRank } = await supabase
    .from('leaderboard')
    .select('rank, elo')
    .eq('id', user!.id)
    .single();

  return (
    <div className="animate-slide-up">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-display text-5xl text-bk-white tracking-wide mb-2">LEADERBOARD</h1>
          <p className="text-bk-gray-muted">Global rankings — updated after every game</p>
        </div>
        {myRank && (
          <div className="text-right">
            <p className="text-bk-gray-muted text-xs uppercase tracking-widest font-bold mb-1">Your Rank</p>
            <p className="font-display text-4xl text-bk-gold">#{myRank.rank}</p>
          </div>
        )}
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-bk-gray-light">
          <div className="col-span-1 text-xs font-bold text-bk-gray-muted uppercase tracking-widest">#</div>
          <div className="col-span-5 text-xs font-bold text-bk-gray-muted uppercase tracking-widest">Player</div>
          <div className="col-span-2 text-xs font-bold text-bk-gray-muted uppercase tracking-widest text-right">Rating</div>
          <div className="col-span-2 text-xs font-bold text-bk-gray-muted uppercase tracking-widest text-right hidden sm:block">Games</div>
          <div className="col-span-2 text-xs font-bold text-bk-gray-muted uppercase tracking-widest text-right hidden sm:block">Win %</div>
        </div>

        {entries && entries.length > 0 ? (
          <div>
            {entries.map((entry, i) => {
              const tier = getTier(entry.elo);
              const isMe = entry.id === user!.id;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;

              return (
                <div
                  key={entry.id}
                  className={`grid grid-cols-12 gap-4 px-5 py-4 border-b border-bk-gray-light/50 transition-colors ${
                    isMe ? 'bg-bk-gold/5 border-l-2 border-l-bk-gold' : 'hover:bg-bk-black/30'
                  }`}
                >
                  <div className="col-span-1 flex items-center">
                    <span className="text-bk-gray-muted font-bold text-sm">
                      {medal || `#${entry.rank}`}
                    </span>
                  </div>
                  <div className="col-span-5 flex items-center gap-3">
                    <span className="text-lg">{tier.emoji}</span>
                    <div>
                      <span className={`font-bold text-sm ${isMe ? 'text-bk-gold' : 'text-bk-white'}`}>
                        {entry.username}
                        {isMe && <span className="ml-2 text-xs text-bk-gold">(you)</span>}
                      </span>
                      <p className="text-xs font-bold" style={{ color: tier.color }}>{tier.label}</p>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center justify-end">
                    <span className="font-display text-xl" style={{ color: tier.color }}>{entry.elo}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end hidden sm:flex">
                    <span className="text-bk-gray-muted text-sm">{entry.games_played}</span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end hidden sm:flex">
                    <span className="text-sm font-bold text-bk-white">{entry.win_rate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <p className="text-bk-gray-muted">No ranked players yet. Play a game to get on the board!</p>
          </div>
        )}
      </div>
    </div>
  );
}
