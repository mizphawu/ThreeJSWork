// auth.js: Supabase custom auth layer linked to public.users.

import { supabase } from './supabaseClient.js';

const SESSION_KEY = 'cone-clash-session';

function saveSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event('auth-changed'));
  return session;
}

// Create an account directly in Supabase public.users (always gets role = 'user').
export async function registerUser({ username, password }) {
  const { data, error } = await supabase.rpc('register_custom_user', {
    p_username: username,
    p_password: password
  });

  if (error) {
    throw new Error(error.message || 'Registration failed.');
  }

  return { id: data.id, username: data.username, role: data.role };
}

// Log in against Supabase public.users (works for both 'admin' and 'user').
export async function loginUser({ username, password }) {
  const { data, error } = await supabase.rpc('login_custom_user', {
    p_username: username,
    p_password: password
  });

  if (error) {
    throw new Error(error.message || 'Wrong username or password.');
  }

  // Keeps 'type' compatible with existing menu UI while storing id & role for admin checks
  return saveSession({
    type: data.role,      // 'admin' or 'user'
    role: data.role,      // 'admin' or 'user'
    id: data.id,          // UUID from public.users
    username: data.username
  });
}

// Guests are never sent to the database.
export function playAsGuest() {
  return saveSession({
    type: 'guest',
    role: 'guest',
    id: null,
    username: null
  });
}

// Who is signed in right now (survives a page reload, not a closed tab).
export function getSession() {
  const raw = sessionStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event('auth-changed'));
}