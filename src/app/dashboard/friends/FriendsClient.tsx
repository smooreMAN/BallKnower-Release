'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type IncomingRequest = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  responded_at: string | null;
  requester: {
    id: string;
    username: string;
    elo: number;
  } | null;
};

type IncomingChallenge = {
  id: string;
  challenger_id: string;
  challenged_id: string;
  sport: string;
  difficulty: string;
  status: string;
  created_at: string;
  responded_at: string | null;
  challenger: {
    id: string;
    username: string;
    elo: number;
  } | null;
};

type FriendItem = {
  id: string;
  created_at: string;
  friend: {
    id: string;
    username: string;
    elo: number;
  } | null;
};

export default function FriendsClient({
  currentUserId,
  currentUsername,
  incoming,
  friends,
  incomingChallenges,
}: {
  currentUserId: string;
  currentUsername: string;
  incoming: IncomingRequest[];
  friends: FriendItem[];
  incomingChallenges: IncomingChallenge[];
}) {
  const router = useRouter();
  const [userIdInput, setUserIdInput] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [challengingId, setChallengingId] = useState<string | null>(null);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setSending(true);

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userIdInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || 'Failed to send request');
        setSending(false);
        return;
      }

      setMessage(`Friend request sent to ${data.username}`);
      setUserIdInput('');
      router.refresh();
    } catch {
      setMessage('Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const handleRespond = async (requestId: string, action: 'accepted' | 'declined') => {
    setWorkingId(requestId);
    setMessage('');

    try {
      const res = await fetch('/api/friends/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || 'Failed to update request');
        setWorkingId(null);
        return;
      }

      setMessage(action === 'accepted' ? 'Friend request accepted' : 'Friend request declined');
      router.refresh();
    } catch {
      setMessage('Failed to update request');
    } finally {
      setWorkingId(null);
    }
  };

  const handleChallenge = async (friendId: string, friendUsername: string) => {
    setChallengingId(friendId);
    setMessage('');

    try {
      const res = await fetch('/api/friend-challenges/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengedId: friendId,
          sport: 'nba',
          difficulty: 'medium',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || 'Failed to send challenge');
        return;
      }

      setMessage(`Challenge sent to ${friendUsername}`);
      router.refresh();
    } catch {
      setMessage('Failed to send challenge');
    } finally {
      setChallengingId(null);
    }
  };

  return (
    <div className="animate-slide-up space-y-6">
      <div>
        <h1 className="font-display text-5xl text-bk-white tracking-wide mb-2">FRIENDS</h1>
        <p className="text-bk-gray-muted">Add people by user ID and build your BallKnower circle.</p>
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5">
        <h2 className="font-display text-2xl text-bk-white mb-4">YOUR FRIEND CODE</h2>
        <div className="bg-bk-black border border-bk-gray-light rounded-xl p-4">
          <p className="text-bk-white font-bold mb-1">{currentUsername}</p>
          <p className="text-bk-gray-muted text-sm break-all">{currentUserId}</p>
        </div>
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5">
        <h2 className="font-display text-2xl text-bk-white mb-4">ADD FRIEND</h2>

        <form onSubmit={handleSendRequest} className="space-y-3">
          <input
            type="text"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            placeholder="Paste a user ID..."
            className="w-full bg-bk-black border-2 border-bk-gray-light rounded-xl px-4 py-3 text-bk-white placeholder-bk-gray-muted focus:outline-none focus:border-bk-gold transition-colors"
          />

          <button
            type="submit"
            disabled={sending || !userIdInput.trim()}
            className="w-full bg-bk-gold text-bk-black font-bold py-3 rounded-xl hover:bg-bk-gold-dark transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Sending...' : 'Send Friend Request'}
          </button>
        </form>

        {message && (
          <div className="mt-4 bg-bk-black border border-bk-gray-light rounded-xl px-4 py-3 text-sm text-bk-white">
            {message}
          </div>
        )}
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5">
        <h2 className="font-display text-2xl text-bk-white mb-4">INCOMING REQUESTS</h2>

        {incoming.length === 0 ? (
          <p className="text-bk-gray-muted">No incoming requests.</p>
        ) : (
          <div className="space-y-3">
            {incoming.map((req) => (
              <div
                key={req.id}
                className="bg-bk-black border border-bk-gray-light rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div>
                  <p className="font-bold text-bk-white">{req.requester?.username ?? 'Unknown user'}</p>
                  <p className="text-sm text-bk-gray-muted">Elo: {req.requester?.elo ?? '—'}</p>
                  <p className="text-xs text-bk-gray-muted break-all mt-1">
                    {req.requester?.id ?? req.requester_id}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespond(req.id, 'accepted')}
                    disabled={workingId === req.id}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleRespond(req.id, 'declined')}
                    disabled={workingId === req.id}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5">
        <h2 className="font-display text-2xl text-bk-white mb-4">INCOMING CHALLENGES</h2>

        {incomingChallenges.length === 0 ? (
          <p className="text-bk-gray-muted">No incoming challenges.</p>
        ) : (
          <div className="space-y-3">
            {incomingChallenges.map((challenge) => (
              <div
                key={challenge.id}
                className="bg-bk-black border border-bk-gray-light rounded-xl p-4"
              >
                <p className="font-bold text-bk-white">
                  {challenge.challenger?.username ?? 'Unknown user'}
                </p>
                <p className="text-sm text-bk-gray-muted">
                  Elo: {challenge.challenger?.elo ?? '—'}
                </p>
                <p className="text-sm text-bk-white mt-2">
                  Sport: <span className="text-bk-gold uppercase">{challenge.sport}</span>
                </p>
                <p className="text-sm text-bk-gray-muted">
                  Difficulty: {challenge.difficulty}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5">
        <h2 className="font-display text-2xl text-bk-white mb-4">YOUR FRIENDS</h2>

        {friends.length === 0 ? (
          <p className="text-bk-gray-muted">No friends yet.</p>
        ) : (
          <div className="space-y-3">
            {friends.map((row) => (
              <div
                key={row.id}
                className="bg-bk-black border border-bk-gray-light rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div>
                  <p className="font-bold text-bk-white">{row.friend?.username ?? 'Unknown user'}</p>
                  <p className="text-sm text-bk-gray-muted">Elo: {row.friend?.elo ?? '—'}</p>
                  <p className="text-xs text-bk-gray-muted break-all mt-1">
                    {row.friend?.id ?? 'Unknown ID'}
                  </p>
                </div>

                {row.friend && (
                  <button
                    onClick={() => handleChallenge(row.friend.id, row.friend.username)}
                    disabled={challengingId === row.friend?.id}
                    className="px-4 py-2 rounded-lg bg-bk-gold text-bk-black font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {challengingId === row.friend.id ? 'Sending...' : 'Challenge'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}