import * as THREE from 'three';

// SCENE

export const scene = new THREE.Scene();
const skyColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--bs-info-bg-subtle').trim() || '#cff4fc';
scene.background = new THREE.Color(skyColor);

// CAMERA

export const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);

camera.position.set(0, 19, 19);
camera.lookAt(0, 0, 0);

// RENDERER

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

document.querySelector('#game-container').appendChild(renderer.domElement);

// LIGHTING

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const sunlight = new THREE.DirectionalLight(0xffffff, 2);
sunlight.position.set(5, 15, 5);
sunlight.castShadow = true;
scene.add(sunlight);

// ARENA

const ground = new THREE.Mesh(
  new THREE.BoxGeometry(20, 0.2, 16),
  new THREE.MeshStandardMaterial({ color: 0x354b42 })
);

ground.position.y = -0.1;
ground.receiveShadow = true;
scene.add(ground);

const centerCircle = new THREE.Mesh(
  new THREE.CircleGeometry(2.2, 48),
  new THREE.MeshStandardMaterial({ color: 0x607a62 })
);

centerCircle.rotation.x = -Math.PI / 2;
centerCircle.position.y = 0.015;
scene.add(centerCircle);

// WINDOW RESIZE

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});