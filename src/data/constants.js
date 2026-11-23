export const PLAYER_COLORS = [
  { name: 'Red', hex: '#ff5252' },
  { name: 'Pink', hex: '#ff6fa8' },
  { name: 'Magenta', hex: '#e040fb' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Blue', hex: '#4287ff' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Lime', hex: '#84cc16' },
  { name: 'Yellow', hex: '#ffd447' },
  { name: 'Lavender', hex: '#c4b5fd' },
];

export const ROOMS_KEY = 'cone-clash-rooms';
export const HISTORY_KEY = 'cone-clash-history';
export const MAX_PLAYERS = 3;
export const ROUNDS_TO_WIN_MATCH = 2;

export const playerConfigs = [
  {
    name: 'PLAYER 1',
    color: 0xff5252,
    position: [0, 0, -6.5],
    keys: {
      up: 'KeyW',
      down: 'KeyS',
      left: 'KeyA',
      right: 'KeyD',
      action: 'KeyE'
    }
  },
  {
    name: 'PLAYER 2',
    color: 0x4287ff,
    position: [-5.6, 0, 3.25],
    keys: {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight',
      action: 'Enter'
    }
  },
  {
    name: 'PLAYER 3',
    color: 0xffd447,
    position: [5.6, 0, 3.25],
    keys: {
      up: 'KeyI',
      down: 'KeyK',
      left: 'KeyJ',
      right: 'KeyL',
      action: 'KeyO'
    }
  }
];