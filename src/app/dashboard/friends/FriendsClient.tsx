'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SPORTS } from '@/lib/sports';

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

type DifficultyOption = 'easy' | 'medium' | 'hard' | 'elite';

const DIFFICULTIES: DifficultyOption[] = ['easy', 'medium', 'hard', 'elite'];

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
  const [respondingChallengeId, setRespondingChallengeId] = useState<string | null>(null);

  const [localIncoming, setLocalIncoming] = useState(incoming);
  const [localFriends, setLocalFriends] = useState(friends);
  const [localIncomingChallenges, setLocalIncomingChallenges] = useState(incomingChallenges);

  const [challengePickerOpenFor, setChallengePickerOpenFor] = useState<string | null>(null);
  const [challengeTargetName, setChallengeTargetName] = useState('');
  const [selectedSport, setSelectedSport] = useState<string>('nba');
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyOption>('medium');

  useEffect(() => {
    setLocalIncoming(incoming);
  }, [incoming]);

  useEffect(() => {
    setLocalFriends(friends);
  }, [friends]);

  useEffect(() => {
    setLocalIncomingChallenges(incomingChallenges);
  }, [incomingChallenges]);

  const visibleFriends = useMemo(
    () => localFriends.filter((row) => row.friend && row.friend.id !== currentUserId),
    [localFriends, currentUserId]
  );

  const visibleIncomingChallenges = useMemo(
    () =>
      localIncomingChallenges.filter(
        (challenge) =>
          challenge.challenger &&
          challenge.challenger.id !== currentUserId &&
          challenge.challenged_id === currentUserId
      ),
    [localIncomingChallenges, currentUserId]
  );

  const openChallengePicker = (friendId: string, friendUsername: string) => {
    setMessage('');
    setChallengePickerOpenFor(friendId);
    setChallengeTargetName(friendUsername);
    setSelectedSport('nba');
    setSelectedDifficulty('medium');
  };

  const closeChallengePicker = () => {
    setChallengePickerOpenFor(null);
    setChallengeTargetName('');
  };

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
        return;
      }

      setMessage(`Friend request sent to ${data.username}`);
      setUserIdInput('');
      router.refresh();
    } catch (error) {
      console.error('send friend request failed', error);
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
        return;
      }

      setLocalIncoming((prev) => prev.filter((req) => req.id !== requestId));
      setMessage(action === 'accepted' ? 'Friend request accepted' : 'Friend request declined');
      router.refresh();
    } catch (error) {
      console.error('friend request response failed', error);
      setMessage('Failed to update request');
    } finally {
      setWorkingId(null);
    }
  };

  const handleChallenge = async (friendId: string, friendUsername: string) => {
    if (!friendId || friendId === currentUserId) {
      setMessage('You cannot challenge yourself');
      return;
    }

    setChallengingId(friendId);
    setMessage('');

    try {
      const res = await fetch('/api/friend-challenges/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengedId: friendId,
          sport: selectedSport,
          difficulty: selectedDifficulty,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || 'Failed to send challenge');
        return;
      }

      setMessage(`Challenge sent to ${friendUsername} in ${selectedSport.toUpperCase()} (${selectedDifficulty})`);
      closeChallengePicker();
      router.refresh();
    } catch (error) {
      console.error('send challenge failed', error);
      setMessage('Failed to send challenge');
    } finally {
      setChallengingId(null);
    }
  };

  const handleChallengeResponse = async (
    challengeId: string,
    action: 'accepted' | 'declined'
  ) => {
    setRespondingChallengeId(challengeId);
    setMessage('');

    try {
      const res = await fetch('/api/friend-challenges/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, action }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || 'Failed to respond to challenge');
        return;
      }

      setLocalIncomingChallenges((prev) =>
        prev.filter((challenge) => challenge.id !== challengeId)
      );

      if (action === 'accepted') {
        setMessage('Challenge accepted');
        if (data.matchId) {
          router.push(`/dashboard/match/${data.matchId}`);
          return;
        }
      } else {
        setMessage('Challenge declined');
      }

      router.refresh();
    } catch (error) {
      console.error('challenge response failed', error);
      setMessage('Failed to respond to challenge');
    } finally {
      setRespondingChallengeId(null);
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

        {localIncoming.length === 0 ? (
          <p className="text-bk-gray-muted">No incoming requests.</p>
        ) : (
          <div className="space-y-3">
            {localIncoming.map((req) => (
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
                    {workingId === req.id ? 'Working...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleRespond(req.id, 'declined')}
                    disabled={workingId === req.id}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {workingId === req.id ? 'Working...' : 'Decline'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5">
        <h2 className="font-display text-2xl text-bk-white mb-4">INCOMING CHALLENGES</h2>

        {visibleIncomingChallenges.length === 0 ? (
          <p className="text-bk-gray-muted">No incoming challenges.</p>
        ) : (
          <div className="space-y-3">
            {visibleIncomingChallenges.map((challenge) => (
              <div
                key={challenge.id}
                className="bg-bk-black border border-bk-gray-light rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div>
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

                <div className="flex gap-2">
                  <button
                    onClick={() => handleChallengeResponse(challenge.id, 'accepted')}
                    disabled={respondingChallengeId === challenge.id}
                    className="px-4 py-2 rounded-lg bg-green-600 text-white font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {respondingChallengeId === challenge.id ? 'Working...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleChallengeResponse(challenge.id, 'declined')}
                    disabled={respondingChallengeId === challenge.id}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:opacity-90 disabled:opacity-50"
                  >
                    {respondingChallengeId === challenge.id ? 'Working...' : 'Decline'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-bk-gray border border-bk-gray-light rounded-2xl p-5">
        <h2 className="font-display text-2xl text-bk-white mb-4">YOUR FRIENDS</h2>

        {visibleFriends.length === 0 ? (
          <p className="text-bk-gray-muted">No friends yet.</p>
        ) : (
          <div className="space-y-3">
            {visibleFriends.map((row) => {
              const friend = row.friend;
              const pickerOpen = challengePickerOpenFor === friend?.id;

              return (
                <div
                  key={row.id}
                  className="bg-bk-black border border-bk-gray-light rounded-xl p-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <p className="font-bold text-bk-white">{friend?.username ?? 'Unknown user'}</p>
                      <p className="text-sm text-bk-gray-muted">Elo: {friend?.elo ?? '—'}</p>
                      <p className="text-xs text-bk-gray-muted break-all mt-1">
                        {friend?.id ?? 'Unknown ID'}
                      </p>
                    </div>

                    {friend && friend.id !== currentUserId ? (
                      <button
                        onClick={() => openChallengePicker(friend.id, friend.username)}
                        className="px-4 py-2 rounded-lg bg-bk-gold text-bk-black font-bold hover:opacity-90"
                      >
                        Challenge
                      </button>
                    ) : null}
                  </div>

                  {pickerOpen && friend && (
                    <div className="mt-4 border-t border-bk-gray-light pt-4 space-y-4">
                      <div>
                        <p className="text-sm font-bold text-bk-white mb-2">
                          Challenge {challengeTargetName}
                        </p>
                        <p className="text-xs text-bk-gray-muted">
                          Pick a sport and difficulty before sending.
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-widest text-bk-gray-muted font-bold mb-2">
                          Sport
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {SPORTS.map((sport) => (
                            <button
                              key={sport.id}
                              type="button"
                              onClick={() => setSelectedSport(sport.id)}
                              className={`rounded-xl border px-3 py-3 text-left transition-all ${
                                selectedSport === sport.id
                                  ? 'border-bk-gold bg-bk-gold/10 text-bk-white'
                                  : 'border-bk-gray-light bg-bk-gray text-bk-gray-muted hover:border-bk-gold/50'
                              }`}
                            >
                              <div className="text-lg mb-1">{sport.emoji}</div>
                              <div className="text-sm font-bold">{sport.label}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-widest text-bk-gray-muted font-bold mb-2">
                          Difficulty
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {DIFFICULTIES.map((difficulty) => (
                            <button
                              key={difficulty}
                              type="button"
                              onClick={() => setSelectedDifficulty(difficulty)}
                              className={`rounded-xl border px-3 py-3 text-sm font-bold capitalize transition-all ${
                                selectedDifficulty === difficulty
                                  ? 'border-bk-gold bg-bk-gold text-bk-black'
                                  : 'border-bk-gray-light bg-bk-gray text-bk-white hover:border-bk-gold/50'
                              }`}
                            >
                              {difficulty}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleChallenge(friend.id, friend.username)}
                          disabled={challengingId === friend.id}
                          className="px-4 py-2 rounded-lg bg-bk-gold text-bk-black font-bold hover:opacity-90 disabled:opacity-50"
                        >
                          {challengingId === friend.id ? 'Sending...' : 'Send Challenge'}
                        </button>

                        <button
                          type="button"
                          onClick={closeChallengePicker}
                          disabled={challengingId === friend.id}
                          className="px-4 py-2 rounded-lg border border-bk-gray-light text-bk-white font-bold hover:border-bk-gold hover:text-bk-gold disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}