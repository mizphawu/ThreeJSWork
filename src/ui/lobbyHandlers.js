import { MAX_PLAYERS } from '../data/constants.js';
import { makeId, validateColor, validateName } from '../data/helpers.js';
import { readRooms, writeRooms } from '../data/storage.js';
import { registerPlayerWithAvatar } from '../data/database.js';
import { showLobbyMessage, withLobbyError } from './messages.js';

export function setupLobbyHandlers({ renderLobby, startMatch, deleteMatchRecord }) {
  const roomList = document.querySelector('#room-list');
  const historyList = document.querySelector('#match-history');

  // CREATE ROOM
  document.querySelector('#create-room-form').addEventListener('submit', event => {
    event.preventDefault();
    const roomForm = event.currentTarget;
    withLobbyError(async () => {
      const form = new FormData(roomForm);
      const roomName = validateName(form.get('roomName'), 'Room name');
      const playerName = validateName(form.get('playerName'), 'Username');
      const playerColor = validateColor(form.get('playerColor'));
      if (playerName.length > 16) throw new Error('Username must be 16 characters or fewer.');
      const playerRecord = await registerPlayerWithAvatar(
        playerName,
        playerColor,
        form.get('avatar')
      );

      const rooms = readRooms();
      rooms.push({
        id: makeId(),
        name: roomName,
        status: 'waiting',
        createdAt: new Date().toISOString(),
        players: [{
          id: makeId(),
          dbId: playerRecord.id,
          avatarUrl: playerRecord.avatar_url ?? null,
          name: playerName,
          color: playerColor,
          score: 0
        }]
      });
      writeRooms(rooms);
      roomForm.reset();
      showLobbyMessage(`Room "${roomName}" created.`);
      renderLobby();
    });
  });

  // JOIN ROOM
  roomList.addEventListener('submit', event => {
    if (!event.target.matches('.join-room-form')) return;
    event.preventDefault();
    const joinForm = event.target;
    withLobbyError(async () => {
      const roomId = event.target.dataset.roomId;
      const form = new FormData(joinForm);
      const playerName = validateName(form.get('playerName'), 'Username');
      const playerColor = validateColor(form.get('playerColor'));
      if (playerName.length > 16) throw new Error('Username must be 16 characters or fewer.');

      let rooms = readRooms();
      let room = rooms.find(item => item.id === roomId && item.status === 'waiting');
      if (!room) throw new Error('That room is no longer available.');
      if (room.players.length >= MAX_PLAYERS) throw new Error('That room is full.');
      if (room.players.some(player => player.name.toLowerCase() === playerName.toLowerCase())) {
        throw new Error('That username is already in this room.');
      }

      const playerRecord = await registerPlayerWithAvatar(
        playerName,
        playerColor,
        form.get('avatar')
      );
      rooms = readRooms();
      room = rooms.find(item => item.id === roomId && item.status === 'waiting');
      if (!room) throw new Error('That room is no longer available.');
      if (room.players.length >= MAX_PLAYERS) throw new Error('That room is full.');
      if (room.players.some(player => player.name.toLowerCase() === playerName.toLowerCase())) {
        throw new Error('That username is already in this room.');
      }

      room.players.push({
        id: makeId(),
        dbId: playerRecord.id,
        avatarUrl: playerRecord.avatar_url ?? null,
        name: playerName,
        color: playerColor,
        score: 0
      });
      writeRooms(rooms);
      showLobbyMessage(`${playerName} joined "${room.name}".`);
      renderLobby();
    });
  });

  // DELETE MATCH HISTORY
  historyList.addEventListener('click', event => {
    const deleteButton = event.target.closest('.delete-match');
    if (deleteButton) {
      withLobbyError(() => deleteMatchRecord(deleteButton.dataset.matchId));
    }
  });

  // LEAVE ROOM + START MATCH
  roomList.addEventListener('click', event => {
    const removeButton = event.target.closest('.remove-player');
    if (removeButton) {
      withLobbyError(() => {
        const rooms = readRooms();
        const room = rooms.find(item => item.id === removeButton.dataset.roomId);
        if (!room) return;
        room.players = room.players.filter(player => player.id !== removeButton.dataset.playerId);
        const remainingRooms = room.players.length ? rooms : rooms.filter(item => item.id !== room.id);
        writeRooms(remainingRooms);
        showLobbyMessage(room.players.length ? 'Player left the room.' : 'Empty room deleted.');
        renderLobby();
      });
      return;
    }

    const startButton = event.target.closest('.start-match');
    if (startButton && !startButton.disabled) {
      withLobbyError(() => startMatch(startButton.dataset.roomId));
    }
  });

  // CHANGE COLOR
  roomList.addEventListener('change', event => {
    if (!event.target.matches('.room-player-color')) return;
    withLobbyError(() => {
      const color = validateColor(event.target.value);
      const rooms = readRooms();
      const room = rooms.find(item =>
        item.id === event.target.dataset.roomId && item.status === 'waiting'
      );
      const player = room?.players.find(item => item.id === event.target.dataset.playerId);
      if (!player) throw new Error('That player is no longer in the room.');
      player.color = color;
      writeRooms(rooms);
      showLobbyMessage(`${player.name}'s color was updated.`);
      renderLobby();
    });
  });
}