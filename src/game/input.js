export const pressedKeys = {};

window.addEventListener('keydown', event => {
  if (!event.code) return;

  pressedKeys[event.code] = true;

  // Prevent page scrolling
  if (event.code.startsWith('Arrow') || event.code === 'Space') {
    event.preventDefault();
  }
});

window.addEventListener('keyup', event => {
  if (!event.code) return;
  pressedKeys[event.code] = false;
});