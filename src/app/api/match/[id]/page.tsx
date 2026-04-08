import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import MultiplayerGameScreen from '@/components/MultiplayerGameScreen';

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/match/${id}`, {
    headers: {
      cookie: '',
    },
    cache: 'no-store',
  }).catch(() => null);

  if (!res || !res.ok) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <h1 className="font-display text-4xl text-bk-white mb-3">MATCH NOT FOUND</h1>
        <p className="text-bk-gray-muted">This match could not be loaded.</p>
      </div>
    );
  }

  const data = await res.json();

  return <MultiplayerGameScreen initialData={data} />;
}