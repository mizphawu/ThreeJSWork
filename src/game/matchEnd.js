import { state } from './state.js';
import { players } from './players.js';
import { updateScores } from './scores.js';
import { ROUNDS_TO_WIN_MATCH } from '../data/constants.js';
import { readRooms, writeRooms, readHistory, writeHistory } from '../data/storage.js';
import { saveCompletedMatchToCloud } from '../data/database.js';
import { updateMatchStatus } from '../ui/scoreboard.js';
import { renderPodium, playerHex } from '../ui/podium.js';
import { clearConfetti, scheduleConfetti } from '../ui/confettiYEY.js';
import { showLobbyMessage } from '../ui/messages.js';

function completeCurrentRoom(rankings, winner, onMatchSaved) {
  if (!state.currentRoom) return;
  const completedRoom = state.currentRoom;
  const endedAt = new Date().toISOString();
  state.currentRoom = null;

  try {
    const rooms = readRooms().filter(room => room.id !== completedRoom.id);
    const history = readHistory();
    history.unshift({
      id: completedRoom.id,
      roomName: completedRoom.name,
      endedAt,
      round: state.matchRound,
      result: `Best of 3 · ${players.map(player => `${player.name} ${player.roundWins}`).join(' : ')}`,
      players: rankings.map(player => ({
        name: player.name,
        color: `#${player.color.toString(16).padStart(6, '0')}`,
        score: player.roundWins
      }))
    });
    writeRooms(rooms);
    writeHistory(history.slice(0, 50));
  } catch (error) {
    showLobbyMessage(`Match ended, but its history couldn't be saved: ${error.message}`, true);
  }

  void saveCompletedMatchToCloud(
    completedRoom.name,
    state.matchRound,
    players,
    winner.dbId,
    endedAt
  ).then(onMatchSaved).catch(error => {
    showLobbyMessage(`Match ended, but cloud history couldn't be saved: ${error.message}`, true);
  });
}

export function endGame(winner = null, { onMatchSaved } = {}) {

  if (state.gameOver) return;

  state.gameOver = true;
  state.gameStarted = false;
  document.querySelector('#game-hud').classList.add('hidden');

  const rankings = [...players].sort(
    (a, b) => b.baseCones.length - a.baseCones.length
  );
  const roundLeader = winner ?? (rankings[0].baseCones.length > rankings[1].baseCones.length
    ? rankings[0]
    : null);
  state.roundWasTied = !roundLeader;
  if (roundLeader) roundLeader.roundWins++;
  updateScores();
  updateMatchStatus();

  const matchWinner = roundLeader?.roundWins >= ROUNDS_TO_WIN_MATCH ? roundLeader : null;
  const displayRankings = matchWinner
    ? [...players].sort((a, b) => b.roundWins - a.roundWins || b.baseCones.length - a.baseCones.length)
    : rankings;

  const series = players.map(player => `${player.name} ${player.roundWins}`).join(' : ');

  let title, subtitle, trophy, buttonText;

  if (matchWinner) {
    state.matchComplete = true;
    title = `${matchWinner.name} WINS THE MATCH!`;
    subtitle = `Final series: ${series}`;
    trophy = '🏆';
    buttonText = 'BACK TO LOBBY';
    completeCurrentRoom(displayRankings, matchWinner, onMatchSaved);
  } else if (roundLeader) {
    title = `${roundLeader.name} WINS ROUND ${state.matchRound}!`;
    subtitle = `Series: ${series}`;
    trophy = '🎉';
    buttonText = `START ROUND ${state.matchRound + 1}`;
  } else {
    title = `ROUND ${state.matchRound} TIED!`;
    subtitle = 'Nobody takes the cones this time.';
    trophy = '🤝';
    buttonText = `REPLAY ROUND ${state.matchRound}`;
  }

  renderPodium({
    rankings: displayRankings,
    showRoundWins: Boolean(matchWinner),
    title,
    subtitle,
    trophy,
    buttonText
  });

  // Confetti pops when the winner's step lands
  clearConfetti();
  const celebrated = matchWinner ?? roundLeader;
  if (celebrated) {
    scheduleConfetti(playerHex(celebrated), Boolean(matchWinner), 1200);
  }
}