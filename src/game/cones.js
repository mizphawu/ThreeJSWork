import * as THREE from 'three';
import { scene } from './world.js';
import { distanceXZ } from '../data/helpers.js';

export const centerCones = [];

export function createCone(speedMultiplier = 1) {
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

export function createCenterCones() {
  initialConePositions.forEach(position => {
    const multiplier = Math.random() < 0.5 ? 0.7 : 1.3;
    const cone = createCone(multiplier);
    cone.position.set(position[0], 0.65, position[2]);
    scene.add(cone);
    centerCones.push(cone);
  });
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

export function shuffleCones(elapsedTime) {
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

export function animateCones(elapsedTime) {
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

export function disposeCone(cone) {
  scene.remove(cone);
  cone.geometry.dispose();
  cone.material.dispose();
}