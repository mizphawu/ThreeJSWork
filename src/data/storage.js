import { ROOMS_KEY, HISTORY_KEY } from './constants.js';

function readCollection(key, label) {
  const raw = localStorage.getItem(key);
  if (raw === null) return [];

  const value = JSON.parse(raw);
  if (!Array.isArray(value)) {
    throw new Error(`Saved ${label} data is invalid.`);
  }
  return value;
}

export function readRooms() {
  return readCollection(ROOMS_KEY, 'room');
}

export function writeRooms(rooms) {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
}

export function readHistory() {
  return readCollection(HISTORY_KEY, 'history');
}

export function writeHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}