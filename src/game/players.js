import * as THREE from 'three';
import { scene } from './world.js';
export const players = [];

export function createPlayer(config, index, name, color = config.color) {
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

export function createPlayerBase(player) {
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

export function updateBaseCones(player) {
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