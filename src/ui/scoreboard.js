import { state } from '../game/state.js';
import { players } from '../game/players.js';
import { escapeHtml } from '../data/helpers.js';

export function updateMatchStatus() {
  const seriesScore = players
    .map(player => `${escapeHtml(player.name)} ${player.roundWins}`)
    .join(' : ');
  document.querySelector('#match-status').textContent =
    `ROUND ${state.matchRound} · SERIES ${seriesScore}`;
}

export function renderScores() {
  const scoreElement = document.querySelector('#scores');

  scoreElement.innerHTML = players.map(player => `
    <div style="color: #${player.color.toString(16).padStart(6, '0')}">
      ${escapeHtml(player.name)}: ${player.baseCones.length} cones · ${player.roundWins} rounds
    </div>
  `).join('');
}