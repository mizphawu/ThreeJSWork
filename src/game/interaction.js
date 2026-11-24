import { scene } from './world.js';
import { players, updateBaseCones } from './players.js';
import { centerCones } from './cones.js';
import { distanceXZ } from '../data/helpers.js';

export function interact(player, { onScoreChange, onWin }) {

  // If carrying a cone, deposit it at your own base
  if (player.carriedCone) {
    const distance = player.mesh.position.distanceTo(player.basePosition);

    if (distance < 2.3) {
      const cone = player.carriedCone;

      player.baseCones.push(cone);
      player.carriedCone = null;
      player.speedMultiplier = 1;

      updateBaseCones(player);
      onScoreChange();

      // First player to reach three wins
      if (player.baseCones.length >= 3) {
        onWin(player);
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

    onScoreChange();
  }
}