import { createClient } from '@/lib/supabase/server';
import FriendsClient from './FriendsClient';

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', user!.id)
    .single();

  const { data: incomingRows } = await supabase
    .from('friends')
    .select('id, requester_id, addressee_id, status, created_at, responded_at')
    .eq('addressee_id', user!.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const { data: acceptedRows } = await supabase
    .from('friends')
    .select('id, requester_id, addressee_id, status, created_at, responded_at')
    .or(`requester_id.eq.${user!.id},addressee_id.eq.${user!.id}`)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });

  const incomingIds = [...new Set((incomingRows ?? []).map((row) => row.requester_id))];

  const acceptedFriendIds = [
    ...new Set(
      (acceptedRows ?? []).map((row) =>
        row.requester_id === user!.id ? row.addressee_id : row.requester_id
      )
    ),
  ];

  const allProfileIds = [...new Set([...incomingIds, ...acceptedFriendIds])];

  let relatedProfiles: { id: string; username: string; elo: number }[] = [];

  if (allProfileIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, elo')
      .in('id', allProfileIds);

    relatedProfiles = data ?? [];
  }

  const profileMap = new Map(relatedProfiles.map((p) => [p.id, p]));

  const incoming = (incomingRows ?? []).map((row) => ({
    ...row,
    requester: profileMap.get(row.requester_id) ?? null,
  }));

  const friends = (acceptedRows ?? []).map((row) => {
    const friendId = row.requester_id === user!.id ? row.addressee_id : row.requester_id;
    return {
      id: row.id,
      created_at: row.created_at,
      friend: profileMap.get(friendId) ?? null,
    };
  });

  return (
    <FriendsClient
      currentUserId={user!.id}
      currentUsername={profile?.username ?? 'You'}
      incoming={incoming}
      friends={friends}
    />
  );
}