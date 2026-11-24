// Styles and libraries
import 'bootstrap/dist/css/bootstrap.min.css';
import './style.css';
import * as THREE from 'three';

// Menu and persistent data
import { initMenu } from './menu.js';
import { getSession } from './auth.js';
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
import { scene, camera, renderer, ground, centerCircle } from './game/world.js';
import { players } from './game/players.js';
import { state } from './game/state.js';
import { interact } from './game/interaction.js';
import { movePlayer } from './game/movement.js';
import { updateScores } from './game/scores.js';
import { beginRound, startNextRound } from './game/rounds.js';
import { endGame } from './game/matchEnd.js';
import { startMatch, leaveMatch } from './game/matchStart.js';
import { createCenterCones, shuffleCones, animateCones } from './game/cones.js';
import './game/input.js'; // side-effect import: registers its own input listeners

// UI
import { mountGameUi } from './ui/template.js';
import { colorPicker } from './ui/colorPicker.js';
import { renderRoomList, renderHistoryList } from './ui/lobby.js';
import { showLobbyMessage, withLobbyError } from './ui/messages.js';
import { setupLobbyHandlers } from './ui/lobbyHandlers.js';
import { setupReadyScreen } from './ui/readyScreen.js';

// Initial setup

// The game markup has to exist before we start grabbing elements from it
mountGameUi();
initMenu();

// Fill in the color picker on the create-room form
document.querySelector('#create-color-picker').innerHTML = colorPicker('playerColor', 'create-color');

const timerElement = document.querySelector('#timer');
const roomList = document.querySelector('#room-list');
const historyList = document.querySelector('#match-history');

// Match history

// Each fetch gets an id so a slow, older response can't overwrite a newer one
let historyRequestId = 0;
let historyFetchFailed = false; // set below but never read anywhere yet

async function renderMatchHistory() {
  const requestId = ++historyRequestId;
  historyFetchFailed = false;

  const session = getSession();
  const isRegistered = (session?.role === 'admin' || session?.role === 'user') && Boolean(session?.id);
  const isAdmin = session?.role === 'admin';
  const historyPanel = historyList.closest('.card, section, div') || historyList;

  // 1. Block Guests completely
  if (!isRegistered) {
    historyList.innerHTML = '';
    historyPanel.style.display = 'none';
    return;
  }

  // 2. Show Match History for both 'admin' (all games) and 'user' (only their games)
  historyPanel.style.display = '';

  try {
    const matches = await fetchMatchHistoryWithJoin(session.id);
    if (requestId !== historyRequestId) return;

    renderHistoryList(historyList, matches);

    // 3. Remove delete buttons for regular 'user' accounts (only admins can delete)
    if (!isAdmin) {
      historyList.querySelectorAll('button, [data-delete], .delete-btn, .btn-danger').forEach(btn => {
        btn.remove();
      });
    }
  } catch (error) {
    if (requestId !== historyRequestId) return;
    historyFetchFailed = true;
    renderHistoryList(historyList, [], true);
    showLobbyMessage(`Failed to load history: ${error.message}`, true);
  }
}

async function deleteMatchRecord(matchId) {
  const session = getSession();
  if (session?.role !== 'admin' || !session?.id) {
    showLobbyMessage('Only admins can delete matches.', true);
    return;
  }

  await deleteMatch(matchId, session.id);
  showLobbyMessage('Match deleted.');
  await renderMatchHistory();
}

// Re-check user/admin status whenever login/logout/guest happens in menu.js
window.addEventListener('auth-changed', () => {
  void renderMatchHistory();
});
// Lobby


function renderLobby() {
  withLobbyError(() => {
    // Only rooms that are still waiting for players are worth showing
    const rooms = readRooms().filter(room => room.status === 'waiting');
    renderRoomList(roomList, rooms);
    void renderMatchHistory();
  });
}

// Round and match flow

// When a round ends, save the match and refresh the history list
const finishRound = winner => endGame(winner, { onMatchSaved: renderMatchHistory });

// Event listeners


// Each player has their own action key, so check every player on keydown
window.addEventListener('keydown', event => {
  players.forEach(player => {
    if (
      event.code === player.keys.action &&
      !event.repeat && // ignore a held-down key
      state.gameStarted &&
      !state.gameOver
    ) {
      interact(player, { onScoreChange: updateScores, onWin: finishRound });
    }
  });
});

// Restart: go to the next round if a match is still running, otherwise reset the page
document.querySelector('#restart').addEventListener('click', () => {
  if (players.length && state.currentRoom && !state.matchComplete) {
    startNextRound();
  } else {
    window.location.reload();
  }
});

document.querySelector('#leave-match').addEventListener('click', leaveMatch);
document.querySelector('#ready-leave').addEventListener('click', leaveMatch);

// Another tab changed the rooms or history, so refresh the lobby
window.addEventListener('storage', event => {
  if (event.key === ROOMS_KEY || event.key === HISTORY_KEY) renderLobby();
});

// Remove our room when the tab closes so it doesn't linger in the lobby
window.addEventListener('pagehide', () => {
  if (!state.currentRoom) return;
  writeRooms(readRooms().filter(room => room.id !== state.currentRoom.id));
});


// Startup

updateScores();
createCenterCones();
setupLobbyHandlers({ renderLobby, startMatch, deleteMatchRecord });
setupReadyScreen({ onAllReady: beginRound });
renderLobby();


// Main game loop


const clock = new THREE.Clock();
let nextMenuConeShuffleAt = 1;
const mainMenu = document.querySelector('#main-menu');
const podium = document.querySelector('#podium');

function animate() {
  // Cap delta so a lagging or backgrounded tab doesn't cause a huge jump
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsedTime = clock.elapsedTime;
  const menuIsVisible = mainMenu && !mainMenu.classList.contains('hidden');

  ground.visible = !menuIsVisible;
  centerCircle.visible = !menuIsVisible;

  animateCones(elapsedTime);

  if (state.gameStarted && !state.gameOver) {
    // Shuffle the cones every 8 seconds of match time
    state.matchElapsed += delta;
    if (state.matchElapsed >= state.nextConeShuffleAt) {
      shuffleCones(elapsedTime);
      state.nextConeShuffleAt = state.matchElapsed + 8;
    }

    // Count down the round timer and end the round at zero
    state.gameTime -= delta;
    timerElement.textContent = Math.ceil(Math.max(state.gameTime, 0));

    if (state.gameTime <= 0) {
      state.gameTime = 0;
      finishRound();
    }

    players.forEach(player => {
      movePlayer(player, delta, elapsedTime);
    });
  } else if (
    ((mainMenu && !mainMenu.classList.contains('hidden')) ||
      (podium && !podium.classList.contains('hidden'))) &&
    elapsedTime >= nextMenuConeShuffleAt
  ) {
    shuffleCones(elapsedTime);
    nextMenuConeShuffleAt = elapsedTime + 3;
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
