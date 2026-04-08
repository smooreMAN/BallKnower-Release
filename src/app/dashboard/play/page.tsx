import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import SportSelector from '@/components/SportSelector';

export default async function PlayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  return (
    <div className="animate-slide-up">
      <div className="mb-8 flex items-start justify-between gap-4 flex-col sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-5xl text-bk-white tracking-wide mb-2">PLAY VS BOT</h1>
          <p className="text-bk-gray-muted">
            You&apos;ll be matched against a bot at your skill level. Questions adapt to your rating.
          </p>
        </div>

        <Link
          href="/dashboard/matchmaking"
          className="px-5 py-3 border-2 border-bk-gold text-bk-gold font-bold rounded-xl hover:bg-bk-gold hover:text-bk-black transition-all duration-200"
        >
          Go Online →
        </Link>
      </div>

      <SportSelector profile={profile} />
    </div>
  );
}