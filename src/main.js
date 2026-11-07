
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
  <div id="timer">45</div>
  <div id="countdown">GET READY!</div>
  <div id="scores"></div>

  <div id="instructions">
    P1: WASD + E |
    P2: ARROWS + ENTER |
    P3: IJKL + O
  </div>

  <div id="podium" class="hidden">
    <h1>GAME OVER!</h1>
    <div id="podium-content"></div>
    <button id="restart">PLAY AGAIN</button>
  </div>
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

function createPlayer(config, index) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 0.7, 4, 8),
    new THREE.MeshStandardMaterial({ color: config.color })
  );

  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);

  // Player marker
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.85, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: config.color })
  );

  marker.position.y = 0.1;
  group.add(marker);

  group.position.set(...config.position);

  scene.add(group);

  return {
    name: config.name,
    color: config.color,
    mesh: group,
    keys: config.keys,
    speed: 5,
    speedMultiplier: 1,
    carriedCone: null,
    baseCones: [],
    basePosition: new THREE.Vector3(
      config.position[0],
      0,
      config.position[2]
    ),
    index
  };
}

playerConfigs.forEach((config, index) => {
  players.push(createPlayer(config, index));
});

// ==========================================
// 6. PLAYER BASES
// ==========================================

players.forEach(player => {
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
});

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

  return cone;
}

// Create exactly five cones
for (let i = 0; i < 5; i++) {
  const multiplier = Math.random() < 0.5 ? 0.7 : 1.3;

  const cone = createCone(multiplier);

  const positions = [
    [-1.2, 0, -0.8],
    [0, 0, -1],
    [1.2, 0, -0.8],
    [-0.7, 0, 0.8],
    [0.7, 0, 0.8]
  ];

  cone.position.set(...positions[i]);

  scene.add(cone);
  centerCones.push(cone);
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
    const distance = player.mesh.position.distanceTo(cone.position);

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
      const distance = player.mesh.position.distanceTo(
        opponent.basePosition
      );

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

function updateScores() {

  const scoreElement = document.querySelector('#scores');

  scoreElement.innerHTML = players.map(player => `
    <div style="color: #${player.color.toString(16).padStart(6, '0')}">
      ${player.name}: ${player.baseCones.length}
    </div>
  `).join('');
}

updateScores();

// ==========================================
// 13. GAME TIMER
// ==========================================

let countdown = 3;
let gameTime = 45;

let gameStarted = false;
let gameOver = false;

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

  const rankings = [...players].sort(
    (a, b) => b.baseCones.length - a.baseCones.length
  );

  const podium = document.querySelector('#podium');
  const podiumContent = document.querySelector('#podium-content');

  const medals = ['🥇', '🥈', '🥉'];

  podiumContent.innerHTML = rankings.map((player, index) => `
    <div class="rank rank-${index + 1}">
      <h2>${medals[index]} ${index + 1} PLACE</h2>
      <h3>${player.name}</h3>
      <p>${player.baseCones.length} CONES</p>
    </div>
  `).join('');

  if (winner) {
    podium.querySelector('h1').textContent =
      `${winner.name} WINS!`;
  } else {
    podium.querySelector('h1').textContent = 'TIME IS UP!';
  }

  podium.classList.remove('hidden');
}

// ==========================================
// 15. RESTART GAME
// ==========================================

document.querySelector('#restart').addEventListener('click', () => {
  window.location.reload();
});

// ==========================================
// 16. MAIN GAME LOOP
// ==========================================

const clock = new THREE.Clock();

function animate() {

  const delta = Math.min(clock.getDelta(), 0.05);

  if (gameStarted && !gameOver) {

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

startCountdown();
renderer.setAnimationLoop(animate);

// ==========================================
// 17. WINDOW RESIZE
// ==========================================

window.addEventListener('resize', () => {

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );
});
