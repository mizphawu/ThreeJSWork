import confetti from 'canvas-confetti';
import 'bootstrap/dist/css/bootstrap.min.css';
import { supabase } from './supabaseClient.js';
import { initMenu } from './menu.js';
import './style.css';
import * as THREE from 'three';

// 1. SCENE SETUP

const scene = new THREE.Scene();
const skyColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--bs-info-bg-subtle').trim() || '#cff4fc';
scene.background = new THREE.Color(skyColor);

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

// 2. LIGHTING

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const sunlight = new THREE.DirectionalLight(0xffffff, 2);
sunlight.position.set(5, 15, 5);
sunlight.castShadow = true;
scene.add(sunlight);

// 3. ARENA

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

// 4. GAME UI

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

const PLAYER_COLORS = [
  { name: 'Red', hex: '#ff5252' },
  { name: 'Pink', hex: '#ff6fa8' },
  { name: 'Magenta', hex: '#e040fb' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Blue', hex: '#4287ff' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Yellow', hex: '#ffd447' },
  { name: 'Lavender', hex: '#c4b5fd' },
];

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

// 5. PLAYER DATA

const playerConfigs = [
  {
    name: 'PLAYER 1',
    color: 0xff5252,
    position: [0, 0, -6.5],
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
    position: [-5.6, 0, 3.25],
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
    position: [5.6, 0, 3.25],
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
    ready: false,
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

// 6. PLAYER BASES

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

// 7. CONE CREATION

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

// 8. KEYBOARD INPUT

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

// 9. PICK UP, DEPOSIT AND STEAL

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
      player.speedMultiplier = 1;

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

    // Show the cone floating above the player's head
    scene.add(closestCone);
    closestCone.scale.setScalar(0.8);
    closestCone.rotation.set(0, 0, 0);

    // Update the stolen-from player's base
    if (sourcePlayer) {
      updateBaseCones(sourcePlayer);
    }

    updateScores();
  }
}

// 10. UPDATE CONE POSITIONS

function updateBaseCones(player) {

  player.baseCones.forEach((cone, index) => {

    scene.add(cone);
    cone.material.color.setHex(player.color);
    cone.scale.setScalar(1);
    cone.rotation.set(0, 0, 0);

    const angle = index * 1.2;

    cone.position.set(
      player.basePosition.x + Math.cos(angle) * 0.8,
      0.65,
      player.basePosition.z + Math.sin(angle) * 0.8
    );
  });
}

// 11. PLAYER MOVEMENT

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
    // Carried cone floats above the head, bobbing and spinning
  if (player.carriedCone) {
    player.carriedCone.position.set(
      player.mesh.position.x,
      2.6 + Math.sin(clock.elapsedTime * 5) * 0.12,
      player.mesh.position.z
    );
    player.carriedCone.rotation.y += 0.05;
  }
}

// SCOREBOARD

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

// 13. GAME TIMER

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
    matchComplete = true;
    title.textContent = `${matchWinner.name} WINS THE MATCH!`;
    subtitle.textContent = `Final series: ${series}`;
    trophy.textContent = '🏆';
    document.querySelector('#restart').textContent = 'BACK TO LOBBY';
    completeCurrentRoom(displayRankings, matchWinner);
  } else if (roundLeader) {
    title.textContent = `${roundLeader.name} WINS ROUND ${matchRound}!`;
    subtitle.textContent = `Series: ${series}`;
    trophy.textContent = '🎉';
    document.querySelector('#restart').textContent = `START ROUND ${matchRound + 1}`;
  } else {
    title.textContent = `ROUND ${matchRound} TIED!`;
    subtitle.textContent = 'Nobody takes the cones this time.';
    trophy.textContent = '🤝';
    document.querySelector('#restart').textContent = `REPLAY ROUND ${matchRound}`;
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
  if (players.length && currentRoom && !matchComplete) {
    startNextRound();
  } else {
    window.location.reload();
  }
});

// 16. LOCAL ROOM LOBBY

const ROOMS_KEY = 'cone-clash-rooms';
const HISTORY_KEY = 'cone-clash-history';
const MAX_PLAYERS = 3;
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

async function fetchMatchHistoryWithJoin() {
  const { data, error } = await supabase
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

  if (error) {
    historyFetchFailed = true;
    showLobbyMessage(`Failed to load history: ${error.message}`, true);
    return [];
  }
  return data;
}

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
  const { error } = await supabase.from('matches').delete().eq('id', matchId);
  if (error) throw error;
  showLobbyMessage('Match deleted.');
  await renderMatchHistory();
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

async function registerPlayerWithAvatar(username, color, avatarFile) {
  let avatarUrl = null;

  if (avatarFile && avatarFile.size > 0) {
    if (!avatarFile.type.startsWith('image/')) {
      throw new Error('Choose a valid image file for the avatar.');
    }
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, avatarFile);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    avatarUrl = data.publicUrl;
  }

  const { data: player, error } = await supabase
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

function disposeCone(cone) {
  scene.remove(cone);
  cone.geometry.dispose();
  cone.material.dispose();
}

function beginRound() {
  clearConfetti();
  gameOver = false;
  gameStarted = false;
  countdown = 3;
  gameTime = 60;
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
  const completedRoom = currentRoom;
  const endedAt = new Date().toISOString();
  currentRoom = null;

  try {
    const rooms = readRooms().filter(room => room.id !== completedRoom.id);
    const history = readHistory();
    history.unshift({
      id: completedRoom.id,
      roomName: completedRoom.name,
      endedAt,
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
  } catch (error) {
    showLobbyMessage(`Match ended, but its history couldn't be saved: ${error.message}`, true);
  }

  void saveCompletedMatchToCloud(
    completedRoom.name,
    matchRound,
    players,
    winner.dbId,
    endedAt
  ).then(renderMatchHistory).catch(error => {
    showLobbyMessage(`Match ended, but cloud history couldn't be saved: ${error.message}`, true);
  });
}

async function saveCompletedMatchToCloud(roomName, totalRounds, finalPlayers, winnerId, endedAt) {
  if (finalPlayers.some(player => !player.dbId)) {
    throw new Error('One or more players are missing their Supabase player record. Recreate the room to save cloud history.');
  }

  const { data: match, error: matchError } = await supabase
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

  const { error: participantError } = await supabase
    .from('match_participants')
    .insert(participantRows);

  if (participantError) throw participantError;
}

function leaveMatch() {
  if (!currentRoom) return;
  withLobbyError(() => {
    writeRooms(readRooms().filter(room => room.id !== currentRoom.id));
    window.location.reload();
  });
}

document.querySelector('#leave-match').addEventListener('click', leaveMatch);
document.querySelector('#ready-leave').addEventListener('click', leaveMatch);

window.addEventListener('storage', event => {
  if (event.key === ROOMS_KEY || event.key === HISTORY_KEY) renderLobby();
});

window.addEventListener('pagehide', () => {
  if (!currentRoom) return;
  writeRooms(readRooms().filter(room => room.id !== currentRoom.id));
});

renderLobby();

// 17. MAIN GAME LOOP

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

// 18. WINDOW RESIZE

window.addEventListener('resize', () => {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
});
