<<<<<<< HEAD
=======
// auth.js: Supabase custom auth layer linked to public.users.

>>>>>>> origin/main
import { supabase } from './supabaseClient.js';

const SESSION_KEY = 'cone-clash-session';

<<<<<<< HEAD
// Get the first row returned by a Supabase RPC function.
function getFirstRow(data) {
    return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

// Save the current session.
function saveSession(session) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
}

// Register a new regular user.
export async function registerUser({ username, password }) {
    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
        throw new Error('Please enter your username and password.');
    }

    const { data, error } = await supabase.rpc('cone_clash_register_user', {
        p_username: cleanUsername,
        p_password: password
    });

    if (error) {
        if (error.message.toLowerCase().includes('already taken')) {
            throw new Error('That username is already taken.');
        }
        throw new Error(error.message);
    }

    const user = getFirstRow(data);

    if (!user) {
        throw new Error('Registration failed. Please try again.');
    }

    return {
        username: user.username
    };
}

// Log in an admin or regular user.
export async function loginUser({ username, password }) {
    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
        throw new Error('Please enter your username and password.');
    }

    const { data, error } = await supabase.rpc('cone_clash_login_user', {
        p_username: cleanUsername,
        p_password: password
    });

    if (error) {
        if (error.code === 'PGRST202') {
            throw new Error('Login service is not configured. Apply supabase/security.sql, then reload the app.');
        }

        if (error.message.toLowerCase().includes('disabled')) {
            throw new Error('Your account has been disabled.');
        }

        if (error.message.toLowerCase().includes('wrong username or password')) {
            throw new Error('Wrong username or password.');
        }

        throw new Error('Login failed. Please try again.');
    }

    const user = getFirstRow(data);

    if (!user) {
        throw new Error('Login failed. Please try again.');
    }

    return saveSession({
        type: user.role,
        username: user.username,
        userId: user.user_id,
        token: user.session_token
    });
}

// Guests are not registered in the database.
export function playAsGuest() {
    return saveSession({
        type: 'guest',
        username: null
    });
}

// Get the locally saved session.
export function getSession() {
    const raw = sessionStorage.getItem(SESSION_KEY);

    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
    }
}

// Verify the session with the database.
async function getVerifiedSession() {
    const session = getSession();

    if (!session || !session.token) {
        return null;
    }

    const { data, error } = await supabase.rpc('cone_clash_get_session', {
        p_session_token: session.token
    });

    if (error) {
        console.error('get_session RPC error:', error);
        return null;
    }

    const user = getFirstRow(data);

    if (!user) {
        console.warn('get_session returned no active user row.');
        return null;
    }

    return saveSession({
        type: user.role,
        username: user.username,
        userId: user.user_id,
        token: session.token
    });
}

// Check whether the current user is an admin.
export async function requireAdmin() {
    const session = await getVerifiedSession();

    if (!session || session.type !== 'admin') {
        // Clear invalid session so '/' does not bounce back to admin.html!
        sessionStorage.removeItem(SESSION_KEY);
        window.location.replace('/');
        return false;
    }

    return true;
}

// Check whether the current user is a regular player.
export async function requirePlayer() {
    const currentSession = getSession();

    if (currentSession?.type === 'guest') {
        return true;
    }

    const session = await getVerifiedSession();

    if (session?.type === 'user') {
        return true;
    }

    if (session?.type === 'admin') {
        window.location.replace('/admin.html');
        return false;
    }

    sessionStorage.removeItem(SESSION_KEY);
    window.location.replace('/');
    return false;
}

// Log out and invalidate the database session.
export async function logout() {
    const session = getSession();

    try {
        if (session?.token) {
            const { error } = await supabase.rpc('cone_clash_logout_user', {
                p_session_token: session.token
            });

            if (error) {
                throw new Error('Unable to log out. Please try again.');
            }
        }
    } finally {
        sessionStorage.removeItem(SESSION_KEY);
    }
}
=======
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
>>>>>>> origin/main
