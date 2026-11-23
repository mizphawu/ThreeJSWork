export function showLobbyMessage(message, isError = false) {
  const lobbyMessage = document.querySelector('#lobby-message');
  const appMessage = document.querySelector('#app-message');

  lobbyMessage.textContent = message;
  lobbyMessage.classList.toggle('text-danger', isError);
  lobbyMessage.classList.toggle('text-success', !isError);
  appMessage.textContent = isError ? message : '';
  appMessage.classList.toggle('d-none', !isError);
}

export function withLobbyError(action) {
  try {
    const result = action();
    if (result && typeof result.catch === 'function') {
      result.catch(error => {
        showLobbyMessage(`Couldn't update the lobby: ${error.message}`, true);
      });
    }
  } catch (error) {
    showLobbyMessage(`Couldn't update the lobby: ${error.message}`, true);
  }
}