
import './style.css';
import * as THREE from 'three';

// ==========================================
// 1. SCENE SETUP
// ==========================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x18202c);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 19, 19);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

document.querySelector('#game-container').appendChild(renderer.domElement);

// ==========================================
// 2. LIGHTING
// ==========================================

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const sunlight = new THREE.DirectionalLight(0xffffff, 2);
sunlight.position.set(5, 15, 5);
sunlight.castShadow = true;
scene.add(sunlight);

// ==========================================
// 3. ARENA
// ==========================================

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(20, 0.2, 16),
  new THREE.MeshStandardMaterial({ color: 0x354b42 })
);

ground.position.y = -0.1;
ground.receiveShadow = true;
scene.add(ground);

// Center circle
const centerCircle = new THREE.Mesh(
  new THREE.CircleGeometry(2.2, 48),
  new THREE.MeshStandardMaterial({ color: 0x607a62 })
);

centerCircle.rotation.x = -Math.PI / 2;
centerCircle.position.y = 0.015;
scene.add(centerCircle);

// ==========================================
// 4. GAME UI
// ==========================================

const ui = document.createElement('div');

ui.id = 'game-ui';

ui.innerHTML = `
  <section id="lobby">
    <div class="lobby-panel">
      <h1>CONE CLASH</h1>
      <p class="lobby-subtitle">Create a room and play together on this device.</p>
      <form id="create-room-form" class="create-room-form">
        <label>
          Room name
          <input id="room-name" name="roomName" maxlength="24" placeholder="Friday match" required>
        </label>
        <label>
          Your username
          <input id="create-player-name" name="playerName" maxlength="16" placeholder="Your name" required>
        </label>
        <label>
          Your color
          <input name="playerColor" type="color" value="#ff5252" aria-label="Choose your player and cone color">
        </label>
        <button type="submit">CREATE ROOM</button>
      </form>
      <p id="lobby-message" role="status" aria-live="polite"></p>
      <h2>AVAILABLE ROOMS</h2>
      <div id="room-list"></div>
      <section class="history-section">
        <h2>MATCH HISTORY</h2>
        <div id="match-history"></div>
      </section>
    </div>
  </section>
  <div id="game-hud" class="hidden">
    <div id="timer">45</div>
    <div id="match-status">ROUND 1 · REAL-TIME</div>
    <div id="countdown">GET READY!</div>
    <div id="scores"></div>

    <div id="instructions">
      P1: WASD + E |
      P2: ARROWS + ENTER |
      P3: IJKL + O
      <button id="leave-match" type="button">LEAVE MATCH</button>
    </div>
  </div>

  <div id="podium" class="hidden">
    <h1>GAME OVER!</h1>
    <div id="podium-content"></div>
    <button id="restart">BACK TO LOBBY</button>
  </div>
  <div id="app-message" role="alert" aria-live="assertive"></div>
`;

document.body.appendChild(ui);

// ==========================================
// 5. PLAYER DATA
// ==========================================

const playerConfigs = [
  {
    name: 'PLAYER 1',
    color: 0xff5252,
    position: [0, 0, -6],
    keys: {
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      action: 'KeyE'
    }
  },
  {
    name: 'PLAYER 2',
    color: 0x4287ff,
    position: [-7, 0, 5],
    keys: {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      action: 'Enter'
    }
  },
  {
    name: 'PLAYER 3',
    color: 0xffd447,
    position: [7, 0, 5],
    keys: {
      up: 'KeyI',
      down: 'KeyK',
      left: 'KeyJ',
      right: 'KeyL',
      action: 'KeyO'
    }
  }
];

const players = [];

function createPlayer(config, index, name, color = config.color) {
  const playerColor = Number.parseInt(color.replace('#', ''), 16);
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ color: playerColor })
  );

  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  // Player marker
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: playerColor })
  );

  marker.position.y = 0.1;
  group.add(marker);

  group.position.set(...config.position);

  scene.add(group);

  return {
    name,
    color: playerColor,
    mesh: group,
    keys: config.keys,
    speed: 5,
    speedMultiplier: 1,
    carriedCone: null,
    baseCones: [],
    roundWins: 0,
    basePosition: new THREE.Vector3(
      config.position[0],
      0,
      config.position[2]
    ),
    index
  };
}

// ==========================================
// 6. PLAYER BASES
// ==========================================

function createPlayerBase(player) {
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 1.8, 0.2, 32),
    new THREE.MeshStandardMaterial({
      color: player.color
    })
  );

  base.position.copy(player.basePosition);
  base.position.y = 0.05;

  base.receiveShadow = true;
  scene.add(base);
}

// ==========================================
// 7. CONE CREATION
// ==========================================

const centerCones = [];

function createCone(speedMultiplier = 1) {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 1.1, 16),
    new THREE.MeshStandardMaterial({
      color: 0xff8c32
    })
  );

  cone.position.y = 0.65;
  cone.castShadow = true;

  cone.userData.speedMultiplier = speedMultiplier;
  cone.userData.phase = Math.random() * Math.PI * 2;
  cone.userData.shuffle = null;
  cone.userData.restY = 0.65;

  return cone;
}

const initialConePositions = [
  [-1.2, 0, -0.8],
  [0, 0, -1],
  [1.2, 0, -0.8],
  [-0.7, 0, 0.8],
  [0.7, 0, 0.8]
];

function createCenterCones() {
  initialConePositions.forEach(position => {
    const multiplier = Math.random() < 0.5 ? 0.7 : 1.3;
    const cone = createCone(multiplier);
    cone.position.set(position[0], 0.65, position[2]);
    scene.add(cone);
    centerCones.push(cone);
  });
}

createCenterCones();

function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function chooseShufflePositions(cones) {
  const targets = [];
  const minSpacing = 1.35;
  const bounds = { minX: -4.5, maxX: 4.5, minZ: -3.4, maxZ: 3.4 };

  cones.forEach(cone => {
    let target = null;

    for (let attempt = 0; attempt < 80; attempt++) {
      const candidate = new THREE.Vector3(
        THREE.MathUtils.randFloat(bounds.minX, bounds.maxX),
        0.65,
        THREE.MathUtils.randFloat(bounds.minZ, bounds.maxZ)
      );
      const clearOfTargets = targets.every(
        position => distanceXZ(candidate, position) >= minSpacing
      );
      const movedEnough = distanceXZ(candidate, cone.position) > 0.8;

      if (clearOfTargets && movedEnough) {
        target = candidate;
        break;
      }
    }

    targets.push(target ?? cone.position.clone());
  });

  return targets;
}

function shuffleCones(elapsedTime) {
  const targets = chooseShufflePositions(centerCones);

  centerCones.forEach((cone, index) => {
    cone.userData.shuffle = {
      from: cone.position.clone(),
      to: targets[index],
      startedAt: elapsedTime,
      duration: 1.15 + Math.random() * 0.45
    };
  });
}

function animateCones(elapsedTime) {
  centerCones.forEach(cone => {
    const shuffle = cone.userData.shuffle;

    if (shuffle) {
      const progress = THREE.MathUtils.clamp(
        (elapsedTime - shuffle.startedAt) / shuffle.duration,
        0,
        1
      );
      const eased = progress * progress * (3 - 2 * progress);
      cone.position.lerpVectors(shuffle.from, shuffle.to, eased);
      cone.position.y += Math.sin(progress * Math.PI) * 0.85;

      if (progress === 1) {
        cone.userData.shuffle = null;
        cone.userData.restY = shuffle.to.y;
      }
    } else {
      cone.position.y =
        cone.userData.restY +
        Math.sin(elapsedTime * 2.4 + cone.userData.phase) * 0.12;
    }

    cone.rotation.y += 0.018;
    cone.rotation.z = Math.sin(elapsedTime * 1.8 + cone.userData.phase) * 0.06;
  });
}

// ==========================================
// 8. KEYBOARD INPUT
// ==========================================

const pressedKeys = {};

window.addEventListener('keydown', event => {
  pressedKeys[event.code] = true;

  // Prevent page scrolling
  if (event.code.startsWith('Arrow') || event.code === 'Space') {
    event.preventDefault();
  }

  // Interaction
  players.forEach(player => {
    if (
      event.code === player.keys.action &&
      !event.repeat &&
      gameStarted &&
      !gameOver
    ) {
      interact(player);
    }
  });
});

window.addEventListener('keyup', event => {
  pressedKeys[event.code] = false;
});

// ==========================================
// 9. PICK UP, DEPOSIT AND STEAL
// ==========================================

function interact(player) {

  // If carrying a cone, deposit it at your own base
  if (player.carriedCone) {

    const distance = player.mesh.position.distanceTo(
      player.basePosition
    );

    if (distance < 2.3) {
      const cone = player.carriedCone;

      player.baseCones.push(cone);
      player.carriedCone = null;

      updateBaseCones(player);
      updateScores();

      // First player to reach three wins
      if (player.baseCones.length >= 3) {
        endGame(player);
      }
    }

    return;
  }

  // Find the closest available cone in the center
  let closestCone = null;
  let closestDistance = Infinity;
  let sourceArray = null;
  let sourcePlayer = null;

  centerCones.forEach(cone => {
    const distance = distanceXZ(player.mesh.position, cone.position);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestCone = cone;
      sourceArray = centerCones;
      sourcePlayer = null;
    }
  });

  // Check opponent bases for stealable cones
  players.forEach(opponent => {

    if (opponent === player) return;

    opponent.baseCones.forEach(cone => {
      const distance = distanceXZ(player.mesh.position, opponent.basePosition);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestCone = cone;
        sourceArray = opponent.baseCones;
        sourcePlayer = opponent;
      }
    });
  });

  // Pick up only if close enough
  if (closestCone && closestDistance < 1.8) {

    sourceArray.splice(sourceArray.indexOf(closestCone), 1);

    player.carriedCone = closestCone;

    // Heavy cones speed up, light cones slow down
    player.speedMultiplier = closestCone.userData.speedMultiplier;

    scene.remove(closestCone);

    // Update the stolen-from player's base
    if (sourcePlayer) {
      updateBaseCones(sourcePlayer);
    }

    updateScores();
  }
}

// ==========================================
// 10. UPDATE BASE CONE POSITIONS
// ==========================================

function updateBaseCones(player) {

  player.baseCones.forEach((cone, index) => {

    scene.add(cone);
    cone.material.color.setHex(player.color);

    const angle = index * 1.2;

    cone.position.set(
      player.basePosition.x + Math.cos(angle) * 0.8,
      0.65,
      player.basePosition.z + Math.sin(angle) * 0.8
    );
  });
}

// ==========================================
// 11. PLAYER MOVEMENT
// ==========================================

function movePlayer(player, delta) {

  if (!gameStarted || gameOver) return;

  const keys = player.keys;

  const direction = new THREE.Vector3();

  if (pressedKeys[keys.up]) direction.z -= 1;
  if (pressedKeys[keys.down]) direction.z += 1;
  if (pressedKeys[keys.left]) direction.x -= 1;
  if (pressedKeys[keys.right]) direction.x += 1;

  if (direction.length() > 0) {

    direction.normalize();

    const movementSpeed =
      player.speed * player.speedMultiplier;

    player.mesh.position.addScaledVector(
      direction,
      movementSpeed * delta
    );

    // Rotate character toward movement direction
    player.mesh.rotation.y = Math.atan2(
      direction.x,
      direction.z
    );
  }

  // Arena boundaries
  player.mesh.position.x = THREE.MathUtils.clamp(
    player.mesh.position.x,
    -9,
    9
  );

  player.mesh.position.z = THREE.MathUtils.clamp(
    player.mesh.position.z,
    -7,
    7
  );

  // Keep carried cone above player
  if (player.carriedCone) {

    const offset = new THREE.Vector3(0, 2, 0);

    player.carriedCone.position.copy(
      player.mesh.position
    ).add(offset);
  }
}

// ==========================================
// 12. SCOREBOARD
// ==========================================

let currentRoom = null;
let matchRound = 1;
const ROUNDS_TO_WIN_MATCH = 2;
let roundWasTied = false;
let matchComplete = false;

function updateMatchStatus() {
  const seriesScore = players
    .map(player => `${escapeHtml(player.name)} ${player.roundWins}`)
    .join(' : ');
  document.querySelector('#match-status').textContent =
    `ROUND ${matchRound} · SERIES ${seriesScore}`;
}

function updateScores() {

  const scoreElement = document.querySelector('#scores');

  scoreElement.innerHTML = players.map(player => `
    <div style="color: #${player.color.toString(16).padStart(6, '0')}">
      ${escapeHtml(player.name)}: ${player.baseCones.length} cones · ${player.roundWins} rounds
    </div>
  `).join('');

  if (currentRoom) {
    try {
      const rooms = readRooms();
      const room = rooms.find(item => item.id === currentRoom.id);
      if (room) {
        room.round = matchRound;
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

// ==========================================
// 13. GAME TIMER
// ==========================================

let countdown = 3;
let gameTime = 45;

let gameStarted = false;
let gameOver = false;
let matchElapsed = 0;
let nextConeShuffleAt = 7;

const countdownElement = document.querySelector('#countdown');
const timerElement = document.querySelector('#timer');

function startCountdown() {

  countdownElement.textContent = countdown;

  const interval = setInterval(() => {

    countdown--;

    if (countdown > 0) {
      countdownElement.textContent = countdown;
    } else {

      clearInterval(interval);

      countdownElement.textContent = 'GO!';
      gameStarted = true;

      setTimeout(() => {
        countdownElement.textContent = '';
      }, 800);
    }

  }, 1000);
}

// ==========================================
// 14. END GAME AND PODIUM
// ==========================================

function endGame(winner = null) {

  if (gameOver) return;

  gameOver = true;
  gameStarted = false;
  document.querySelector('#game-hud').classList.add('hidden');

  const rankings = [...players].sort(
    (a, b) => b.baseCones.length - a.baseCones.length
  );
  const roundLeader = winner ?? (rankings[0].baseCones.length > rankings[1].baseCones.length
    ? rankings[0]
    : null);
  roundWasTied = !roundLeader;
  if (roundLeader) roundLeader.roundWins++;
  updateScores();
  updateMatchStatus();

  const podium = document.querySelector('#podium');
  const podiumContent = document.querySelector('#podium-content');

  const medals = ['🥇', '🥈', '🥉'];

  const matchWinner = roundLeader?.roundWins >= ROUNDS_TO_WIN_MATCH ? roundLeader : null;
  const displayRankings = matchWinner
    ? [...players].sort((a, b) => b.roundWins - a.roundWins || b.baseCones.length - a.baseCones.length)
    : rankings;

  podiumContent.innerHTML = displayRankings.map((player, index) => `
    <div class="rank rank-${index + 1}">
      <h2>${medals[index]} ${index + 1} ${matchWinner ? 'OVERALL' : 'ROUND'}</h2>
      <h3>${escapeHtml(player.name)}</h3>
      <p>${matchWinner ? player.roundWins + ' ROUND WINS' : player.baseCones.length + ' CONES'}</p>
    </div>
  `).join('');

  if (matchWinner) {
    matchComplete = true;
    podium.querySelector('h1').textContent = `${matchWinner.name} WINS THE MATCH!`;
    document.querySelector('#restart').textContent = 'BACK TO LOBBY';
    completeCurrentRoom(displayRankings, matchWinner);
  } else if (roundLeader) {
    podium.querySelector('h1').textContent =
      `${roundLeader.name} WINS ROUND ${matchRound}!`;
    document.querySelector('#restart').textContent = `START ROUND ${matchRound + 1}`;
  } else {
    podium.querySelector('h1').textContent = `ROUND ${matchRound} TIED!`;
    document.querySelector('#restart').textContent = `REPLAY ROUND ${matchRound}`;
  }

  podium.classList.remove('hidden');
}

// ==========================================
// 15. RESTART GAME
// ==========================================

document.querySelector('#restart').addEventListener('click', () => {
  if (players.length && currentRoom && !matchComplete) {
    startNextRound();
  } else {
    window.location.reload();
  }
});

// ==========================================
// 16. LOCAL ROOM LOBBY
// ==========================================

const ROOMS_KEY = 'cone-clash-rooms';
const HISTORY_KEY = 'cone-clash-history';
const MAX_PLAYERS = 3;
const lobbyMessage = document.querySelector('#lobby-message');
const appMessage = document.querySelector('#app-message');
const roomList = document.querySelector('#room-list');
const historyList = document.querySelector('#match-history');

function showLobbyMessage(message, isError = false) {
  lobbyMessage.textContent = message;
  lobbyMessage.classList.toggle('error', isError);
  appMessage.textContent = isError ? message : '';
  appMessage.classList.toggle('visible', isError);
}

function readCollection(key, label) {
  const raw = localStorage.getItem(key);
  if (raw === null) return [];

  const value = JSON.parse(raw);
  if (!Array.isArray(value)) {
    throw new Error(`Saved ${label} data is invalid.`);
  }
  return value;
}

function readRooms() {
  return readCollection(ROOMS_KEY, 'room');
}

function writeRooms(rooms) {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

function readHistory() {
  return readCollection(HISTORY_KEY, 'history');
}

function writeHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function withLobbyError(action) {
  try {
    action();
  } catch (error) {
    showLobbyMessage(`Couldn't update the lobby: ${error.message}`, true);
  }
}

function renderLobby() {
  withLobbyError(() => {
    const rooms = readRooms().filter(room => room.status === 'waiting');
    roomList.innerHTML = rooms.length ? rooms.map(room => `
      <article class="room-card">
        <div class="room-heading">
          <h3>${escapeHtml(room.name)}</h3>
          <span>${room.players.length}/${MAX_PLAYERS} PLAYERS</span>
        </div>
        <ul class="room-players">
          ${room.players.map((player, index) => `
            <li>
              <span class="room-player-name">
                <span class="player-color-swatch" style="--player-color: ${getPlayerColor(player, index)}"></span>
                ${escapeHtml(player.name)}
              </span>
              <input class="room-player-color" type="color" value="${getPlayerColor(player, index)}" data-room-id="${escapeHtml(room.id)}" data-player-id="${escapeHtml(player.id)}" aria-label="Change ${escapeHtml(player.name)}'s color">
              <button type="button" class="remove-player" data-room-id="${escapeHtml(room.id)}" data-player-id="${escapeHtml(player.id)}" aria-label="Remove ${escapeHtml(player.name)}">LEAVE</button>
            </li>
          `).join('')}
        </ul>
        <form class="join-room-form" data-room-id="${escapeHtml(room.id)}">
          <input name="playerName" maxlength="16" placeholder="Username to join" aria-label="Username to join ${escapeHtml(room.name)}" required>
          <label class="join-color-label">Color <input name="playerColor" type="color" value="${defaultPlayerColor(room.players)}" aria-label="Choose your player and cone color"></label>
          <button type="submit" ${room.players.length >= MAX_PLAYERS ? 'disabled' : ''}>JOIN</button>
          <button type="button" class="start-match" data-room-id="${escapeHtml(room.id)}" ${room.players.length < 2 ? 'disabled' : ''}>START MATCH</button>
        </form>
      </article>
    `).join('') : '<p class="empty-state">No rooms yet. Create one to get started.</p>';

    const history = readHistory();
    historyList.innerHTML = history.length ? history.slice(0, 10).map(match => `
      <article class="history-card">
        <strong>${escapeHtml(match.roomName)}</strong>
        <span>${escapeHtml(match.result)} · FINISHED IN ROUND ${match.round}</span>
        <time>${escapeHtml(new Date(match.endedAt).toLocaleString())}</time>
        <p class="history-players">${match.players.map((player, index) => `
          <span class="history-player">
            <span class="player-color-swatch" style="--player-color: ${getPlayerColor(player, index)}"></span>
            ${escapeHtml(player.name)}: ${player.score} round wins
          </span>
        `).join('')}</p>
      </article>
    `).join('') : '<p class="empty-state">Completed matches will show up here.</p>';
  });
}

function makeId() {
  return crypto.randomUUID();
}

function getPlayerColor(player, index) {
  if (typeof player.color === 'string' && /^#[\da-f]{6}$/i.test(player.color)) {
    return player.color.toLowerCase();
  }
  const color = playerConfigs[index % playerConfigs.length].color;
  return `#${color.toString(16).padStart(6, '0')}`;
}

function defaultPlayerColor(roomPlayers) {
  const usedColors = new Set(roomPlayers.map((player, index) => getPlayerColor(player, index)));
  const available = playerConfigs
    .map(config => `#${config.color.toString(16).padStart(6, '0')}`)
    .find(color => !usedColors.has(color));
  return available ?? '#ff5252';
}

function validateColor(value) {
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) {
    throw new Error('Choose a valid player color.');
  }
  return value.toLowerCase();
}

function validateName(value, label) {
  const name = value.trim();
  if (!name || name.length > 24) {
    throw new Error(`${label} must be between 1 and 24 characters.`);
  }
  return name;
}

document.querySelector('#create-room-form').addEventListener('submit', event => {
  event.preventDefault();
  withLobbyError(() => {
    const form = new FormData(event.currentTarget);
    const roomName = validateName(form.get('roomName'), 'Room name');
    const playerName = validateName(form.get('playerName'), 'Username');
    const playerColor = validateColor(form.get('playerColor'));
    if (playerName.length > 16) throw new Error('Username must be 16 characters or fewer.');

    const rooms = readRooms();
    rooms.push({
      id: makeId(),
      name: roomName,
      status: 'waiting',
      createdAt: new Date().toISOString(),
      players: [{ id: makeId(), name: playerName, color: playerColor, score: 0 }]
    });
    writeRooms(rooms);
    event.currentTarget.reset();
    showLobbyMessage(`Room "${roomName}" created.`);
    renderLobby();
  });
});

roomList.addEventListener('submit', event => {
  if (!event.target.matches('.join-room-form')) return;
  event.preventDefault();
  withLobbyError(() => {
    const roomId = event.target.dataset.roomId;
    const form = new FormData(event.target);
    const playerName = validateName(form.get('playerName'), 'Username');
    const playerColor = validateColor(form.get('playerColor'));
    if (playerName.length > 16) throw new Error('Username must be 16 characters or fewer.');

    const rooms = readRooms();
    const room = rooms.find(item => item.id === roomId && item.status === 'waiting');
    if (!room) throw new Error('That room is no longer available.');
    if (room.players.length >= MAX_PLAYERS) throw new Error('That room is full.');
    if (room.players.some(player => player.name.toLowerCase() === playerName.toLowerCase())) {
      throw new Error('That username is already in this room.');
    }

    room.players.push({ id: makeId(), name: playerName, color: playerColor, score: 0 });
    writeRooms(rooms);
    showLobbyMessage(`${playerName} joined "${room.name}".`);
    renderLobby();
  });
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

function startMatch(roomId) {
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
  currentRoom = room;
  matchRound = 1;
  roundWasTied = false;
  matchComplete = false;
  matchElapsed = 0;
  nextConeShuffleAt = 7;

  room.players.forEach((roomPlayer, index) => {
    const player = createPlayer(
      playerConfigs[index],
      index,
      roomPlayer.name,
      getPlayerColor(roomPlayer, index)
    );
    player.id = roomPlayer.id;
    players.push(player);
    createPlayerBase(player);
  });

  document.querySelector('#instructions').firstChild.textContent = players
    .map((player, index) => `P${index + 1}: ${Object.entries(player.keys).map(([action, key]) => `${action.toUpperCase()} ${key.replace('Key', '')}`).join(' / ')}`)
    .join('  |  ');
  document.querySelector('#lobby').classList.add('hidden');
  document.querySelector('#game-hud').classList.remove('hidden');
  updateScores();
  updateMatchStatus();
  showLobbyMessage('');
  beginRound();
}

function disposeCone(cone) {
  scene.remove(cone);
  cone.geometry.dispose();
  cone.material.dispose();
}

function beginRound() {
  gameOver = false;
  gameStarted = false;
  countdown = 3;
  gameTime = 45;
  matchElapsed = 0;
  nextConeShuffleAt = 7;
  timerElement.textContent = gameTime;
  countdownElement.textContent = '';
  document.querySelector('#podium').classList.add('hidden');
  document.querySelector('#game-hud').classList.remove('hidden');
  updateScores();
  updateMatchStatus();
  startCountdown();
}

function startNextRound() {
  if (!roundWasTied) matchRound++;

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
  roundWasTied = false;
  beginRound();
}

function completeCurrentRoom(rankings, winner) {
  if (!currentRoom) return;
  try {
    const rooms = readRooms().filter(room => room.id !== currentRoom.id);
    const history = readHistory();
    history.unshift({
      id: currentRoom.id,
      roomName: currentRoom.name,
      endedAt: new Date().toISOString(),
      round: matchRound,
      result: `Best of 3 · ${players.map(player => `${player.name} ${player.roundWins}`).join(' : ')}`,
      players: rankings.map(player => ({
        name: player.name,
        color: `#${player.color.toString(16).padStart(6, '0')}`,
        score: player.roundWins
      }))
    });
    writeRooms(rooms);
    writeHistory(history.slice(0, 50));
    currentRoom = null;
  } catch (error) {
    showLobbyMessage(`Match ended, but its history couldn't be saved: ${error.message}`, true);
  }
}

document.querySelector('#leave-match').addEventListener('click', () => {
  if (!currentRoom) return;
  withLobbyError(() => {
    writeRooms(readRooms().filter(room => room.id !== currentRoom.id));
    window.location.reload();
  });
});

window.addEventListener('storage', event => {
  if (event.key === ROOMS_KEY || event.key === HISTORY_KEY) renderLobby();
});

window.addEventListener('pagehide', () => {
  if (!currentRoom) return;
  writeRooms(readRooms().filter(room => room.id !== currentRoom.id));
});

renderLobby();

// ==========================================
// 17. MAIN GAME LOOP
// ==========================================

const clock = new THREE.Clock();

function animate() {

  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsedTime = clock.elapsedTime;
  animateCones(elapsedTime);

  if (gameStarted && !gameOver) {

    matchElapsed += delta;
    if (matchElapsed >= nextConeShuffleAt) {
      shuffleCones(elapsedTime);
      nextConeShuffleAt = matchElapsed + 8;
    }

    gameTime -= delta;

    timerElement.textContent = Math.ceil(
      Math.max(gameTime, 0)
    );

    if (gameTime <= 0) {
      gameTime = 0;
      endGame();
    }

    players.forEach(player => {
      movePlayer(player, delta);
    });
  }

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// ==========================================
// 18. WINDOW RESIZE
// ==========================================

window.addEventListener('resize', () => {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
});
