import { players } from '../game/players.js';
import { escapeHtml } from '../data/helpers.js';

const KEY_LABELS = {
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter'
};

function keyLabel(code) {
  return KEY_LABELS[code] ?? code.replace(/^Key/, '');
}

export function controlsMarkup(keys) {
  const kbd = code => `<kbd>${keyLabel(code)}</kbd>`;
  return `<span class="me-3">Move ${[keys.up, keys.left, keys.down, keys.right].map(kbd).join(' ')}</span>` +
         `<span>Action ${kbd(keys.action)}</span>`;
}

export function hideWithAnimation(element, duration = 300) {
  return new Promise(resolve => {
    element.classList.add('leaving');
    setTimeout(() => {
      element.classList.add('hidden');
      element.classList.remove('leaving');
      resolve();
    }, duration);
  });
}

let readyLocked = false;

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

export function showReadyScreen() {
  readyLocked = false;
  players.forEach(player => { player.ready = false; });
  renderReadyScreen();
  document.querySelector('#ready-screen').classList.remove('hidden');
}

export function setupReadyScreen({ onAllReady }) {
  document.querySelector('#ready-players').addEventListener('click', event => {
    const button = event.target.closest('.ready-toggle');
    if (!button || readyLocked) return;

    const player = players[Number(button.dataset.playerIndex)];
    player.ready = !player.ready;
    renderReadyScreen();

    if (players.every(item => item.ready)) {
      readyLocked = true;
      hideWithAnimation(document.querySelector('#ready-screen')).then(onAllReady);
    }
  });
}