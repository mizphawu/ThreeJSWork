import confetti from 'canvas-confetti';
import 'bootstrap/dist/css/bootstrap.min.css';
import { initMenu } from './menu.js';
import {
  PLAYER_COLORS,
  ROOMS_KEY,
  HISTORY_KEY,
  MAX_PLAYERS,
  ROUNDS_TO_WIN_MATCH,
  playerConfigs
} from './data/constants.js';
import {
  escapeHtml,
  makeId,
  validateColor,
  validateName,
} from './data/helpers.js';
import {
  readRooms,
  writeRooms,
  readHistory,
  writeHistory
} from './data/storage.js';
import {
  fetchMatchHistoryWithJoin,
  deleteMatch,
  registerPlayerWithAvatar,
  saveCompletedMatchToCloud
} from './data/database.js';
import { scene, camera, renderer } from './game/world.js';
import { createPlayer, createPlayerBase, players } from './game/players.js';
import { interact } from './game/interaction.js';
import {
  centerCones,
  createCenterCones,
  shuffleCones,
  animateCones,
  disposeCone
} from './game/cones.js';
import './game/input.js';
import { movePlayer } from './game/movement.js';
import { state } from './game/state.js';

import './style.css';
import * as THREE from 'three';

const ui = document.createElement('div');

ui.id = 'game-ui';

ui.innerHTML = `
  <section id="lobby" class="position-absolute top-0 start-0 w-100 h-100 overflow-auto py-4 px-2 bg-info-subtle bg-gradient">
  <div class="bubbles" aria-hidden="true">
  <span></span><span></span><span></span><span></span><span></span><span></span>
  </div>
  <div class="container" style="max-width: 760px">
    <div class="card lobby-card border-0 rounded-5 shadow-lg overflow-hidden">

      <!-- Header -->
      <div class="text-center py-4 px-3 border-bottom border-4 border-warning lobby-header">
        <img src="/traffic-cone.png" alt="" class="cone-logo-img cone-bounce d-block mx-auto mb-2">
        <h1 class="display-4 fw-bolder text-uppercase mb-1 title-cute">
          <span class="title-cone">Cone</span> <span class="title-clash">Clash</span>
        </h1>
        <p class="text-body-secondary fw-medium mb-0">Cone it, Phloem, cone it!</p>
      </div>

      <div class="card-body p-4">

        <form id="create-room-form" class="row g-3 align-items-end bg-body-tertiary border border-2 rounded-4 p-3 mb-3">
          <div class="col-12 col-md-6">
  <label class="form-label fw-bold small text-uppercase text-body-secondary" for="room-name">Room name</label>
  <input id="room-name" name="roomName" class="form-control form-control-lg rounded-pill border-2"
         maxlength="24" placeholder="Rubylin's Game" required>
</div>
<div class="col-12 col-md-6">
  <label class="form-label fw-bold small text-uppercase text-body-secondary" for="create-player-name">Username</label>
  <input id="create-player-name" name="playerName" class="form-control form-control-lg rounded-pill border-2"
         maxlength="16" placeholder="Your name" required>
          </div>
          <div class="col-12">
          <div class="form-label fw-bold small text-uppercase text-body-secondary">Color</div>
          <div id="create-color-picker"></div>
          </div>
          <div class="col-12">
            <label class="form-label fw-bold small text-uppercase text-body-secondary" for="create-player-avatar">Avatar (optional)</label>
            <input id="create-player-avatar" name="avatar" type="file" accept="image/*"
                   class="form-control rounded-pill border-2">
          </div>
          <div class="col-12">
            <button type="submit" class="btn btn-warning btn-lg fw-bold w-100 rounded-pill text-uppercase btn-pop">
              Create room
            </button>
          </div>
        </form>

        <div id="lobby-message" class="small mb-3" role="status" aria-live="polite"></div>

        <h2 class="h6 fw-bold text-uppercase text-success-emphasis d-flex align-items-center gap-2">
          <span class="section-dot bg-success"></span> Available rooms
        </h2>
        <div id="room-list" class="mb-4"></div>

        <h2 class="h6 fw-bold text-uppercase text-primary-emphasis d-flex align-items-center gap-2">
        <span class="section-dot bg-primary"></span> Match history
        </h2>
        <div id="match-history" class="d-grid gap-2"></div>
      </div>
    </div>
  </div>
</section>

  <div id="game-hud" class="hidden">
    <div id="timer" class="position-absolute top-0 start-50 translate-middle-x mt-3 px-4 py-2 display-5 fw-bolder bg-body border border-3 rounded-4">45</div>
    <div id="match-status" class="badge text-bg-dark position-absolute start-50 translate-middle-x" style="top: 105px">ROUND 1 · REAL-TIME</div>
    <div id="countdown" class="position-absolute start-50 translate-middle text-center display-1 fw-bolder px-5 py-2 rounded-5 border border-4 border-white shadow-lg bg-warning text-dark">GET READY!</div>
    <div id="scores" class="position-absolute top-0 start-0 m-3 p-3 rounded-3 bg-dark bg-opacity-75 fw-bold"></div>

    <div id="instructions" class="position-absolute bottom-0 start-50 translate-middle-x mb-3 px-3 py-2 rounded-3 bg-dark bg-opacity-75 small d-flex align-items-center gap-3">
      <span id="controls-text">P1: WASD + E | P2: ARROWS + ENTER | P3: IJKL + O</span>
      <button id="leave-match" type="button" class="btn btn-sm btn-outline-warning">LEAVE MATCH</button>
    </div>
  </div>

      <div id="podium" class="hidden position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 bg-black bg-opacity-75 podium-backdrop">
    <div class="container" style="max-width: 640px">
      <div class="card lobby-card podium-card border-0 rounded-5 shadow-lg overflow-hidden">

        <div class="text-center py-4 px-3 border-bottom border-4 border-warning lobby-header">
          <div id="podium-trophy" class="display-3 d-inline-block cone-bounce">🏆</div>
          <h1 class="podium-title title-cute display-6 fw-bolder text-uppercase text-white mb-1"></h1>
          <p id="podium-subtitle" class="text-body-secondary fw-medium mb-0"></p>
        </div>

        <div class="card-body px-4 pt-4 pb-2">
          <div id="podium-content" class="row g-2 justify-content-center align-items-end text-center" style="height: 280px"></div>
        </div>

        <div class="p-4 pt-2">
          <button id="restart" type="button" class="btn btn-warning btn-lg fw-bold w-100 rounded-pill text-uppercase btn-pop">
            BACK TO LOBBY
          </button>
        </div>
      </div>
    </div>
  </div>

  <section id="ready-screen" class="hidden position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 bg-black bg-opacity-50">
  <div class="card border-0 rounded-5 shadow-lg overflow-hidden w-100" style="max-width: 640px">
    <div class="text-center py-3 px-3 border-bottom border-4 border-warning lobby-header">
      <h2 class="fs-2 fw-bolder text-uppercase mb-0 title-cute">
        <span class="title-cone">How to</span> <span class="title-clash">play</span>
      </h2>
    </div>
    <div class="card-body p-4">
      <ul class="small ps-3 mb-3">
        <li>When the countdown hits <strong>GO</strong>, dash from your base to the center and grab a cone with your action key.</li>
        <li>Carry <strong>one cone at a time</strong> back to your own base and press your action key to drop it off.</li>
        <li>Stand at a rival's base and press your action key to <strong>steal</strong> one of their cones, and protect yours.</li>
        <li>Get 3 cones into your base, or have the most when time runs out, to win the round. First to 2 round wins takes the match.</li>
      </ul>

      <h3 class="h6 fw-bold text-uppercase text-body-secondary">Your capsules and controls</h3>
      <div id="ready-players" class="mb-2"></div>

      <div id="ready-status" class="text-center small fw-semibold text-body-secondary mb-3" role="status" aria-live="polite"></div>
      <button id="ready-leave" type="button" class="btn btn-link text-body-secondary w-100">Leave match</button>
    </div>
  </div>
</section>

  <div id="app-message" class="alert alert-danger position-absolute top-0 start-50 translate-middle-x mt-3 d-none" role="alert" aria-live="assertive"></div>
`;

document.body.appendChild(ui);
initMenu();

function colorPicker(fieldName, idPrefix, takenColors = []) {
  const taken = new Set(takenColors);
  const selected = PLAYER_COLORS.find(color => !taken.has(color.hex));

  return `
    <div class="d-flex flex-wrap gap-2" role="radiogroup" aria-label="Choose your player and cone color">
      ${PLAYER_COLORS.map(color => {
        const id = `${idPrefix}-${color.hex.slice(1)}`;
        const isTaken = taken.has(color.hex);
        return `
          <input type="radio" class="btn-check" name="${fieldName}" id="${escapeHtml(id)}"
                 value="${color.hex}" ${color === selected ? 'checked' : ''} ${isTaken ? 'disabled' : ''}>
          <label class="color-swatch rounded-circle border border-2 border-white" for="${escapeHtml(id)}"
                 style="--swatch: ${color.hex}" title="${color.name}${isTaken ? ' (taken)' : ''}">
            <span class="visually-hidden">${color.name}</span>
          </label>`;
      }).join('')}
    </div>`;
}

// Fill the create-room picker (placeholder is added in step 2)
document.querySelector('#create-color-picker').innerHTML = colorPicker('playerColor', 'create-color');

// 8. KEYBOARD INPUT


window.addEventListener('keydown', event => {
  players.forEach(player => {
    if (
      event.code === player.keys.action &&
      !event.repeat &&
      state.gameStarted &&
      !state.gameOver
    ) {
      interact(player, { onScoreChange: updateScores, onWin: endGame });
    }
  });
});

function updateMatchStatus() {
  const seriesScore = players
    .map(player => `${escapeHtml(player.name)} ${player.roundWins}`)
    .join(' : ');
  document.querySelector('#match-status').textContent =
    `ROUND ${state.matchRound} · SERIES ${seriesScore}`;
}

function updateScores() {

  const scoreElement = document.querySelector('#scores');

  scoreElement.innerHTML = players.map(player => `
    <div style="color: #${player.color.toString(16).padStart(6, '0')}">
      ${escapeHtml(player.name)}: ${player.baseCones.length} cones · ${player.roundWins} rounds
    </div>
  `).join('');

  if (state.currentRoom) {
    try {
      const rooms = readRooms();
      const room = rooms.find(item => item.id === state.currentRoom.id);
      if (room) {
        room.round = state.matchRound;
        room.players = players.map(player => {
          const roomPlayer = room.players.find(item => item.id === player.id);
          return {
            ...roomPlayer,
            id: player.id,
            name: player.name,
            color: `#${player.color.toString(16).padStart(6, '0')}`,
            score: player.baseCones.length,
            roundWins: player.roundWins
          };
        });
        writeRooms(rooms);
      }
    } catch (error) {
      showLobbyMessage(`Couldn't save the current scores: ${error.message}`, true);
    }
  }
}

updateScores();

// 13. GAME TIMER

const countdownElement = document.querySelector('#countdown');
const timerElement = document.querySelector('#timer');

function startCountdown() {

  countdownElement.textContent = state.countdown;

  const interval = setInterval(() => {

    state.countdown--;

    if (state.countdown > 0) {
      countdownElement.textContent = state.countdown;
    } else {

      clearInterval(interval);

      countdownElement.textContent = 'GO!';
      state.gameStarted = true;

      setTimeout(() => {
        countdownElement.textContent = '';
      }, 800);
    }

  }, 1000);
}

// 14. END GAME AND PODIUM

// CONFETTI

let confettiTimer = null;
let confettiFrame = null;

const playerHex = player => `#${player.color.toString(16).padStart(6, '0')}`;

// Dark or white text, whichever reads better on the player's color
function textClassFor(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? 'text-dark' : 'text-white';
}

function launchConfetti(accent, big = false) {
  const colors = [accent, accent, '#ff8c32', '#ffd447', '#ff6fa8', '#6aa8ff', '#5fd9b0', '#ffffff'];

  // Big burst from the middle
  confetti({ particleCount: big ? 160 : 90, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.65 }, colors });

  // Then streams from both sides
  const end = Date.now() + (big ? 3500 : 1800);
  (function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.75 }, colors });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.75 }, colors });
    if (Date.now() < end) confettiFrame = requestAnimationFrame(frame);
  })();
}

function clearConfetti() {
  clearTimeout(confettiTimer);
  cancelAnimationFrame(confettiFrame);
  confetti.reset();
}

// 14. END GAME AND PODIUM

function endGame(winner = null) {

  if (state.gameOver) return;

  state.gameOver = true;
  state.gameStarted = false;
  document.querySelector('#game-hud').classList.add('hidden');

  const rankings = [...players].sort(
    (a, b) => b.baseCones.length - a.baseCones.length
  );
  const roundLeader = winner ?? (rankings[0].baseCones.length > rankings[1].baseCones.length
    ? rankings[0]
    : null);
  state.roundWasTied = !roundLeader;
  if (roundLeader) roundLeader.roundWins++;
  updateScores();
  updateMatchStatus();

  const podium = document.querySelector('#podium');
  const podiumContent = document.querySelector('#podium-content');
  const title = podium.querySelector('h1');
  const subtitle = podium.querySelector('#podium-subtitle');
  const trophy = podium.querySelector('#podium-trophy');

  const medals = ['🥇', '🥈', '🥉'];

  const matchWinner = roundLeader?.roundWins >= ROUNDS_TO_WIN_MATCH ? roundLeader : null;
  const displayRankings = matchWinner
    ? [...players].sort((a, b) => b.roundWins - a.roundWins || b.baseCones.length - a.baseCones.length)
    : rankings;

  // Rank order in the data; Bootstrap's order-* puts 1st in the middle
  const PODIUM_ORDER   = ['order-2', 'order-1', 'order-3'];
  const PODIUM_HEIGHTS = ['h-100', 'h-75', 'h-50'];
  const RISE_DELAYS    = [1200, 700, 300]; // 3rd rises first, the winner last

  podiumContent.innerHTML = displayRankings.map((player, index) => {
    const hex = playerHex(player);
    const detail = matchWinner
      ? `${player.roundWins} round win${player.roundWins === 1 ? '' : 's'}`
      : `${player.baseCones.length} cone${player.baseCones.length === 1 ? '' : 's'}`;

    return `
      <div class="col-4 h-100 d-flex align-items-end podium-step podium-step-${index + 1} ${PODIUM_ORDER[index]}"
           style="--delay: ${RISE_DELAYS[index]}ms">
        <div class="card w-100 ${PODIUM_HEIGHTS[index]} rounded-top-4 rounded-bottom-0 shadow
                    ${index === 0 ? 'border border-4 border-warning' : 'border-0'} ${textClassFor(hex)}"
             style="background: ${hex}">
          <div class="card-body p-2 d-flex flex-column align-items-center justify-content-center gap-1">
            <span class="podium-medal fs-1 lh-1">${medals[index]}</span>
            <div class="fw-bolder w-100 text-truncate">${escapeHtml(player.name)}</div>
            <div class="small fw-semibold opacity-75">${detail}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  const series = players.map(player => `${player.name} ${player.roundWins}`).join(' : ');

  if (matchWinner) {
    state.matchComplete = true;
    title.textContent = `${matchWinner.name} WINS THE MATCH!`;
    subtitle.textContent = `Final series: ${series}`;
    trophy.textContent = '🏆';
    document.querySelector('#restart').textContent = 'BACK TO LOBBY';
    completeCurrentRoom(displayRankings, matchWinner);
  } else if (roundLeader) {
    title.textContent = `${roundLeader.name} WINS ROUND ${state.matchRound}!`;
    subtitle.textContent = `Series: ${series}`;
    trophy.textContent = '🎉';
    document.querySelector('#restart').textContent = `START ROUND ${state.matchRound + 1}`;
  } else {
    title.textContent = `ROUND ${state.matchRound} TIED!`;
    subtitle.textContent = 'Nobody takes the cones this time.';
    trophy.textContent = '🤝';
    document.querySelector('#restart').textContent = `REPLAY ROUND ${state.matchRound}`;
  }

  // Confetti pops when the winner's step lands
  clearConfetti();
  const celebrated = matchWinner ?? roundLeader;
  if (celebrated) {
    confettiTimer = setTimeout(
      () => launchConfetti(playerHex(celebrated), Boolean(matchWinner)),
      1200
    );
  }

  podium.classList.remove('hidden');
}

// 15. RESTART GAME

document.querySelector('#restart').addEventListener('click', () => {
  if (players.length && state.currentRoom && !state.matchComplete) {
    startNextRound();
  } else {
    window.location.reload();
  }
});

// 16. LOCAL ROOM LOBBY

const lobbyMessage = document.querySelector('#lobby-message');
const appMessage = document.querySelector('#app-message');
const roomList = document.querySelector('#room-list');
const historyList = document.querySelector('#match-history');

function showLobbyMessage(message, isError = false) {
  lobbyMessage.textContent = message;
  lobbyMessage.classList.toggle('text-danger', isError);
  lobbyMessage.classList.toggle('text-success', !isError);
  appMessage.textContent = isError ? message : '';
  appMessage.classList.toggle('d-none', !isError);
}

function withLobbyError(action) {
  try {
    const result = action();
    if (result && typeof result.catch === 'function') {
      result.catch(error => {
        showLobbyMessage(`Couldn't update the lobby: ${error.message}`, true);
      });
    }
  } catch (error) {
    showLobbyMessage(`Couldn't update the lobby: ${error.message}`, true);
  }
}

function renderLobby() {
  withLobbyError(() => {
    const rooms = readRooms().filter(room => room.status === 'waiting');

    roomList.innerHTML = rooms.length ? rooms.map(room => `
      <div class="card border-0 border-start border-5 border-success rounded-4 shadow-sm mb-3 room-card">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h3 class="h5 fw-bolder mb-0"> ${escapeHtml(room.name)}</h3>
            <span class="badge rounded-pill text-bg-success fs-6">
              ${room.players.length}/${MAX_PLAYERS} players
            </span>
          </div>

          <ul class="list-group list-group-flush mb-3">
            ${room.players.map((player, index) => `
              <li class="list-group-item d-flex align-items-center gap-2 bg-transparent px-0">
                <span class="player-color-swatch" style="--player-color: ${getPlayerColor(player, index)}"></span>
                <span class="flex-grow-1 fw-semibold">${escapeHtml(player.name)}</span>
                <input class="room-player-color form-control form-control-color form-control-sm rounded-pill border-2"
                       type="color" value="${getPlayerColor(player, index)}"
                       data-room-id="${escapeHtml(room.id)}" data-player-id="${escapeHtml(player.id)}"
                       aria-label="Change ${escapeHtml(player.name)}'s color">
                <button type="button" class="remove-player btn btn-sm btn-outline-danger rounded-pill px-3"
                        data-room-id="${escapeHtml(room.id)}" data-player-id="${escapeHtml(player.id)}"
                        aria-label="Remove ${escapeHtml(player.name)}">Leave</button>
              </li>
            `).join('')}
          </ul>

          <form class="join-room-form row g-2 align-items-center bg-warning-subtle rounded-4 p-2 mx-0"
                data-room-id="${escapeHtml(room.id)}">
                <div class="col-12">
                ${colorPicker('playerColor', `join-${room.id}`, room.players.map(getPlayerColor))}
                </div>
            <div class="col-12 col-sm">
              <input name="playerName" class="form-control rounded-pill border-2" maxlength="16"
                     placeholder="Username to join"
                     aria-label="Username to join ${escapeHtml(room.name)}" required>
            </div>
            <div class="col-12 col-sm">
              <input name="avatar" type="file" accept="image/*" class="form-control rounded-pill border-2"
                     aria-label="Optional avatar image">
            </div>
            <div class="col-auto">
              <button type="submit" class="btn btn-warning fw-bold rounded-pill px-4 btn-pop"
                      ${room.players.length >= MAX_PLAYERS ? 'disabled' : ''}>JOIN</button>
            </div>
            <div class="col-auto">
              <button type="button" class="start-match btn btn-success fw-bold rounded-pill px-4 btn-pop"
                      data-room-id="${escapeHtml(room.id)}"
                      ${room.players.length < 2 ? 'disabled' : ''}>START MATCH</button>
            </div>
          </form>
        </div>
      </div>
    `).join('') : `
      <div class="text-center text-body-secondary bg-body-tertiary rounded-4 border border-2 border-dashed py-4">
        <div class="fs-1"></div>
        No rooms yet. Create one to get started!
      </div>`;

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
    historyList.innerHTML = matches.length ? matches.map(match => `
      <div class="card border-0 border-start border-5 border-primary rounded-4 shadow-sm">
        <div class="card-body py-3">
          <div class="d-flex justify-content-between flex-wrap gap-2">
            <h3 class="h6 fw-bolder mb-0">👑- ${escapeHtml(match.room_name)}</h3>
            <small class="text-body-secondary">${escapeHtml(new Date(match.ended_at).toLocaleString())}</small>
          </div>
          <div class="small text-body-secondary mb-2">Finished in ${match.total_rounds} rounds</div>
          <div class="d-flex flex-wrap gap-2">
            ${(match.match_participants ?? []).map(participant => {
              const player = participant.players;
              if (!player) return '';
              const color = /^#[\da-f]{6}$/i.test(player.favorite_color)
                ? player.favorite_color
                : '#495057';
              return `
                <span class="badge rounded-pill fs-6 fw-semibold d-inline-flex align-items-center gap-1 text-white"
                      style="background:${escapeHtml(color)}; text-shadow: 0 1px 2px rgba(0,0,0,.5)">
                  ${player.avatar_url
                    ? `<img src="${escapeHtml(player.avatar_url)}" width="24" height="24" alt="" class="rounded-circle">`
                    : ''}
                  ${participant.is_winner ? '🥇' : ''}
                  ${escapeHtml(player.username)}: ${participant.round_wins} round wins
                </span>`;
            }).join('')}
          </div>
          <button type="button" class="delete-match btn btn-sm btn-outline-danger rounded-pill mt-2"
                  data-match-id="${escapeHtml(match.id)}">Delete</button>
        </div>
      </div>
    `).join('') : `
      <div class="text-center text-body-secondary bg-body-tertiary rounded-4 py-3">
        ${historyFetchFailed ? 'Match history could not be loaded.' : '🏆 Completed matches will show up here.'}
      </div>`;
  } catch (error) {
    if (requestId !== historyRequestId) return;
    historyFetchFailed = true;
    historyList.innerHTML = `
      <div class="text-center text-body-secondary bg-body-tertiary rounded-4 py-3">
        Match history could not be loaded.
      </div>`;
    showLobbyMessage(`Failed to load history: ${error.message}`, true);
  }
}

async function deleteMatchRecord(matchId) {
  await deleteMatch(matchId);
  showLobbyMessage('Match deleted.');
  await renderMatchHistory();
}

function getPlayerColor(player, index) {
  if (typeof player.color === 'string' && /^#[\da-f]{6}$/i.test(player.color)) {
    return player.color.toLowerCase();
  }
  const color = playerConfigs[index % playerConfigs.length].color;
  return `#${color.toString(16).padStart(6, '0')}`;
}

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

historyList.addEventListener('click', event => {
  const deleteButton = event.target.closest('.delete-match');
  if (deleteButton) {
    withLobbyError(() => deleteMatchRecord(deleteButton.dataset.matchId));
  }
});

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

// READY SCREEN

const KEY_LABELS = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter'
};

function keyLabel(code) {
  return KEY_LABELS[code] ?? code.replace(/^Key/, '');
}

function controlsMarkup(keys) {
  const kbd = code => `<kbd>${keyLabel(code)}</kbd>`;
  return `<span class="me-3">Move ${[keys.up, keys.left, keys.down, keys.right].map(kbd).join(' ')}</span>` +
         `<span>Action ${kbd(keys.action)}</span>`;
}

function renderReadyScreen() {
  document.querySelector('#ready-players').innerHTML = players.map((player, index) => {
    const hex = `#${player.color.toString(16).padStart(6, '0')}`;
    return `
      <div class="d-flex align-items-center gap-3 p-2 mb-2 rounded-4 bg-body-tertiary border border-2">
        <span class="player-color-swatch" style="--player-color: ${hex}; width: 28px; height: 28px; flex-basis: 28px"></span>
        <div class="flex-grow-1">
          <div class="fw-bold">${escapeHtml(player.name)}
            <span class="text-body-secondary fw-normal small">· Player ${index + 1}</span>
          </div>
          <div class="small text-body-secondary">${controlsMarkup(player.keys)}</div>
        </div>
        <button type="button" class="ready-toggle btn fw-bold rounded-pill ${player.ready ? 'btn-success' : 'btn-outline-warning'}"
                data-player-index="${index}">${player.ready ? 'READY ✓' : "I'M READY"}</button>
      </div>`;
  }).join('');

  const waiting = players.filter(player => !player.ready);
  document.querySelector('#ready-status').textContent = waiting.length
    ? `Waiting for ${waiting.map(player => player.name).join(', ')}…`
    : 'Starting…';
}

let readyLocked = false;

function showReadyScreen() {
  readyLocked = false;
  players.forEach(player => { player.ready = false; });
  renderReadyScreen();
  document.querySelector('#ready-screen').classList.remove('hidden');
}

document.querySelector('#ready-players').addEventListener('click', event => {
  const button = event.target.closest('.ready-toggle');
  if (!button || readyLocked) return;

  const player = players[Number(button.dataset.playerIndex)];
  player.ready = !player.ready;
  renderReadyScreen();

  if (players.every(item => item.ready)) {
    readyLocked = true;
    hideWithAnimation(document.querySelector('#ready-screen')).then(beginRound);
  }
});

function hideWithAnimation(element, duration = 300) {
  return new Promise(resolve => {
    element.classList.add('leaving');
    setTimeout(() => {
      element.classList.add('hidden');
      element.classList.remove('leaving');
      resolve();
    }, duration);
  });
}

function startMatch(roomId) {
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

function beginRound() {
  clearConfetti();
  state.gameOver = false;
  state.gameStarted = false;
  state.countdown = 3;
  state.gameTime = 60;
  state.matchElapsed = 0;
  state.nextConeShuffleAt = 7;
  timerElement.textContent = state.gameTime;
  countdownElement.textContent = '';
  document.querySelector('#podium').classList.add('hidden');
  document.querySelector('#game-hud').classList.remove('hidden');
  updateScores();
  updateMatchStatus();
  startCountdown();
}

function startNextRound() {
  if (!state.roundWasTied) state.matchRound++;

  centerCones.forEach(disposeCone);
  centerCones.length = 0;

  players.forEach(player => {
    if (player.carriedCone) disposeCone(player.carriedCone);
    player.baseCones.forEach(disposeCone);
    player.baseCones.length = 0;
    player.carriedCone = null;
    player.speedMultiplier = 1;
    player.mesh.position.copy(player.basePosition);
    player.mesh.rotation.set(0, 0, 0);
  });

  createCenterCones();
  state.roundWasTied = false;
  beginRound();
}

function completeCurrentRoom(rankings, winner) {
  if (!state.currentRoom) return;
  const completedRoom = state.currentRoom;
  const endedAt = new Date().toISOString();
  state.currentRoom = null;

  try {
    const rooms = readRooms().filter(room => room.id !== completedRoom.id);
    const history = readHistory();
    history.unshift({
      id: completedRoom.id,
      roomName: completedRoom.name,
      endedAt,
      round: state.matchRound,
      result: `Best of 3 · ${players.map(player => `${player.name} ${player.roundWins}`).join(' : ')}`,
      players: rankings.map(player => ({
        name: player.name,
        color: `#${player.color.toString(16).padStart(6, '0')}`,
        score: player.roundWins
      }))
    });
    writeRooms(rooms);
    writeHistory(history.slice(0, 50));
  } catch (error) {
    showLobbyMessage(`Match ended, but its history couldn't be saved: ${error.message}`, true);
  }

  void saveCompletedMatchToCloud(
    completedRoom.name,
    state.matchRound,
    players,
    winner.dbId,
    endedAt
  ).then(renderMatchHistory).catch(error => {
    showLobbyMessage(`Match ended, but cloud history couldn't be saved: ${error.message}`, true);
  });
}

function leaveMatch() {
  if (!state.currentRoom) return;
  withLobbyError(() => {
    writeRooms(readRooms().filter(room => room.id !== state.currentRoom.id));
    window.location.reload();
  });
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
      endGame();
    }

    players.forEach(player => {
    movePlayer(player, delta, elapsedTime);
    });
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
