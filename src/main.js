import 'bootstrap/dist/css/bootstrap.min.css';
import { initMenu } from './menu.js';
import {
  ROOMS_KEY,
  HISTORY_KEY,
} from './data/constants.js';
import {
  readRooms,
  writeRooms
} from './data/storage.js';
import {
  fetchMatchHistoryWithJoin,
  deleteMatch
} from './data/database.js';
import { scene, camera, renderer } from './game/world.js';
import { players } from './game/players.js';
import { interact } from './game/interaction.js';
import { colorPicker } from './ui/colorPicker.js';
import { renderRoomList, renderHistoryList } from './ui/lobby.js';
import { showLobbyMessage, withLobbyError } from './ui/messages.js';
import { setupLobbyHandlers } from './ui/lobbyHandlers.js';
import {
  setupReadyScreen
} from './ui/readyScreen.js';
import { updateScores } from './game/scores.js';
import { beginRound, startNextRound } from './game/rounds.js';
import { endGame } from './game/matchEnd.js';
import { startMatch, leaveMatch } from './game/matchStart.js';
import {
  createCenterCones,
  shuffleCones,
  animateCones,
} from './game/cones.js';
import './game/input.js';
import { movePlayer } from './game/movement.js';
import { state } from './game/state.js';
import { mountGameUi } from './ui/template.js';

import './style.css';
import * as THREE from 'three';

mountGameUi();
initMenu();

// Fill the create-room picker (placeholder is added in step 2)
document.querySelector('#create-color-picker').innerHTML = colorPicker('playerColor', 'create-color');

// 8. KEYBOARD INPUT

const finishRound = winner => endGame(winner, { onMatchSaved: renderMatchHistory });

window.addEventListener('keydown', event => {
  players.forEach(player => {
    if (
      event.code === player.keys.action &&
      !event.repeat &&
      state.gameStarted &&
      !state.gameOver
    ) {
      interact(player, { onScoreChange: updateScores, onWin: finishRound });
    }
  });
});

updateScores();

const timerElement = document.querySelector('#timer');

// 15. RESTART GAME

document.querySelector('#restart').addEventListener('click', () => {
  if (players.length && state.currentRoom && !state.matchComplete) {
    startNextRound();
  } else {
    window.location.reload();
  }
});


const roomList = document.querySelector('#room-list');
const historyList = document.querySelector('#match-history');

function renderLobby() {
  withLobbyError(() => {
    const rooms = readRooms().filter(room => room.status === 'waiting');
    renderRoomList(roomList, rooms);
    void renderMatchHistory();
  });
}

let historyRequestId = 0;
let historyFetchFailed = false;

async function renderMatchHistory() {
  const requestId = ++historyRequestId;
  historyFetchFailed = false;

  try {
    const matches = await fetchMatchHistoryWithJoin();
    if (requestId !== historyRequestId) return;
    renderHistoryList(historyList, matches);
  } catch (error) {
    if (requestId !== historyRequestId) return;
    historyFetchFailed = true;
    renderHistoryList(historyList, [], true);
    showLobbyMessage(`Failed to load history: ${error.message}`, true);
  }
}

async function deleteMatchRecord(matchId) {
  await deleteMatch(matchId);
  showLobbyMessage('Match deleted.');
  await renderMatchHistory();
}


document.querySelector('#leave-match').addEventListener('click', leaveMatch);
document.querySelector('#ready-leave').addEventListener('click', leaveMatch);

window.addEventListener('storage', event => {
  if (event.key === ROOMS_KEY || event.key === HISTORY_KEY) renderLobby();
});

window.addEventListener('pagehide', () => {
  if (!state.currentRoom) return;
  writeRooms(readRooms().filter(room => room.id !== state.currentRoom.id));
});

createCenterCones();
setupLobbyHandlers({ renderLobby, startMatch, deleteMatchRecord });
setupReadyScreen({ onAllReady: beginRound });
renderLobby();

// 17. MAIN GAME LOOP

const clock = new THREE.Clock();

function animate() {

  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsedTime = clock.elapsedTime;
  animateCones(elapsedTime);

  if (state.gameStarted && !state.gameOver) {

    state.matchElapsed += delta;
    if (state.matchElapsed >= state.nextConeShuffleAt) {
      shuffleCones(elapsedTime);
      state.nextConeShuffleAt = state.matchElapsed + 8;
    }

    state.gameTime -= delta;

    timerElement.textContent = Math.ceil(
      Math.max(state.gameTime, 0)
    );

    if (state.gameTime <= 0) {
      state.gameTime = 0;
      finishRound();
    }

    players.forEach(player => {
    movePlayer(player, delta, elapsedTime);
    });
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
