import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal } from 'bootstrap';

import { supabase } from '../supabaseClient.js';
import { getSession, requireAdmin } from '../auth.js';
import { initAdminNav } from './adminNav.js';

const PAGE_SIZE = 50;
const TABLES = {
    matches: {
        title: 'Matches'
    },
    players: {
        title: 'Players'
    },
    'match-participants': {
        title: 'Match Participants',
        table: 'match_participants'
    }
};

const tableKey = document.body.dataset.adminTable;
const config = TABLES[tableKey];
const tableName = config?.table ?? tableKey;
const pageTitle = document.getElementById('pageTitle');
const adminMessage = document.getElementById('adminMessage');
const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');
const refreshButton = document.getElementById('refreshButton');
const loadMoreButton = document.getElementById('loadMoreButton');

let rows = [];
let isDeletingRecord = false;
let isSavingRecord = false;
let editingRow = null;

const createButton = document.createElement('button');
const createLabel = tableName === 'players' ? 'Add player' : 'Add record';
createButton.type = 'button';
createButton.className = 'btn btn-success rounded-pill px-3 d-inline-flex align-items-center gap-2';
createButton.setAttribute('aria-label', createLabel);
createButton.innerHTML = `<span class="fs-4 lh-1" aria-hidden="true">+</span><span>${createLabel}</span>`;

const headerActions = document.createElement('div');
headerActions.className = 'd-flex align-items-center gap-2 ms-auto';
refreshButton.parentElement.append(headerActions);
headerActions.append(createButton, refreshButton);

document.body.insertAdjacentHTML('beforeend', `
    <div class="modal fade" id="adminRecordModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-lg">
            <div class="modal-content rounded-4">
                <form id="adminRecordForm">
                    <div class="modal-header">
                        <h2 class="modal-title fs-5 fw-bold" id="adminRecordModalTitle"></h2>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div id="adminRecordError" class="alert alert-danger d-none" role="alert"></div>
                        <div id="adminRecordFields" class="row g-3"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary rounded-pill" data-bs-dismiss="modal">Cancel</button>
                        <button type="submit" class="btn btn-success rounded-pill" id="saveRecordButton">Save</button>
                    </div>
                </form>
            </div>
        </div>
    </div>`);

const editorModalElement = document.getElementById('adminRecordModal');
const editorModal = new Modal(editorModalElement);
const editorForm = document.getElementById('adminRecordForm');
const editorTitle = document.getElementById('adminRecordModalTitle');
const editorFields = document.getElementById('adminRecordFields');
const editorError = document.getElementById('adminRecordError');
const saveRecordButton = document.getElementById('saveRecordButton');

function showMessage(message, type = 'danger') {
    adminMessage.textContent = message;
    adminMessage.className = message ? `alert alert-${type}` : 'd-none';
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

function formatCell(value) {
    if (value === null) return '<span class="text-secondary">NULL</span>';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return escapeHtml(JSON.stringify(value));
    return escapeHtml(value);
}

function renderRows() {
    if (rows.length === 0) {
        tableHead.innerHTML = '';
        tableBody.innerHTML = `
            <tr>
                <td class="text-center text-secondary py-4">
                    No records found.
                </td>
            </tr>`;
        return;
    }

    const columns = Object.keys(rows[0]);
    tableHead.innerHTML = `
        <tr>
            ${columns.map(column => `
                <th scope="col">${escapeHtml(column.replace(/_/g, ' '))}</th>
            `).join('')}
            <th scope="col">Actions</th>
        </tr>`;
    tableBody.innerHTML = rows.map((row, rowIndex) => `
        <tr>
            ${columns.map(column => `
                <td class="text-break">${formatCell(row[column])}</td>
            `).join('')}
            <td>${renderRowActions(row, rowIndex)}</td>
        </tr>
    `).join('');
}

function renderRowActions(row, rowIndex) {
    const isParticipantTable = tableName === 'match_participants';
    const recordId = isParticipantTable ? row.match_id : row.id;
    const relatedId = isParticipantTable ? row.player_id : null;

    if (typeof recordId !== 'string'
        || (isParticipantTable && typeof relatedId !== 'string')) {
        return '<span class="text-secondary">Unavailable</span>';
    }

    return `
        <div class="d-flex justify-content-center gap-2">
            <button
                type="button"
                class="btn btn-sm btn-outline-primary rounded-pill"
                data-edit-record-index="${rowIndex}"
                ${isSavingRecord || isDeletingRecord ? 'disabled' : ''}>
                Edit
            </button>
            <button
                type="button"
                class="btn btn-sm btn-outline-danger rounded-pill"
                data-delete-record-id="${escapeHtml(recordId)}"
                ${isParticipantTable
                    ? `data-delete-related-id="${escapeHtml(relatedId)}"`
                    : ''}
                ${isDeletingRecord || isSavingRecord ? 'disabled' : ''}>
                Delete
            </button>
        </div>`;
}

function addInputField({ name, label, type, value = '', required = true, min, maxLength }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'col-md-6';

    const inputId = `record-field-${name}`;
    const labelElement = document.createElement('label');
    labelElement.className = 'form-label fw-semibold';
    labelElement.htmlFor = inputId;
    labelElement.textContent = label;

    const input = document.createElement('input');
    input.id = inputId;
    input.name = name;
    input.type = type;
    input.className = 'form-control';
    input.value = value ?? '';
    input.required = required;
    if (min !== undefined) input.min = String(min);
    if (maxLength !== undefined) input.maxLength = maxLength;

    wrapper.append(labelElement, input);
    editorFields.append(wrapper);
}

function addSelectField({ name, label, records, value, getLabel }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'col-md-6';

    const inputId = `record-field-${name}`;
    const labelElement = document.createElement('label');
    labelElement.className = 'form-label fw-semibold';
    labelElement.htmlFor = inputId;
    labelElement.textContent = label;

    const select = document.createElement('select');
    select.id = inputId;
    select.name = name;
    select.className = 'form-select';
    select.required = true;

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = `Choose ${label.toLowerCase()}`;
    placeholder.disabled = true;
    select.append(placeholder);

    const optionRecords = [...records];
    if (value && !optionRecords.some(record => record.id === value)) {
        optionRecords.unshift({ id: value, label: `${value} (current record)` });
    }

    for (const record of optionRecords) {
        const option = document.createElement('option');
        option.value = record.id;
        option.textContent = record.label ?? getLabel(record);
        select.append(option);
    }

    select.value = value ?? '';
    wrapper.append(labelElement, select);
    editorFields.append(wrapper);
}

function addCheckboxField({ name, label, checked = false }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'col-12';

    const check = document.createElement('div');
    check.className = 'form-check';

    const input = document.createElement('input');
    input.id = `record-field-${name}`;
    input.name = name;
    input.type = 'checkbox';
    input.className = 'form-check-input';
    input.checked = checked;

    const labelElement = document.createElement('label');
    labelElement.className = 'form-check-label fw-semibold';
    labelElement.htmlFor = input.id;
    labelElement.textContent = label;

    check.append(input, labelElement);
    wrapper.append(check);
    editorFields.append(wrapper);
}

async function loadTableOptions(optionTable) {
    const session = getSession();
    if (!session?.token) {
        throw new Error('Your admin session has expired. Please log in again.');
    }

    const records = [];
    let offset = 0;
    while (true) {
        const { data, error } = await supabase.rpc('admin_list_game_table', {
            p_session_token: session.token,
            p_table_name: optionTable,
            p_offset: offset,
            p_limit: PAGE_SIZE
        });
        if (error) throw error;

        const page = Array.isArray(data) ? data : [];
        records.push(...page);
        if (page.length < PAGE_SIZE) return records;
        offset += page.length;
    }
}

function localDateTimeValue(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
}

async function openRecordEditor(row = null) {
    editingRow = row;
    editorFields.replaceChildren();
    editorError.textContent = '';
    editorError.classList.add('d-none');
    editorTitle.textContent = `${row ? 'Edit' : 'Add'} ${config.title} record`;

    if (tableName === 'matches') {
        addInputField({
            name: 'room_name',
            label: 'Room name',
            type: 'text',
            value: row?.room_name ?? '',
            maxLength: 100
        });
        addInputField({
            name: 'total_rounds',
            label: 'Total rounds',
            type: 'number',
            value: row?.total_rounds ?? 1,
            min: 1
        });
        addInputField({
            name: 'ended_at',
            label: 'Ended at',
            type: 'datetime-local',
            value: localDateTimeValue(row?.ended_at ?? new Date().toISOString())
        });
    } else if (tableName === 'players') {
        addInputField({
            name: 'username',
            label: 'Username',
            type: 'text',
            value: row?.username ?? '',
            maxLength: 16
        });
        addInputField({
            name: 'favorite_color',
            label: 'Favorite color',
            type: 'color',
            value: /^#[\da-f]{6}$/i.test(row?.favorite_color ?? '')
                ? row.favorite_color
                : '#495057'
        });
        addInputField({
            name: 'avatar_url',
            label: 'Avatar URL',
            type: 'url',
            value: row?.avatar_url ?? '',
            required: false,
            maxLength: 2048
        });
    } else {
        const [matches, players] = await Promise.all([
            loadTableOptions('matches'),
            loadTableOptions('players')
        ]);
        addSelectField({
            name: 'match_id',
            label: 'Match',
            records: matches.map(match => ({
                id: match.id,
                label: `${match.room_name || 'Match'} — ${match.id}`
            })),
            value: row?.match_id,
            getLabel: record => record.id
        });
        addSelectField({
            name: 'player_id',
            label: 'Player',
            records: players.map(player => ({
                id: player.id,
                label: `${player.username || 'Player'} — ${player.id}`
            })),
            value: row?.player_id,
            getLabel: record => record.id
        });
        addInputField({
            name: 'round_wins',
            label: 'Round wins',
            type: 'number',
            value: row?.round_wins ?? 0,
            min: 0
        });
        addInputField({
            name: 'cones_collected',
            label: 'Cones collected',
            type: 'number',
            value: row?.cones_collected ?? 0,
            min: 0
        });
        addCheckboxField({
            name: 'is_winner',
            label: 'Winner',
            checked: row?.is_winner ?? false
        });
    }

    editorModal.show();
}

function buildRecordData() {
    const formData = new FormData(editorForm);
    if (tableName === 'matches') {
        const endedAt = new Date(formData.get('ended_at'));
        if (Number.isNaN(endedAt.getTime())) {
            throw new Error('Enter a valid match end time.');
        }
        return {
            room_name: String(formData.get('room_name')).trim(),
            total_rounds: Number(formData.get('total_rounds')),
            ended_at: endedAt.toISOString()
        };
    }

    if (tableName === 'players') {
        return {
            username: String(formData.get('username')).trim(),
            favorite_color: String(formData.get('favorite_color')),
            avatar_url: String(formData.get('avatar_url') ?? '').trim() || null
        };
    }

    return {
        match_id: String(formData.get('match_id')),
        player_id: String(formData.get('player_id')),
        round_wins: Number(formData.get('round_wins')),
        cones_collected: Number(formData.get('cones_collected')),
        is_winner: editorForm.elements.namedItem('is_winner').checked
    };
}

async function loadRows({ append = false } = {}) {
    const start = append ? rows.length : 0;

    refreshButton.disabled = true;
    loadMoreButton.disabled = true;
    showMessage('');

    try {
        const session = getSession();
        if (!session?.token) {
            throw new Error('Your admin session has expired. Please log in again.');
        }

        const { data, error } = await supabase.rpc('admin_list_game_table', {
            p_session_token: session.token,
            p_table_name: tableName,
            p_offset: start,
            p_limit: PAGE_SIZE
        });

        if (error) throw error;

        const pageRows = Array.isArray(data) ? data : [];
        rows = append ? rows.concat(pageRows) : pageRows;
        renderRows();
        loadMoreButton.hidden = pageRows.length < PAGE_SIZE;
        return true;
    } catch (error) {
        showMessage(`Failed to load ${config.title.toLowerCase()}: ${error.message}`);
        return false;
    } finally {
        refreshButton.disabled = false;
        loadMoreButton.disabled = false;
    }
}

async function deleteRecord(recordId, relatedId) {
    const session = getSession();
    if (!session?.token) {
        throw new Error('Your admin session has expired. Please log in again.');
    }

    const { error } = await supabase.rpc('admin_delete_game_record', {
        p_session_token: session.token,
        p_table_name: tableName,
        p_record_id: recordId,
        p_related_id: relatedId ?? null
    });

    if (error) throw error;

    const refreshed = await loadRows();
    if (!refreshed) {
        showMessage('Record deleted, but the table could not be refreshed. Use Refresh to reload it.', 'warning');
        return;
    }

    showMessage('Record deleted successfully.', 'success');
}

async function initialize() {
    if (!config) {
        throw new Error(`Unknown admin table page: ${tableKey}`);
    }

    const isAdmin = await requireAdmin();
    if (!isAdmin) return;

    initAdminNav();
    pageTitle.textContent = config.title;
    await loadRows();
}

refreshButton.addEventListener('click', () => loadRows());
loadMoreButton.addEventListener('click', () => loadRows({ append: true }));

createButton.addEventListener('click', async () => {
    if (isSavingRecord || isDeletingRecord) return;
    try {
        await openRecordEditor();
    } catch (error) {
        showMessage(`Unable to open the record editor: ${error.message}`);
    }
});

editorForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (isSavingRecord) return;

    editorError.textContent = '';
    editorError.classList.add('d-none');

    let data;
    try {
        data = buildRecordData();
    } catch (error) {
        editorError.textContent = error.message;
        editorError.classList.remove('d-none');
        return;
    }

    const session = getSession();
    if (!session?.token) {
        editorError.textContent = 'Your admin session has expired. Please log in again.';
        editorError.classList.remove('d-none');
        return;
    }

    const isParticipantTable = tableName === 'match_participants';
    const recordId = isParticipantTable ? editingRow?.match_id : editingRow?.id;
    const relatedId = isParticipantTable ? editingRow?.player_id : null;
    const operationLabel = editingRow ? 'updated' : 'created';
    isSavingRecord = true;
    saveRecordButton.disabled = true;
    saveRecordButton.textContent = 'Saving...';
    createButton.disabled = true;
    renderRows();

    try {
        const { error } = await supabase.rpc('admin_save_game_record', {
            p_session_token: session.token,
            p_table_name: tableName,
            p_operation: editingRow ? 'update' : 'create',
            p_data: data,
            p_record_id: recordId ?? null,
            p_related_id: relatedId ?? null
        });
        if (error) throw error;

        editorModal.hide();
        const refreshed = await loadRows();
        showMessage(
            refreshed
                ? `Record ${operationLabel} successfully.`
                : 'Record was saved, but the table could not be refreshed. Use Refresh to reload it.',
            refreshed ? 'success' : 'warning'
        );
    } catch (error) {
        editorError.textContent = error.message;
        editorError.classList.remove('d-none');
    } finally {
        isSavingRecord = false;
        saveRecordButton.disabled = false;
        saveRecordButton.textContent = 'Save';
        createButton.disabled = false;
        renderRows();
    }
});

editorModalElement.addEventListener('hidden.bs.modal', () => {
    editingRow = null;
    editorForm.reset();
});

tableBody.addEventListener('click', async event => {
    const editButton = event.target.closest('button[data-edit-record-index]');
    if (editButton) {
        if (isSavingRecord || isDeletingRecord) return;
        const row = rows[Number(editButton.dataset.editRecordIndex)];
        if (!row) return;
        try {
            await openRecordEditor(row);
        } catch (error) {
            showMessage(`Unable to open the record editor: ${error.message}`);
        }
        return;
    }

    const button = event.target.closest('button[data-delete-record-id]');
    if (!button || isDeletingRecord || isSavingRecord) return;

    const relatedId = button.dataset.deleteRelatedId;
    const impact = tableName === 'match_participants'
        ? ''
        : ' Any linked match-participant rows will also be deleted.';
    if (!window.confirm(`Permanently delete this record?${impact}`)) return;

    isDeletingRecord = true;
    button.disabled = true;
    createButton.disabled = true;
    try {
        await deleteRecord(button.dataset.deleteRecordId, relatedId);
    } catch (error) {
        showMessage(`Failed to delete record: ${error.message}`);
    } finally {
        isDeletingRecord = false;
        createButton.disabled = false;
        renderRows();
    }
});

initialize().catch(error => {
    showMessage(error.message);
});
