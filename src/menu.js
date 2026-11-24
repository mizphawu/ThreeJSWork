// menu.js: title screen with Play as Guest, Login and Register.
// Pure Bootstrap markup; all data access goes through auth.js.

import { registerUser, loginUser, playAsGuest, getSession, logout } from './auth.js';

const VIEWS = ['home', 'login', 'register'];

const LOGIN_CONES = `
  <div class="login-cones" aria-hidden="true">
    <img src="/traffic-cone.png" alt="">
    <img src="/traffic-cone.png" alt="">
    <img src="/traffic-cone.png" alt="">
    <img src="/traffic-cone.png" alt="">
    <img src="/traffic-cone.png" alt="">
    <img src="/traffic-cone.png" alt="">
  </div>`;

function field(id, name, label, type, extra = '') {
  const isPassword = type === 'password';
  const passwordToggle = isPassword ? `
        <button type="button" class="password-toggle" aria-label="Show password"
                aria-controls="${id}" aria-pressed="false">
          <svg class="password-icon-show" aria-hidden="true" viewBox="0 0 24 24">
            <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <svg class="password-icon-hide" aria-hidden="true" viewBox="0 0 24 24" hidden>
            <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.9 5.2A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a14.6 14.6 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7a10.7 10.7 0 0 0 4-.8" />
          </svg>
        </button>` : '';

  return `
    <div>
      <label class="form-label fw-bold small text-uppercase text-body-secondary" for="${id}">${label}</label>
      <div class="${isPassword ? 'password-field' : ''}">
        <input id="${id}" name="${name}" type="${type}"
               class="form-control form-control-lg rounded-pill border-2${isPassword ? ' pe-5' : ''}" ${extra} required>
        ${passwordToggle}
      </div>
    </div>`;
}

const MENU_HTML = `
  <section id="main-menu" class="login-backdrop pe-auto position-absolute top-0 start-0 w-100 h-100 overflow-auto py-4 px-2 d-flex align-items-center">
    ${LOGIN_CONES}
    <div class="container" style="max-width: 460px">
      <div class="card border-0 rounded-5 overflow-hidden bg-warning-subtle">

        <div class="text-center py-4 px-3 border-bottom border-4 border-warning lobby-header">
          <img src="/traffic-cone.png" alt="" class="cone-logo-img cone-bounce d-block mx-auto mb-2">
          <h1 class="display-3 fw-bolder text-uppercase mb-1 title-cute">
            <span class="title-cone">Cone</span> <span class="title-clash">Clash</span>
          </h1>
          <p class="text-body-secondary fw-medium mb-0">1, 2, 3... Cone It!</p>
        </div>

        <div class="card-body p-4">
          <div id="menu-message" class="d-none" role="status" aria-live="polite"></div>

          <div id="menu-home" class="menu-view d-grid gap-3">
            <button id="menu-guest" type="button"
                    class="btn btn-warning btn-lg fw-bold rounded-pill text-uppercase btn-pop">
              Play as guest
            </button>
            <div class="d-flex align-items-center gap-2 text-body-secondary small text-uppercase fw-bold">
              <hr class="flex-grow-1 m-0"> or <hr class="flex-grow-1 m-0">
            </div>
            <button id="menu-go-login" type="button"
                    class="btn btn-success btn-lg fw-bold rounded-pill text-uppercase btn-pop">
              Login
            </button>
            <button id="menu-go-register" type="button"
                    class="btn btn-outline-primary btn-lg fw-bold rounded-pill text-uppercase btn-pop">
              Register
            </button>
          </div>

          <form id="menu-login" method="post" class="hidden d-grid gap-3">
            <h2 class="h5 fw-bold text-uppercase text-success-emphasis mb-0">Login</h2>
            ${field('login-username', 'username', 'Username', 'text', 'maxlength="50" autocomplete="username"')}
            ${field('login-password', 'password', 'Password', 'password', 'autocomplete="current-password"')}
            <button type="submit" class="btn btn-success btn-lg fw-bold rounded-pill text-uppercase btn-pop">
              Log in
            </button>
            <button type="button" class="menu-back btn btn-link text-body-secondary">Back</button>
          </form>

          <form id="menu-register" method="post" class="hidden d-grid gap-3" novalidate>
            <h2 class="h5 fw-bold text-uppercase text-primary-emphasis mb-0">Create account</h2>
            <div id="register-error" class="text-danger small fw-semibold" role="alert" aria-live="polite"></div>
            ${field('register-username', 'username', 'Username', 'text', 'minlength="3" maxlength="16" autocomplete="username"')}
            ${field('register-password', 'password', 'Password', 'password', 'autocomplete="new-password"')}
            ${field('register-confirm', 'confirm', 'Confirm password', 'password', 'autocomplete="new-password"')}
            <button type="submit" class="btn btn-primary btn-lg fw-bold rounded-pill text-uppercase btn-pop">
              Register
            </button>
            <button type="button" class="menu-back btn btn-link text-body-secondary">Back</button>
          </form>
        </div>
      </div>
    </div>
  </section>`;

const SESSION_BAR_HTML = `
  <div class="position-absolute top-0 end-0 m-3 d-flex align-items-center gap-2">
    <span id="session-label" class="badge rounded-pill text-bg-light fs-6"></span>
    <button id="session-button" type="button" class="btn btn-sm btn-outline-dark rounded-pill"></button>
  </div>`;

export function initMenu() {
  document.querySelector('#game-ui').insertAdjacentHTML('beforeend', MENU_HTML);

  const menu = document.querySelector('#main-menu');
  const lobby = document.querySelector('#lobby');
  const menuMessage = document.querySelector('#menu-message');
  const loginForm = document.querySelector('#menu-login');
  const registerForm = document.querySelector('#menu-register');
  const registerError = document.querySelector('#register-error');

  // Small "who am I / log out" bar on the lobby card
  const lobbyHeader = lobby.querySelector('.lobby-header');
  lobbyHeader.classList.add('position-relative');
  lobbyHeader.insertAdjacentHTML('afterbegin', SESSION_BAR_HTML);
  const sessionLabel = document.querySelector('#session-label');
  const sessionButton = document.querySelector('#session-button');

  function setMessage(text, type = 'danger') {
    menuMessage.textContent = text;
    menuMessage.className = text ? `alert alert-${type} py-2 small` : 'd-none';
  }

  function showView(name) {
    setMessage('');
    registerError.textContent = '';
    VIEWS.forEach(view => {
      document.querySelector(`#menu-${view}`).classList.toggle('hidden', view !== name);
    });
    document.querySelector(`#menu-${name} input`)?.focus();
  }

  function showMenu(message = '', type = 'success') {
    lobby.classList.add('hidden');
    menu.classList.remove('hidden');
    showView('home');
    setMessage(message, type);
  }

  function enterLobby(session) {
    // Redirect administrators straight to admin.html
    if (session.type === 'admin') {
      window.location.replace('/admin.html');
      return;
    }

    const isGuest = session.type === 'guest';

    menu.classList.add('hidden');
    lobby.classList.remove('hidden');
    sessionLabel.textContent = isGuest ? 'Guest' : session.username;
    sessionButton.textContent = isGuest ? 'Main menu' : 'Log out';

    // Pre-fill the room form with the account name (defaultValue survives form.reset())
    const nameInput = document.querySelector('#create-player-name');
    nameInput.value = nameInput.defaultValue = isGuest ? '' : session.username;
  }

  async function submitForm(form, task, errorTarget = null) {
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    if (errorTarget) errorTarget.textContent = '';
    try {
      await task(new FormData(form));
    } catch (error) {
      if (errorTarget) {
        errorTarget.textContent = error.message;
      } else {
        setMessage(error.message, 'danger');
      }
    } finally {
      button.disabled = false;
    }
  }

  document.querySelector('#menu-guest').addEventListener('click', () => {
    enterLobby(playAsGuest());
  });
  document.querySelector('#menu-go-login').addEventListener('click', () => showView('login'));
  document.querySelector('#menu-go-register').addEventListener('click', () => showView('register'));
  menu.querySelectorAll('.menu-back').forEach(button => {
    button.addEventListener('click', () => showView('home'));
  });

  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    submitForm(loginForm, async data => {
      const session = await loginUser({
        username: data.get('username').trim(),
        password: data.get('password')
      });
      loginForm.reset();
      enterLobby(session);
    });
  });

  menu.querySelectorAll('.password-toggle').forEach(button => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.getAttribute('aria-controls'));
      const showPassword = input.type === 'password';

      input.type = showPassword ? 'text' : 'password';
      button.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
      button.setAttribute('aria-pressed', String(showPassword));
      button.querySelector('.password-icon-show').hidden = showPassword;
      button.querySelector('.password-icon-hide').hidden = !showPassword;
    });
  });

  registerForm.addEventListener('submit', event => {
    event.preventDefault();
    submitForm(registerForm, async data => {
      const username = data.get('username').trim();
      const password = data.get('password');

      if (username.length < 3 || username.length > 16) {
        throw new Error('Username must be 3 to 16 characters.');
      }
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      if (!/[A-Z]/.test(password)) throw new Error('Password must include an uppercase letter.');
      if (!/[a-z]/.test(password)) throw new Error('Password must include a lowercase letter.');
      if (!/[0-9]/.test(password)) throw new Error('Password must include a number.');
      if (!/[^A-Za-z0-9\s]/.test(password)) throw new Error('Password must include a special character.');
      if (new TextEncoder().encode(password).length > 72) {
        throw new Error('Password must be no more than 72 UTF-8 bytes.');
      }
      if (password !== data.get('confirm')) throw new Error('Passwords do not match.');

      await registerUser({ username, password });
      registerForm.reset();
      loginForm.elements.username.value = username;
      showMenu(`Account "${username}" created! Log in to play.`);
    }, registerError);
  });

  sessionButton.addEventListener('click', async () => {
    await logout();
    showMenu();
  });

  // After a reload, restore the saved session (or redirect admin to admin.html)
  const session = getSession();
  if (session) enterLobby(session);
  else showMenu();
}
