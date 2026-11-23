import { supabase, supabaseConfigError } from '../supabaseClient.js';

function requireSupabase() {
  if (!supabase) throw new Error(supabaseConfigError);
  return supabase;
}

export async function fetchMatchHistoryWithJoin() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('matches')
    .select(`
      id,
      room_name,
      total_rounds,
      ended_at,
      match_participants (
        round_wins,
        is_winner,
        players (
          username,
          favorite_color,
          avatar_url
        )
      )
    `)
    .eq('status', 'completed')
    .order('ended_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data;
}

export async function deleteMatch(matchId) {
  const client = requireSupabase();
  const { error } = await client.from('matches').delete().eq('id', matchId);
  if (error) throw error;
}

export async function registerPlayerWithAvatar(username, color, avatarFile) {
  const client = requireSupabase();
  let avatarUrl = null;

  if (avatarFile && avatarFile.size > 0) {
    if (!avatarFile.type.startsWith('image/')) {
      throw new Error('Choose a valid image file for the avatar.');
    }
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await client.storage
      .from('avatars')
      .upload(fileName, avatarFile);

    if (uploadError) throw uploadError;

    const { data } = client.storage.from('avatars').getPublicUrl(fileName);
    avatarUrl = data.publicUrl;
  }

  const { data: player, error } = await client
    .from('players')
    .upsert(
      { username, favorite_color: color, ...(avatarUrl && { avatar_url: avatarUrl }) },
      { onConflict: 'username' }
    )
    .select()
    .single();

  if (error) throw error;
  return player;
}

export async function saveCompletedMatchToCloud(roomName, totalRounds, finalPlayers, winnerId, endedAt) {
  const client = requireSupabase();
  if (finalPlayers.some(player => !player.dbId)) {
    throw new Error('One or more players are missing their Supabase player record. Recreate the room to save cloud history.');
  }

  const { data: match, error: matchError } = await client
    .from('matches')
    .insert({
      room_name: roomName,
      status: 'completed',
      total_rounds: totalRounds,
      ended_at: endedAt
    })
    .select()
    .single();

  if (matchError) throw matchError;

  const participantRows = finalPlayers.map(player => ({
    match_id: match.id,
    player_id: player.dbId,
    round_wins: player.roundWins,
    cones_collected: player.baseCones.length,
    is_winner: player.dbId === winnerId
  }));

  const { error: participantError } = await client
    .from('match_participants')
    .insert(participantRows);

  if (participantError) throw participantError;
}