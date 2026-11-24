import { MAX_PLAYERS } from '../data/constants.js';
import { escapeHtml } from '../data/helpers.js';
import { colorPicker, getPlayerColor } from './colorPicker.js';

export function renderRoomList(container, rooms) {
  container.innerHTML = rooms.length ? rooms.map(room => `
    <div class="card border-0 border-start border-5 border-success rounded-4 shadow-sm mb-3 room-card">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-3">
          <h3 class="h5 fw-bolder mb-0"> ${escapeHtml(room.name)}</h3>
          <span class="badge rounded-pill text-bg-success fs-6">
            ${room.players.length}/${MAX_PLAYERS} players
          </span>
        </div>

        <ul class="list-group list-group-flush mb-3">
          ${room.players.map((player, index) => `
            <li class="list-group-item d-flex align-items-center gap-2 bg-transparent px-0">
              <span class="player-color-swatch" style="--player-color: ${getPlayerColor(player, index)}"></span>
              <span class="flex-grow-1 fw-semibold">${escapeHtml(player.name)}</span>
              <input class="room-player-color form-control form-control-color form-control-sm rounded-pill border-2"
                     type="color" value="${getPlayerColor(player, index)}"
                     data-room-id="${escapeHtml(room.id)}" data-player-id="${escapeHtml(player.id)}"
                     aria-label="Change ${escapeHtml(player.name)}'s color">
              <button type="button" class="remove-player btn btn-sm btn-outline-danger rounded-pill px-3"
                      data-room-id="${escapeHtml(room.id)}" data-player-id="${escapeHtml(player.id)}"
                      aria-label="Remove ${escapeHtml(player.name)}">Leave</button>
            </li>
          `).join('')}
        </ul>

        <form class="join-room-form row g-2 align-items-center bg-warning-subtle rounded-4 p-2 mx-0"
              data-room-id="${escapeHtml(room.id)}">
          <div class="col-12">
            ${colorPicker('playerColor', `join-${room.id}`, room.players.map(getPlayerColor))}
          </div>
          <div class="col-12 col-sm">
            <input name="playerName" class="form-control rounded-pill border-2" maxlength="16"
                   placeholder="Username to join"
                   aria-label="Username to join ${escapeHtml(room.name)}" required>
          </div>
          <div class="col-12 col-sm">
            <input name="avatar" type="file" accept="image/*" class="form-control rounded-pill border-2"
                   aria-label="Optional avatar image">
          </div>
          <div class="col-auto">
            <button type="submit" class="btn btn-warning fw-bold rounded-pill px-4 btn-pop"
                    ${room.players.length >= MAX_PLAYERS ? 'disabled' : ''}>JOIN</button>
          </div>
          <div class="col-auto">
            <button type="button" class="start-match btn btn-success fw-bold rounded-pill px-4 btn-pop"
                    data-room-id="${escapeHtml(room.id)}"
                    ${room.players.length < 2 ? 'disabled' : ''}>START MATCH</button>
          </div>
        </form>
      </div>
    </div>
  `).join('') : `
    <div class="text-center text-body-secondary bg-body-tertiary rounded-4 border border-2 border-dashed py-4">
      <div class="fs-1"></div>
      No rooms yet. Create one to get started!
    </div>`;
}

export function renderHistoryList(container, matches, fetchFailed = false) {
  container.innerHTML = matches.length ? matches.map(match => `
    <div class="card border-0 border-start border-5 border-primary rounded-4 shadow-sm">
      <div class="card-body py-3">
        <div class="d-flex justify-content-between flex-wrap gap-2">
          <h3 class="h6 fw-bolder mb-0">👑- ${escapeHtml(match.room_name)}</h3>
          <small class="text-body-secondary">${escapeHtml(new Date(match.ended_at).toLocaleString())}</small>
        </div>
        <div class="small text-body-secondary mb-2">Finished in ${match.total_rounds} rounds</div>
        <div class="d-flex flex-column align-items-start gap-2">
          ${[...(match.match_participants ?? [])]
            .sort((a, b) => Number(b.is_winner) - Number(a.is_winner)
              || b.round_wins - a.round_wins)
            .map(participant => {
            const player = participant.players;
            if (!player) return '';
            const color = /^#[\da-f]{6}$/i.test(player.favorite_color)
              ? player.favorite_color
              : '#495057';
            return `
              <span class="d-inline-flex align-items-center gap-2">
                <span class="match-history-medal">
                  ${participant.is_winner ? '<span role="img" aria-label="Winner">🥇</span>' : ''}
                </span>
                <span class="badge rounded-pill fs-6 fw-semibold d-inline-flex align-items-center gap-1 text-white"
                      style="background:${escapeHtml(color)}; text-shadow: 0 1px 2px rgba(0,0,0,.5)">
                  ${player.avatar_url
                    ? `<img src="${escapeHtml(player.avatar_url)}" width="24" height="24" alt="" class="rounded-circle">`
                    : ''}
                  ${escapeHtml(player.username)}: ${participant.round_wins} round wins
                </span>
              </span>`;
          }).join('')}
        </div>
        <button type="button" class="delete-match btn btn-sm btn-outline-danger rounded-pill mt-2"
                data-match-id="${escapeHtml(match.id)}">Delete</button>
      </div>
    </div>
  `).join('') : `
    <div class="text-center text-body-secondary bg-body-tertiary rounded-4 py-3">
      ${fetchFailed ? 'Match history could not be loaded.' : '🏆 Completed matches will show up here.'}
    </div>`;
}