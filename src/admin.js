import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal } from 'bootstrap';

import { supabase } from './supabaseClient.js';
import { requireAdmin, getSession } from './auth.js';
import { initAdminNav } from './adminNav.js';

// HTML elements
const adminMessage = document.getElementById('adminMessage');

const totalUsers = document.getElementById('totalUsers');
const activeUsers = document.getElementById('activeUsers');
const inactiveUsers = document.getElementById('inactiveUsers');
const totalAdmins = document.getElementById('totalAdmins');

const INACTIVITY_THRESHOLD_MS = 2 * 24 * 60 * 60 * 1000;

const searchUser = document.getElementById('searchUser');
const statusFilter = document.getElementById('statusFilter');
const userTable = document.getElementById('userTable');

const refreshButton = document.getElementById('refreshButton');
const deleteConfirmModalElement = document.getElementById('deleteConfirmModal');
const deleteModalError = document.getElementById('deleteModalError');
const confirmDeleteButton = document.getElementById('confirmDeleteButton');
const cancelDeleteButton = document.getElementById('cancelDeleteButton');
const deleteModalClose = document.getElementById('deleteModalClose');
const deleteConfirmModal = new Modal(deleteConfirmModalElement);

let users = [];
let pendingDeleteUserId = null;
let isDeletingAccount = false;

// Display notification messages.
function showMessage(message, type = 'danger') {
    adminMessage.textContent = message;
    adminMessage.className = `alert alert-${type}`;
}

// Prevent usernames from being interpreted as HTML.
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function formatLastLogin(value) {
    if (!value) return 'Never';

    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? 'Unavailable'
        : date.toLocaleString();
}

function isRecentlyActive(user) {
    if (user.account_status !== 'active' || !user.last_activity) return false;

    const lastActivity = new Date(user.last_activity).getTime();
    return Number.isFinite(lastActivity)
        && Date.now() - lastActivity < INACTIVITY_THRESHOLD_MS;
}

// Load user accounts from Supabase.
async function loadUsers() {
    const session = getSession();

    if (!session || !session.token) {
        window.location.replace('/');
        return;
    }

    refreshButton.disabled = true;
    refreshButton.textContent = 'Loading...';

    try {
        const { data, error } = await supabase.rpc('admin_list_users', {
            p_session_token: session.token
        });

        if (error) {
            throw error;
        }

        users = Array.isArray(data) ? data : [];

        updateStatistics();
        renderUsers();

    } catch (error) {
        showMessage(`Failed to load accounts: ${error.message}`);
    } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Refresh Accounts';
    }
}

// Update dashboard statistics.
function updateStatistics() {
    const total = users.length;

    const active = users.filter(isRecentlyActive).length;
    const inactive = total - active;

    const admins = users.filter(
        user => user.role === 'admin'
    ).length;

    totalUsers.textContent = total;
    activeUsers.textContent = active;
    inactiveUsers.textContent = inactive;
    totalAdmins.textContent = admins;
}

// Display accounts in the table.
function renderUsers() {
    const searchValue = searchUser.value.toLowerCase().trim();
    const selectedStatus = statusFilter.value;

    const session = getSession();

    const filteredUsers = users.filter(user => {
        const matchesUsername = user.username
            .toLowerCase()
            .includes(searchValue);

        const matchesStatus = selectedStatus === 'all'
            || (selectedStatus === 'active' && isRecentlyActive(user))
            || (selectedStatus === 'inactive' && !isRecentlyActive(user));

        return matchesUsername && matchesStatus;
    });

    if (filteredUsers.length === 0) {
        userTable.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-secondary py-4">
                    No accounts found.
                </td>
            </tr>
        `;
        return;
    }

    userTable.innerHTML = filteredUsers.map(user => {
        const isActive = isRecentlyActive(user);
        const isEnabled = user.account_status === 'active';

        const roleBadge = user.role === 'admin'
            ? 'bg-primary'
            : 'bg-secondary';

        const statusBadge = isActive
            ? 'bg-success'
            : 'bg-danger';

        const isCurrentAdmin = session?.userId === user.user_id;
        const nextStatus = isEnabled ? 'disabled' : 'active';
        const actionText = isEnabled ? 'Disable' : 'Activate';
        const actionClass = isEnabled
            ? 'btn-outline-danger'
            : 'btn-outline-success';
        const actionCell = isCurrentAdmin
            ? '<span class="text-secondary">—</span>'
            : `
                <div class="d-flex flex-wrap justify-content-center gap-2">
                    <button
                        type="button"
                        class="btn btn-sm ${actionClass} rounded-pill"
                        data-status-user-id="${escapeHtml(user.user_id)}"
                        data-new-status="${nextStatus}">
                        ${actionText}
                    </button>
                    <button
                        type="button"
                        class="btn btn-sm btn-outline-danger rounded-pill"
                        data-delete-user-id="${escapeHtml(user.user_id)}">
                        Delete
                    </button>
                </div>`;

        return `
            <tr>
                <td class="fw-semibold">
                    ${escapeHtml(user.username)}
                    ${isCurrentAdmin
                        ? '<span class="badge bg-light text-dark ms-1">You</span>'
                        : ''}
                </td>

                <td>
                    <span class="badge ${roleBadge}">
                        ${escapeHtml(user.role)}
                    </span>
                </td>

                <td>
                    <span class="badge ${statusBadge}">
                        ${isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>

                <td class="text-nowrap">${escapeHtml(formatLastLogin(user.last_activity))}</td>

                <td>${actionCell}</td>
            </tr>
        `;
    }).join('');
}

// Activate or disable an account.
async function updateUserStatus(userId, newStatus) {
    const session = getSession();

    if (!session || !session.token) {
        window.location.replace('/');
        return;
    }

    try {
        const { error } = await supabase.rpc('admin_update_user_status', {
            p_session_token: session.token,
            p_user_id: userId,
            p_new_status: newStatus
        });

        if (error) {
            throw error;
        }

        showMessage(
            `Account successfully ${newStatus === 'active' ? 'activated' : 'disabled'}.`,
            'success'
        );
        await loadUsers();
    } catch (error) {
        showMessage(`Failed to update account: ${error.message}`);
    }
}

// Permanently delete a user account.
async function deleteUserAccount(userId) {
    const session = getSession();

    if (!session || !session.token) {
        window.location.replace('/');
        return;
    }

    const { error } = await supabase.rpc('admin_delete_user', {
        p_session_token: session.token,
        p_user_id: userId
    });

    if (error) {
        throw error;
    }

    showMessage('Account deleted successfully.', 'success');
    await loadUsers();
}

userTable.addEventListener('click', async event => {
    const button = event.target.closest('button[data-status-user-id]');
    if (!button) return;

    button.disabled = true;
    try {
        await updateUserStatus(button.dataset.statusUserId, button.dataset.newStatus);
    } finally {
        button.disabled = false;
    }
});

userTable.addEventListener('click', async event => {
    const button = event.target.closest('button[data-delete-user-id]');
    if (!button) return;

    pendingDeleteUserId = button.dataset.deleteUserId;
    deleteModalError.textContent = '';
    deleteModalError.classList.add('d-none');
    deleteConfirmModal.show();
});

confirmDeleteButton.addEventListener('click', async () => {
    if (!pendingDeleteUserId || isDeletingAccount) return;

    isDeletingAccount = true;
    confirmDeleteButton.disabled = true;
    cancelDeleteButton.disabled = true;
    deleteModalClose.disabled = true;
    confirmDeleteButton.textContent = 'Deleting...';

    try {
        await deleteUserAccount(pendingDeleteUserId);
        pendingDeleteUserId = null;
        deleteConfirmModal.hide();
    } catch (error) {
        deleteModalError.textContent = `Failed to delete account: ${error.message}`;
        deleteModalError.classList.remove('d-none');
    } finally {
        isDeletingAccount = false;
        confirmDeleteButton.disabled = false;
        cancelDeleteButton.disabled = false;
        deleteModalClose.disabled = false;
        confirmDeleteButton.textContent = 'Delete account';
    }
});

deleteConfirmModalElement.addEventListener('hidden.bs.modal', () => {
    pendingDeleteUserId = null;
});

// Search usernames.
searchUser.addEventListener('input', renderUsers);

// Filter accounts by status.
statusFilter.addEventListener('change', renderUsers);

// Refresh accounts.
refreshButton.addEventListener('click', loadUsers);

window.setInterval(() => {
    updateStatistics();
    renderUsers();
}, 60_000);

// Initialize the admin dashboard.
async function initializeAdmin() {
    const isAdmin = await requireAdmin();
    if (!isAdmin) return;

    initAdminNav();
    await loadUsers();
}

initializeAdmin();
