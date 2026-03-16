// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Auto-detect: if opened via localhost:3000 directly, use same origin; otherwise point to :3000
const API_BASE = (window.location.port === '3000') ? '' : 'http://localhost:3000';
let currentUser = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    if (!window.location.hash) window.location.hash = '#/';

    const token = sessionStorage.getItem('authToken');
    if (token) {
        const decoded = decodeJWT(token);
        if (decoded && decoded.exp * 1000 > Date.now()) {
            currentUser = JSON.parse(sessionStorage.getItem('authUser') || 'null');
            if (currentUser) setAuthState(true, currentUser);
        } else {
            clearSession();
        }
    }
    handleRouting();
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function decodeJWT(token) {
    try {
        return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch { return null; }
}

function getAuthHeader() {
    const token = sessionStorage.getItem('authToken');
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                 : { 'Content-Type': 'application/json' };
}

async function api(method, path, body) {
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            method,
            headers: getAuthHeader(),
            body: body ? JSON.stringify(body) : undefined
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');
        return data;
    } catch (err) {
        if (err.message === 'Failed to fetch')
            throw new Error('Network error — is the backend running on port 3000?');
        throw err;
    }
}

function clearSession() {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('authUser');
    currentUser = null;
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
function setupEventListeners() {
    window.addEventListener('hashchange', handleRouting);
    document.getElementById('register-form')  ?.addEventListener('submit', handleRegister);
    document.getElementById('login-form')     ?.addEventListener('submit', handleLogin);
    document.getElementById('profile-form')   ?.addEventListener('submit', handleProfileUpdate);
    document.getElementById('account-form')   ?.addEventListener('submit', handleAccountSave);
    document.getElementById('dept-form')      ?.addEventListener('submit', handleDeptSave);
    document.getElementById('employee-form')  ?.addEventListener('submit', handleEmployeeSave);
    document.getElementById('request-form')   ?.addEventListener('submit', handleRequestSubmit);
}

// ─── ROUTING ──────────────────────────────────────────────────────────────────
function navigateTo(hash) { window.location.hash = hash; }

function handleRouting() {
    const route = (window.location.hash || '#/').substring(2);
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    const protectedRoutes = ['profile', 'requests'];
    const adminRoutes = ['admin/accounts', 'admin/departments', 'admin/employees', 'admin/requests'];

    if (protectedRoutes.some(r => route.startsWith(r)) && !currentUser) {
        navigateTo('#/login'); showToast('Please login first', 'warning'); return;
    }
    if (adminRoutes.some(r => route.startsWith(r))) {
        if (!currentUser) { navigateTo('#/login'); showToast('Please login first', 'warning'); return; }
        if (currentUser.role !== 'admin') { navigateTo('#/'); showToast('Admin access only', 'danger'); return; }
    }

    const map = {
        '': 'home-page', 'register': 'register-page', 'verify': 'verify-page',
        'login': 'login-page', 'profile': 'profile-page', 'requests': 'requests-page',
        'admin/accounts': 'admin-accounts-page', 'admin/departments': 'admin-departments-page',
        'admin/employees': 'admin-employees-page', 'admin/requests': 'admin-requests-page'
    };

    const pageId = map[route] || 'home-page';
    document.getElementById(pageId)?.classList.add('active');

    if (route === 'verify')            setupVerifyPage();
    if (route === 'profile')           renderProfile();
    if (route === 'requests')          loadUserRequests();
    if (route === 'admin/accounts')    loadAdminAccounts();
    if (route === 'admin/departments') loadAdminDepartments();
    if (route === 'admin/employees')   loadAdminEmployees();
    if (route === 'admin/requests')    loadAdminRequests();
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
async function handleRegister(e) {
    e.preventDefault();
    const firstName = document.getElementById('reg-firstname').value.trim();
    const lastName  = document.getElementById('reg-lastname').value.trim();
    const username  = document.getElementById('reg-email').value.trim();
    const password  = document.getElementById('reg-password').value;
    try {
        await api('POST', '/api/register', { firstName, lastName, username, password });
        sessionStorage.setItem('unverifiedUser', username);
        navigateTo('#/verify');
        showToast('Account created! Please verify.', 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

function setupVerifyPage() {
    const u = sessionStorage.getItem('unverifiedUser') || '';
    document.getElementById('verify-email-display').textContent = u;
}

async function simulateEmailVerification() {
    const username = sessionStorage.getItem('unverifiedUser');
    if (!username) { showToast('No pending verification', 'danger'); return; }
    try {
        await api('POST', '/api/verify', { username });
        sessionStorage.removeItem('unverifiedUser');
        navigateTo('#/login');
        showToast('Email verified! You can now login.', 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
        const data = await api('POST', '/api/login', { username, password });
        sessionStorage.setItem('authToken', data.token);
        const decoded = decodeJWT(data.token);
        const user = { ...data.user, role: decoded?.role || data.user.role };
        sessionStorage.setItem('authUser', JSON.stringify(user));
        setAuthState(true, user);
        navigateTo('#/profile');
        showToast(`Welcome back, ${user.firstName || user.username}!`, 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

function setAuthState(isAuth, user = null) {
    currentUser = user;
    document.body.classList.toggle('not-authenticated', !isAuth);
    document.body.classList.toggle('authenticated', isAuth);
    document.body.classList.toggle('is-admin', isAuth && user?.role === 'admin');
}

function logout() {
    clearSession();
    setAuthState(false);
    navigateTo('#/');
    showToast('Logged out', 'info');
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
async function renderProfile() {
    if (!currentUser) return;
    try {
        const user = await api('GET', '/api/profile');
        // Update stored user with latest from server
        currentUser = { ...currentUser, ...user };
        sessionStorage.setItem('authUser', JSON.stringify(currentUser));

        document.getElementById('profile-content').innerHTML = `
            <div class="profile-info">
                <div class="profile-row"><span class="profile-label">Name</span><span>${user.firstName} ${user.lastName}</span></div>
                <div class="profile-row"><span class="profile-label">Username</span><span>${user.username}</span></div>
                <div class="profile-row">
                    <span class="profile-label">Role</span>
                    <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-primary'}">${user.role.toUpperCase()}</span>
                </div>
                <div class="profile-row">
                    <span class="profile-label">Status</span>
                    <span class="badge bg-success">Verified</span>
                </div>
            </div>
            <hr style="margin:20px 0; border-color: var(--border)">
            <h6 style="font-weight:600; margin-bottom:16px">Edit Profile</h6>
            <form id="profile-form">
                <div class="row g-3">
                    <div class="col-md-6">
                        <label class="form-label">First Name</label>
                        <input type="text" class="form-control" id="edit-firstname" value="${user.firstName}">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Last Name</label>
                        <input type="text" class="form-control" id="edit-lastname" value="${user.lastName}">
                    </div>
                    <div class="col-12">
                        <label class="form-label">Current Password <small class="text-muted">(required to change password)</small></label>
                        <input type="password" class="form-control" id="edit-current-pw" placeholder="Enter current password">
                    </div>
                    <div class="col-12">
                        <label class="form-label">New Password <small class="text-muted">(leave blank to keep current)</small></label>
                        <input type="password" class="form-control" id="edit-new-pw" placeholder="Enter new password">
                    </div>
                    <div class="col-12">
                        <button type="submit" class="btn btn-primary">Save Changes</button>
                    </div>
                </div>
            </form>
        `;
        // Re-attach after innerHTML replacement
        document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
    } catch (err) { showToast(err.message, 'danger'); }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const body = {
        firstName:       document.getElementById('edit-firstname').value.trim(),
        lastName:        document.getElementById('edit-lastname').value.trim(),
        currentPassword: document.getElementById('edit-current-pw').value,
        newPassword:     document.getElementById('edit-new-pw').value
    };
    if (!body.newPassword) { delete body.currentPassword; delete body.newPassword; }
    try {
        const data = await api('PUT', '/api/profile', body);
        currentUser = { ...currentUser, ...data.user };
        sessionStorage.setItem('authUser', JSON.stringify(currentUser));
        showToast('Profile updated!', 'success');
        renderProfile();
    } catch (err) { showToast(err.message, 'danger'); }
}

// ─── USER: MY REQUESTS ────────────────────────────────────────────────────────
async function loadUserRequests() {
    try {
        const list = await api('GET', '/api/requests');
        const el   = document.getElementById('requests-list');
        if (!list.length) {
            el.innerHTML = `<div class="alert alert-info">No requests yet. Click "+ New Request" to create one.</div>`;
            return;
        }
        el.innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead><tr><th>Type</th><th>Items</th><th>Date</th><th>Status</th></tr></thead>
                    <tbody>
                        ${list.map(r => `
                            <tr>
                                <td>${r.type}</td>
                                <td>${r.items.map(i => `${i.name} (${i.qty})`).join(', ')}</td>
                                <td>${new Date(r.date).toLocaleDateString()}</td>
                                <td><span class="badge bg-${statusColor(r.status)}">${r.status}</span></td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (err) { showToast(err.message, 'danger'); }
}

function openNewRequestModal() {
    document.getElementById('request-form').reset();
    document.getElementById('request-items-container').innerHTML = itemRowHTML(true);
    new bootstrap.Modal(document.getElementById('requestModal')).show();
}

function itemRowHTML(disabled = false) {
    return `<div class="row mb-2 request-item">
        <div class="col-7"><input type="text" class="form-control item-name" placeholder="Item name" required></div>
        <div class="col-3"><input type="number" class="form-control item-qty" placeholder="Qty" min="1" required></div>
        <div class="col-2"><button type="button" class="btn btn-sm btn-danger" onclick="removeRequestItem(this)" ${disabled ? 'disabled' : ''}>×</button></div>
    </div>`;
}

function addRequestItem() {
    const div = document.createElement('div');
    div.innerHTML = itemRowHTML();
    document.getElementById('request-items-container').appendChild(div.firstElementChild);
}

function removeRequestItem(btn) { btn.closest('.request-item').remove(); }

async function handleRequestSubmit(e) {
    e.preventDefault();
    const type  = document.getElementById('request-type').value;
    const items = [...document.querySelectorAll('.request-item')].map(el => ({
        name: el.querySelector('.item-name').value,
        qty:  parseInt(el.querySelector('.item-qty').value)
    })).filter(i => i.name && i.qty);

    if (!items.length) { showToast('Add at least one item', 'warning'); return; }
    try {
        await api('POST', '/api/requests', { type, items });
        bootstrap.Modal.getInstance(document.getElementById('requestModal')).hide();
        loadUserRequests();
        showToast('Request submitted!', 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

// ─── ADMIN: ACCOUNTS ──────────────────────────────────────────────────────────
async function loadAdminAccounts() {
    try {
        const list = await api('GET', '/api/admin/accounts');
        document.getElementById('accounts-list').innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Verified</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${list.map(a => `
                            <tr>
                                <td>${a.firstName} ${a.lastName}</td>
                                <td>${a.username}</td>
                                <td><span class="badge ${a.role === 'admin' ? 'bg-danger' : 'bg-primary'}">${a.role}</span></td>
                                <td>${a.verified ? '<span class="badge bg-success">✓</span>' : '<span class="badge bg-secondary">—</span>'}</td>
                                <td class="action-buttons">
                                    <button class="btn btn-sm btn-primary"  onclick="openAccountModal(${a.id})">Edit</button>
                                    <button class="btn btn-sm btn-warning"  onclick="openResetPwModal(${a.id})">Reset PW</button>
                                    <button class="btn btn-sm btn-danger"   onclick="deleteAccount(${a.id})">Delete</button>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (err) { showToast(err.message, 'danger'); }
}

function openAccountModal(id = null) {
    document.getElementById('account-form').reset();
    document.getElementById('account-id').value = '';
    document.getElementById('accountModalTitle').textContent = id ? 'Edit Account' : 'Add Account';
    document.getElementById('account-password').required = !id;

    if (id) {
        api('GET', '/api/admin/accounts').then(list => {
            const a = list.find(x => x.id === id);
            if (!a) return;
            document.getElementById('account-id').value        = a.id;
            document.getElementById('account-firstname').value = a.firstName;
            document.getElementById('account-lastname').value  = a.lastName;
            document.getElementById('account-username').value  = a.username;
            document.getElementById('account-role').value      = a.role;
            document.getElementById('account-verified').checked = a.verified;
        });
    }
    new bootstrap.Modal(document.getElementById('accountModal')).show();
}

async function handleAccountSave(e) {
    e.preventDefault();
    const id       = document.getElementById('account-id').value;
    const body = {
        firstName: document.getElementById('account-firstname').value,
        lastName:  document.getElementById('account-lastname').value,
        username:  document.getElementById('account-username').value,
        password:  document.getElementById('account-password').value || undefined,
        role:      document.getElementById('account-role').value,
        verified:  document.getElementById('account-verified').checked
    };
    if (!body.password) delete body.password;
    try {
        if (id) { await api('PUT',  `/api/admin/accounts/${id}`, body); }
        else    { await api('POST', `/api/admin/accounts`, body); }
        bootstrap.Modal.getInstance(document.getElementById('accountModal')).hide();
        loadAdminAccounts();
        showToast('Account saved!', 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

function openResetPwModal(id) {
    document.getElementById('reset-pw-id').value = id;
    document.getElementById('reset-pw-input').value = '';
    new bootstrap.Modal(document.getElementById('resetPwModal')).show();
}

async function handleResetPassword() {
    const id       = document.getElementById('reset-pw-id').value;
    const password = document.getElementById('reset-pw-input').value;
    if (!password || password.length < 6) { showToast('Min 6 characters', 'warning'); return; }
    try {
        await api('PUT', `/api/admin/accounts/${id}/reset-password`, { password });
        bootstrap.Modal.getInstance(document.getElementById('resetPwModal')).hide();
        showToast('Password reset!', 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

async function deleteAccount(id) {
    if (!confirm('Delete this account?')) return;
    try {
        await api('DELETE', `/api/admin/accounts/${id}`);
        loadAdminAccounts();
        showToast('Account deleted', 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

// ─── ADMIN: DEPARTMENTS ───────────────────────────────────────────────────────
async function loadAdminDepartments() {
    try {
        const list = await api('GET', '/api/departments');
        document.getElementById('departments-list').innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${list.map(d => `
                            <tr>
                                <td>${d.name}</td>
                                <td>${d.description}</td>
                                <td class="action-buttons">
                                    <button class="btn btn-sm btn-primary" onclick="openDeptModal(${d.id})">Edit</button>
                                    <button class="btn btn-sm btn-danger"  onclick="deleteDept(${d.id})">Delete</button>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (err) { showToast(err.message, 'danger'); }
}

function openDeptModal(id = null) {
    document.getElementById('dept-form').reset();
    document.getElementById('dept-id').value = '';
    document.getElementById('deptModalTitle').textContent = id ? 'Edit Department' : 'Add Department';
    if (id) {
        api('GET', '/api/departments').then(list => {
            const d = list.find(x => x.id === id);
            if (!d) return;
            document.getElementById('dept-id').value          = d.id;
            document.getElementById('dept-name').value        = d.name;
            document.getElementById('dept-description').value = d.description;
        });
    }
    new bootstrap.Modal(document.getElementById('deptModal')).show();
}

async function handleDeptSave(e) {
    e.preventDefault();
    const id   = document.getElementById('dept-id').value;
    const body = {
        name:        document.getElementById('dept-name').value,
        description: document.getElementById('dept-description').value
    };
    try {
        if (id) { await api('PUT',  `/api/admin/departments/${id}`, body); }
        else    { await api('POST', `/api/admin/departments`, body); }
        bootstrap.Modal.getInstance(document.getElementById('deptModal')).hide();
        loadAdminDepartments();
        showToast('Department saved!', 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

async function deleteDept(id) {
    if (!confirm('Delete this department?')) return;
    try {
        await api('DELETE', `/api/admin/departments/${id}`);
        loadAdminDepartments();
        showToast('Department deleted', 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

// ─── ADMIN: EMPLOYEES ─────────────────────────────────────────────────────────
async function loadAdminEmployees() {
    try {
        const [emps, users, depts] = await Promise.all([
            api('GET', '/api/admin/employees'),
            api('GET', '/api/admin/accounts'),
            api('GET', '/api/departments')
        ]);
        document.getElementById('employees-list').innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead><tr><th>Emp ID</th><th>User</th><th>Position</th><th>Department</th><th>Hire Date</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${emps.map(emp => {
                            const u = users.find(x => x.id === emp.userId);
                            const d = depts.find(x => x.id === emp.deptId);
                            return `<tr>
                                <td>${emp.employeeId}</td>
                                <td>${u ? `${u.firstName} ${u.lastName}` : 'N/A'}</td>
                                <td>${emp.position}</td>
                                <td>${d ? d.name : 'N/A'}</td>
                                <td>${new Date(emp.hireDate).toLocaleDateString()}</td>
                                <td class="action-buttons">
                                    <button class="btn btn-sm btn-primary" onclick="openEmployeeModal(${emp.id})">Edit</button>
                                    <button class="btn btn-sm btn-danger"  onclick="deleteEmployee(${emp.id})">Delete</button>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (err) { showToast(err.message, 'danger'); }
}

async function openEmployeeModal(id = null) {
    document.getElementById('employee-form').reset();
    document.getElementById('employee-id').value = '';
    document.getElementById('employeeModalTitle').textContent = id ? 'Edit Employee' : 'Add Employee';

    const [users, depts] = await Promise.all([
        api('GET', '/api/admin/accounts'),
        api('GET', '/api/departments')
    ]);

    const userSel = document.getElementById('employee-userid');
    userSel.innerHTML = '<option value="">Select user...</option>' +
        users.map(u => `<option value="${u.id}">${u.firstName} ${u.lastName} (${u.username})</option>`).join('');

    const deptSel = document.getElementById('employee-dept');
    deptSel.innerHTML = '<option value="">Select department...</option>' +
        depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

    if (id) {
        const emps = await api('GET', '/api/admin/employees');
        const emp  = emps.find(e => e.id === id);
        if (emp) {
            document.getElementById('employee-id').value       = emp.id;
            document.getElementById('employee-empid').value    = emp.employeeId;
            document.getElementById('employee-userid').value   = emp.userId;
            document.getElementById('employee-position').value = emp.position;
            document.getElementById('employee-dept').value     = emp.deptId;
            document.getElementById('employee-hiredate').value = emp.hireDate;
        }
    }
    new bootstrap.Modal(document.getElementById('employeeModal')).show();
}

async function handleEmployeeSave(e) {
    e.preventDefault();
    const id   = document.getElementById('employee-id').value;
    const body = {
        employeeId: document.getElementById('employee-empid').value,
        userId:     document.getElementById('employee-userid').value,
        position:   document.getElementById('employee-position').value,
        deptId:     document.getElementById('employee-dept').value,
        hireDate:   document.getElementById('employee-hiredate').value
    };
    try {
        if (id) { await api('PUT',  `/api/admin/employees/${id}`, body); }
        else    { await api('POST', `/api/admin/employees`, body); }
        bootstrap.Modal.getInstance(document.getElementById('employeeModal')).hide();
        loadAdminEmployees();
        showToast('Employee saved!', 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

async function deleteEmployee(id) {
    if (!confirm('Delete this employee?')) return;
    try {
        await api('DELETE', `/api/admin/employees/${id}`);
        loadAdminEmployees();
        showToast('Employee deleted', 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

// ─── ADMIN: ALL REQUESTS ──────────────────────────────────────────────────────
async function loadAdminRequests() {
    try {
        const list = await api('GET', '/api/admin/requests');
        const el   = document.getElementById('admin-requests-list');
        if (!list.length) {
            el.innerHTML = `<div class="alert alert-info">No requests yet.</div>`; return;
        }
        el.innerHTML = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead><tr><th>User</th><th>Type</th><th>Items</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        ${list.map(r => `
                            <tr>
                                <td>${r.userFullName}<br><small class="text-muted">${r.username}</small></td>
                                <td>${r.type}</td>
                                <td>${r.items.map(i => `${i.name} (${i.qty})`).join(', ')}</td>
                                <td>${new Date(r.date).toLocaleDateString()}</td>
                                <td><span class="badge bg-${statusColor(r.status)}">${r.status}</span></td>
                                <td class="action-buttons">
                                    ${r.status === 'Pending' ? `
                                        <button class="btn btn-sm btn-success" onclick="updateReqStatus(${r.id},'Approved')">Approve</button>
                                        <button class="btn btn-sm btn-warning" onclick="updateReqStatus(${r.id},'Rejected')">Reject</button>
                                    ` : `<span class="badge bg-${statusColor(r.status)}">${r.status}</span>`}
                                    <button class="btn btn-sm btn-danger" onclick="deleteAdminRequest(${r.id})">Delete</button>
                                </td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`;
    } catch (err) { showToast(err.message, 'danger'); }
}

async function updateReqStatus(id, status) {
    try {
        await api('PUT', `/api/admin/requests/${id}/status`, { status });
        loadAdminRequests();
        showToast(`Request ${status.toLowerCase()}`, 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

async function deleteAdminRequest(id) {
    if (!confirm('Delete this request?')) return;
    try {
        await api('DELETE', `/api/admin/requests/${id}`);
        loadAdminRequests();
        showToast('Request deleted', 'success');
    } catch (err) { showToast(err.message, 'danger'); }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
function statusColor(s) {
    return s === 'Approved' ? 'success' : s === 'Rejected' ? 'danger' : 'warning';
}

function showToast(message, type = 'info') {
    const id = 'toast-' + Date.now();
    const bg = { success: 'bg-success', danger: 'bg-danger', warning: 'bg-warning' }[type] || 'bg-info';
    document.getElementById('toast-container').insertAdjacentHTML('beforeend', `
        <div id="${id}" class="toast align-items-center text-white ${bg} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>`);
    const el = document.getElementById(id);
    new bootstrap.Toast(el).show();
    el.addEventListener('hidden.bs.toast', () => el.remove());
}