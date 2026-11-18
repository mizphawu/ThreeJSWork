// auth.js: PLACEHOLDER auth layer.
//
// FOR WHOEVER BUILDS THE DATABASE: replace the bodies of registerUser,
// loginUser and logout with real API calls. Keep the same function names,
// arguments and behavior (resolve on success, throw an Error with a
// user-friendly message on failure) and the menu UI needs no changes.
//
// The localStorage version below only exists so the menu is usable today.
// It is NOT secure: never ship it as real authentication.

const USERS_KEY = 'cone-clash-users';
const SESSION_KEY = 'cone-clash-session';

function readUsers() {
  const raw = localStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function hash(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

// Create an account. Throws if the username is taken.
// TODO(db): POST { username, password } to your register endpoint.
export async function registerUser({ username, password }) {
  const users = readUsers();
  const key = username.toLowerCase();

  if (users[key]) throw new Error('That username is already taken.');

  users[key] = {
    username,
    passwordHash: await hash(password),
    createdAt: new Date().toISOString()
  };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));

  return { username };
}

// Log in. Throws on wrong credentials. Returns the session object.
// TODO(db): POST { username, password } to your login endpoint.
export async function loginUser({ username, password }) {
  const user = readUsers()[username.toLowerCase()];

  if (!user || user.passwordHash !== await hash(password)) {
    throw new Error('Wrong username or password.');
  }

  return saveSession({ type: 'user', username: user.username });
}

// Guests are never sent to the database.
export function playAsGuest() {
  return saveSession({ type: 'guest', username: null });
}

// Who is signed in right now (survives a page reload, not a closed tab).
export function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

// TODO(db): also invalidate the token/cookie on the server if you add one.
export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
}
