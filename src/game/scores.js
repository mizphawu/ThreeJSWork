import { state } from './state.js';
import { players } from './players.js';
import { readRooms, writeRooms } from '../data/storage.js';
import { renderScores } from '../ui/scoreboard.js';
import { showLobbyMessage } from '../ui/messages.js';

export function updateScores() {
  renderScores();

  if (state.currentRoom) {
    try {
      const rooms = readRooms();
      const room = rooms.find(item => item.id === state.currentRoom.id);
      if (room) {
        room.round = state.matchRound;
        room.players = players.map(player => {
          const roomPlayer = room.players.find(item => item.id === player.id);
          return {
            ...roomPlayer,
            id: player.id,
            name: player.name,
            color: `#${player.color.toString(16).padStart(6, '0')}`,
            score: player.baseCones.length,
            roundWins: player.roundWins
          };
        });
        writeRooms(rooms);
      }
    } catch (error) {
      showLobbyMessage(`Couldn't save the current scores: ${error.message}`, true);
    }
  }
}