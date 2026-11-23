import { state } from './state.js';
import { players, createPlayer, createPlayerBase } from './players.js';
import { updateScores } from './scores.js';
import { playerConfigs } from '../data/constants.js';
import { escapeHtml } from '../data/helpers.js';
import { readRooms, writeRooms } from '../data/storage.js';
import { getPlayerColor } from '../ui/colorPicker.js';
import { updateMatchStatus } from '../ui/scoreboard.js';
import { showLobbyMessage, withLobbyError } from '../ui/messages.js';
import { controlsMarkup, hideWithAnimation, showReadyScreen } from '../ui/readyScreen.js';

export function startMatch(roomId) {
  if (players.length) return;
  const rooms = readRooms();
  const room = rooms.find(item => item.id === roomId && item.status === 'waiting');
  if (!room) throw new Error('That room is no longer available.');
  if (room.players.length < 2) throw new Error('At least two players are needed to start.');

  room.status = 'playing';
  room.startedAt = new Date().toISOString();
  room.round = 1;
  room.players.forEach(player => {
    player.score = 0;
    player.roundWins = 0;
  });
  writeRooms(rooms);
  state.currentRoom = room;
  state.matchRound = 1;
  state.roundWasTied = false;
  state.matchComplete = false;
  state.matchElapsed = 0;
  state.nextConeShuffleAt = 7;

  room.players.forEach((roomPlayer, index) => {
    const player = createPlayer(
      playerConfigs[index],
      index,
      roomPlayer.name,
      getPlayerColor(roomPlayer, index)
    );
    player.id = roomPlayer.id;
    player.dbId = roomPlayer.dbId;
    players.push(player);
    createPlayerBase(player);
  });

  document.querySelector('#controls-text').innerHTML = players
    .map(player => `${escapeHtml(player.name)}: ${controlsMarkup(player.keys)}`)
    .join('  |  ');

  updateScores();
  updateMatchStatus();
  showLobbyMessage('');
  hideWithAnimation(document.querySelector('#lobby')).then(showReadyScreen);
}

export function leaveMatch() {
  if (!state.currentRoom) return;
  withLobbyError(() => {
    writeRooms(readRooms().filter(room => room.id !== state.currentRoom.id));
    window.location.reload();
  });
}