import { escapeHtml } from '../data/helpers.js';

export const playerHex = player => `#${player.color.toString(16).padStart(6, '0')}`;

// Dark or white text, whichever reads better on the player's color
function textClassFor(hex) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? 'text-dark' : 'text-white';
}

const MEDALS = ['🥇', '🥈', '🥉'];

// Rank order
const PODIUM_ORDER   = ['order-2', 'order-1', 'order-3'];
const PODIUM_HEIGHTS = ['h-100', 'h-75', 'h-50'];
const RISE_DELAYS    = [1200, 700, 300];

export function renderPodium({ rankings, showRoundWins, title, subtitle, trophy, buttonText }) {
  const podium = document.querySelector('#podium');

  podium.querySelector('#podium-content').innerHTML = rankings.map((player, index) => {
    const hex = playerHex(player);
    const detail = showRoundWins
      ? `${player.roundWins} round win${player.roundWins === 1 ? '' : 's'}`
      : `${player.baseCones.length} cone${player.baseCones.length === 1 ? '' : 's'}`;

    return `
      <div class="col-4 h-100 d-flex align-items-end podium-step podium-step-${index + 1} ${PODIUM_ORDER[index]}"
           style="--delay: ${RISE_DELAYS[index]}ms">
        <div class="card w-100 ${PODIUM_HEIGHTS[index]} rounded-top-4 rounded-bottom-0 shadow
                    ${index === 0 ? 'border border-4 border-warning' : 'border-0'} ${textClassFor(hex)}"
             style="background: ${hex}">
          <div class="card-body p-2 d-flex flex-column align-items-center justify-content-center gap-1">
            <span class="podium-medal fs-1 lh-1">${MEDALS[index]}</span>
            <div class="fw-bolder w-100 text-truncate">${escapeHtml(player.name)}</div>
            <div class="small fw-semibold opacity-75">${detail}</div>
          </div>
        </div>
      </div>`;
  }).join('');

  podium.querySelector('h1').textContent = title;
  podium.querySelector('#podium-subtitle').textContent = subtitle;
  podium.querySelector('#podium-trophy').textContent = trophy;
  podium.querySelector('#restart').textContent = buttonText;

  podium.classList.remove('hidden');
}