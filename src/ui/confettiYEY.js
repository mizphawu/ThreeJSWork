import confetti from 'canvas-confetti';

let confettiTimer = null;
let confettiFrame = null;

export function launchConfetti(accent, big = false) {
  const colors = [accent, accent, '#ff8c32', '#ffd447', '#ff6fa8', '#6aa8ff', '#5fd9b0', '#ffffff'];

  // middle
  confetti({ particleCount: big ? 160 : 90, spread: 100, startVelocity: 45, origin: { x: 0.5, y: 0.65 }, colors });

  //both sides
  const end = Date.now() + (big ? 3500 : 1800);
  (function frame() {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.75 }, colors });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.75 }, colors });
    if (Date.now() < end) confettiFrame = requestAnimationFrame(frame);
  })();
}

export function scheduleConfetti(accent, big, delay) {
  confettiTimer = setTimeout(() => launchConfetti(accent, big), delay);
}

export function clearConfetti() {
  clearTimeout(confettiTimer);
  cancelAnimationFrame(confettiFrame);
  confetti.reset();
}