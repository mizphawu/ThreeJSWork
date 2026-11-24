import { state } from './state.js';
import { players } from './players.js';
import { centerCones, createCenterCones, disposeCone } from './cones.js';
import { updateScores } from './scores.js';
import { updateMatchStatus } from '../ui/scoreboard.js';
import { clearConfetti } from '../ui/confettiYEY.js';

function startCountdown() {
  const countdownElement = document.querySelector('#countdown');

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

export function beginRound() {
  clearConfetti();
  state.gameOver = false;
  state.gameStarted = false;
  state.countdown = 3;
  state.gameTime = 60;
  state.matchElapsed = 0;
  state.nextConeShuffleAt = 7;
  document.querySelector('#timer').textContent = state.gameTime;
  document.querySelector('#countdown').textContent = '';
  document.querySelector('#podium').classList.add('hidden');
  document.querySelector('#game-hud').classList.remove('hidden');
  updateScores();
  updateMatchStatus();
  startCountdown();
}

export function startNextRound() {
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