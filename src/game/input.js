export const pressedKeys = {};

window.addEventListener('keydown', event => {
  pressedKeys[event.code] = true;

  // Prevent page scrolling
  if (event.code.startsWith('Arrow') || event.code === 'Space') {
    event.preventDefault();
  }
});

window.addEventListener('keyup', event => {
  pressedKeys[event.code] = false;
});