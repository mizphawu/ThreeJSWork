
import { loginUser } from './auth.js';

const loginForm = document.getElementById('loginForm');
const message = document.getElementById('message');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    message.textContent = 'Logging in...';

    try {
        const session = await loginUser({
            username,
            password
        });

        if (session.type === 'admin') {
            window.location.href = '/admin.html';
        } else {
            window.location.href = '/index.html';
        }

    } catch (error) {
        message.textContent = error.message;
    }
});
