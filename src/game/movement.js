import * as THREE from 'three';
import { pressedKeys } from './input.js';

export function movePlayer(player, delta, elapsedTime) {
  const keys = player.keys;

  const direction = new THREE.Vector3();

  if (pressedKeys[keys.up]) direction.z -= 1;
  if (pressedKeys[keys.down]) direction.z += 1;
  if (pressedKeys[keys.left]) direction.x -= 1;
  if (pressedKeys[keys.right]) direction.x += 1;

  if (direction.length() > 0) {
    direction.normalize();

    const movementSpeed = player.speed * player.speedMultiplier;

    player.mesh.position.addScaledVector(direction, movementSpeed * delta);

    // Rotate character toward movement direction
    player.mesh.rotation.y = Math.atan2(direction.x, direction.z);
  }

  // Arena boundaries
  player.mesh.position.x = THREE.MathUtils.clamp(player.mesh.position.x, -9, 9);
  player.mesh.position.z = THREE.MathUtils.clamp(player.mesh.position.z, -7, 7);

  // Carried cone floats above the head, bobbing and spinning
  if (player.carriedCone) {
    player.carriedCone.position.set(
      player.mesh.position.x,
      2.6 + Math.sin(elapsedTime * 5) * 0.12,
      player.mesh.position.z
    );
    player.carriedCone.rotation.y += 0.05;
  }
}