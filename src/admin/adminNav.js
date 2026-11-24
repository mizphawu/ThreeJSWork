import './adminNav.css';

import { getSession, logout } from '../auth.js';

const ADMIN_LINKS = [
    { href: '/admin.html', label: 'Accounts' },
    { href: '/matches.html', label: 'Matches' },
    { href: '/players.html', label: 'Players' },
    { href: '/match-participants.html', label: 'Match Participants' }
];

export function initAdminNav() {
    const mount = document.getElementById('adminNav');

    if (!mount) {
        throw new Error('Admin navigation mount point is missing.');
    }

    const links = ADMIN_LINKS.map(({ href, label }) => {
        const isCurrentPage = window.location.pathname.endsWith(href);
        return `
            <a
                class="admin-sidebar-link${isCurrentPage ? ' active' : ''}"
                href="${href}"
                ${isCurrentPage ? 'aria-current="page"' : ''}>
                ${label}
            </a>`;
    }).join('');

    mount.innerHTML = `
        <nav class="navbar bg-white shadow-sm rounded-4 px-3 px-md-4 py-3 admin-topbar position-relative">
            <div class="d-flex align-items-center gap-3">
                <button
                    type="button"
                    class="btn p-0 admin-menu-toggle admin-menu-toggle-outside"
                    id="adminMenuToggle"
                    aria-label="Open admin menu"
                    aria-controls="adminSidebar"
                    aria-expanded="false">
                    <span class="admin-hamburger" aria-hidden="true">
                        <span></span><span></span><span></span>
                    </span>
                </button>
                <div class="text-dark">
                    <h3 class="fw-bold mb-0">
                        <span class="text-warning">Cone</span> Clash
                    </h3>
                </div>
            </div>
            <span class="fw-semibold" id="adminUsername"></span>
        </nav>

        <div class="admin-sidebar-backdrop" id="adminSidebarBackdrop" hidden></div>
        <aside
            class="admin-sidebar"
            id="adminSidebar"
            aria-label="Admin navigation"
            aria-hidden="true"
            inert>
            <div class="d-flex align-items-center justify-content-between mb-3">
                <h2 class="h5 fw-bold mb-0">Admin Menu</h2>
                
                <button
                    type="button"
                    class="btn-close"
                    id="adminMenuClose"
                    aria-label="Close admin menu">
                </button>
            </div>
            <hr class="mt-0 mb-3">
            <nav class="admin-sidebar-links" aria-label="Admin pages">
                ${links}
            </nav>
            <button
                type="button"
                class="btn btn-outline-danger rounded-pill mt-auto"
                id="logoutButton">
                Logout
            </button>
        </aside>`;

    const session = getSession();
    const username = document.getElementById('adminUsername');
    username.textContent = session?.username || 'Administrator';

    const toggleButton = document.getElementById('adminMenuToggle');
    const closeButton = document.getElementById('adminMenuClose');
    const sidebar = document.getElementById('adminSidebar');
    const backdrop = document.getElementById('adminSidebarBackdrop');
    const logoutButton = document.getElementById('logoutButton');

    function setMenuOpen(isOpen) {
        sidebar.classList.toggle('is-open', isOpen);
        sidebar.setAttribute('aria-hidden', String(!isOpen));
        sidebar.inert = !isOpen;
        backdrop.hidden = !isOpen;
        toggleButton.setAttribute('aria-expanded', String(isOpen));
        document.body.classList.toggle('admin-menu-open', isOpen);
    }

    toggleButton.addEventListener('click', () => {
        setMenuOpen(toggleButton.getAttribute('aria-expanded') !== 'true');
    });
    closeButton.addEventListener('click', () => setMenuOpen(false));
    backdrop.addEventListener('click', () => setMenuOpen(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') setMenuOpen(false);
    });

    logoutButton.addEventListener('click', async () => {
        logoutButton.disabled = true;

        try {
            await logout();
            window.location.replace('/');
        } catch (error) {
            const message = document.getElementById('adminMessage');
            if (message) {
                message.textContent = error.message;
                message.className = 'alert alert-danger';
            }
            logoutButton.disabled = false;
        }
    });
}
