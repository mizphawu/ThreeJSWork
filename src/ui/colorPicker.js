import { PLAYER_COLORS, playerConfigs } from '../data/constants.js';
import { escapeHtml } from '../data/helpers.js';

export function getPlayerColor(player, index) {
  if (typeof player.color === 'string' && /^#[\da-f]{6}$/i.test(player.color)) {
    return player.color.toLowerCase();
  }
  const color = playerConfigs[index % playerConfigs.length].color;
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function colorPicker(fieldName, idPrefix, takenColors = []) {
  const taken = new Set(takenColors);
  const selected = PLAYER_COLORS.find(color => !taken.has(color.hex));

  return `
    <div class="d-flex flex-wrap gap-2" role="radiogroup" aria-label="Choose your player and cone color">
      ${PLAYER_COLORS.map(color => {
        const id = `${idPrefix}-${color.hex.slice(1)}`;
        const isTaken = taken.has(color.hex);
        return `
          <input type="radio" class="btn-check" name="${fieldName}" id="${escapeHtml(id)}"
                 value="${color.hex}" ${color === selected ? 'checked' : ''} ${isTaken ? 'disabled' : ''}>
          <label class="color-swatch rounded-circle border border-2 border-white" for="${escapeHtml(id)}"
                 style="--swatch: ${color.hex}" title="${color.name}${isTaken ? ' (taken)' : ''}">
            <span class="visually-hidden">${color.name}</span>
          </label>`;
      }).join('')}
    </div>`;
}