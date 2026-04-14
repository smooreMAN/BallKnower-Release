import { createClient } from '@/lib/supabase/server';
import SportSelector from '@/components/SportSelector';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      <div className="mb-8">
        <h1 className="font-display text-5xl text-bk-white tracking-wide mb-2">
          PLAY VS BOT
        </h1>
        <p className="text-bk-gray-muted">
          Pick your sport and face a bot at your skill level.
        </p>
      </div>

      <SportSelector profile={profile} />
    </div>
  );
}