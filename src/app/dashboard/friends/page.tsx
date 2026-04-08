import { createClient } from '@/lib/supabase/server';
import FriendsClient from './FriendsClient';

export default async function FriendsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('id', user.id)
    .single();

  const { data: incomingRows } = await supabase
    .from('friends')
    .select('id, requester_id, addressee_id, status, created_at, responded_at')
    .eq('addressee_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const { data: acceptedRows } = await supabase
    .from('friends')
    .select('id, requester_id, addressee_id, status, created_at, responded_at')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .eq('status', 'accepted')
    .order('created_at', { ascending: false });

  const { data: incomingChallengeRows } = await supabase
    .from('friend_challenges')
    .select('id, challenger_id, challenged_id, sport, difficulty, status, created_at, responded_at')
    .eq('challenged_id', user.id)
    .eq('status', 'pending')
    .neq('challenger_id', user.id)
    .order('created_at', { ascending: false });

  const incomingIds = [...new Set((incomingRows ?? []).map((row) => row.requester_id))];

  const acceptedFriendIds = [
    ...new Set(
      (acceptedRows ?? []).map((row) =>
        row.requester_id === user.id ? row.addressee_id : row.requester_id
      )
    ),
  ].filter((id) => id !== user.id);

  const challengerIds = [
    ...new Set((incomingChallengeRows ?? []).map((row) => row.challenger_id)),
  ].filter((id) => id !== user.id);

  const allProfileIds = [...new Set([...incomingIds, ...acceptedFriendIds, ...challengerIds])];

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

  const friends = (acceptedRows ?? [])
    .map((row) => {
      const friendId = row.requester_id === user.id ? row.addressee_id : row.requester_id;

      return {
        id: row.id,
        created_at: row.created_at,
        friend: friendId === user.id ? null : profileMap.get(friendId) ?? null,
      };
    })
    .filter((row) => row.friend !== null);

  const incomingChallenges = (incomingChallengeRows ?? []).map((row) => ({
    ...row,
    challenger: profileMap.get(row.challenger_id) ?? null,
  }));

  return (
    <FriendsClient
      currentUserId={user.id}
      currentUsername={profile?.username ?? 'You'}
      incoming={incoming}
      friends={friends}
      incomingChallenges={incomingChallenges}
    />
  );
}