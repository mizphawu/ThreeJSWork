export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

export function makeId() {
  return crypto.randomUUID();
}

export function validateColor(value) {
  if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) {
    throw new Error('Choose a valid player color.');
  }
  return value.toLowerCase();
}

export function validateName(value, label) {
  const name = value.trim();
  if (!name || name.length > 24) {
    throw new Error(`${label} must be between 1 and 24 characters.`);
  }
  return name;
}

export function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}