let currentUser = null;
const STORAGE_KEY = 'iptdemov1';

// Database structure
window.db = {
    accounts: [],
    departments: [],
    employees: [],
    requests: []
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    loadFromStorage();
    setupEventListeners();
   
    // Set initial hash if empty
    if (!window.location.hash) {
        window.location.hash = '#/';
    }
   
    handleRouting();
});

// Event listeners
function setupEventListeners() {
    window.addEventListener('hashchange', handleRouting);
   
    // Register form
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);
   
    // Login form
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
   
    // Account form
    document.getElementById('account-form')?.addEventListener('submit', handleAccountSave);
   
    // Employee form
    document.getElementById('employee-form')?.addEventListener('submit', handleEmployeeSave);
   
    // Request form
    document.getElementById('request-form')?.addEventListener('submit', handleRequestSubmit);
}

// Storage functions
function loadFromStorage() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (data) {
            window.db = JSON.parse(data);
        } else {
            seedData();
        }
    } catch (e) {
        console.error('Error loading from storage:', e);
        seedData();
    }
   
    // Check for existing auth
    const authToken = localStorage.getItem('authtoken');
    if (authToken) {
        const user = window.db.accounts.find(acc => acc.email === authToken);
        if (user && user.verified) {
            setAuthState(true, user);
        }
    }
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
}

function seedData() {
    window.db = {
        accounts: [
            {
                id: generateId(),
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@example.com',
                password: 'Password123!',
                role: 'admin',
                verified: true
            },
            {
                id: generateId(),
                firstName: 'Regular',
                lastName: 'User',
                email: 'user@example.com',
                password: 'Password123!',
                role: 'user',
                verified: true
            }
        ],
        departments: [
            {
                id: generateId(),
                name: 'Engineering',
                description: 'Software development and IT'
            },
            {
                id: generateId(),
                name: 'Human Resources',
                description: 'HR and employee management'
            }
        ],
        employees: [],
        requests: []
    };
    saveToStorage();
}

function generateId() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Routing
function navigateTo(hash) {
    window.location.hash = hash;
}

function handleRouting() {
    const hash = window.location.hash || '#/';
    const route = hash.substring(2); // Remove '#/'
   
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
   
    // Protected routes
    const protectedRoutes = ['profile', 'requests'];
    const adminRoutes = ['admin/accounts', 'admin/departments', 'admin/employees', 'admin/requests'];
   
    if (protectedRoutes.some(r => route.startsWith(r)) && !currentUser) {
        navigateTo('#/login');
        showToast('Please login to access this page', 'warning');
        return;
    }
   
    if (adminRoutes.some(r => route.startsWith(r))) {
        if (!currentUser) {
            navigateTo('#/login');
            showToast('Please login to access this page', 'warning');
            return;
        }
        if (currentUser.role !== 'admin') {
            navigateTo('#/');
            showToast('Access denied. Admin only.', 'danger');
            return;
        }
    }
   
    // Show appropriate page
    switch(route) {
        case '':
            document.getElementById('home-page').classList.add('active');
            break;
        case 'register':
            document.getElementById('register-page').classList.add('active');
            break;
        case 'verify':
            document.getElementById('verify-page').classList.add('active');
            const email = localStorage.getItem('unverifiedemail');
            document.getElementById('verify-email-display').textContent = email;
            break;
        case 'login':
            document.getElementById('login-page').classList.add('active');
            break;
        case 'profile':
            document.getElementById('profile-page').classList.add('active');
            renderProfile();
            break;
        case 'requests':
            document.getElementById('requests-page').classList.add('active');
            renderRequests();
            break;
        case 'admin/accounts':
            document.getElementById('admin-accounts-page').classList.add('active');
            renderAccountsList();
            break;
        case 'admin/departments':
            document.getElementById('admin-departments-page').classList.add('active');
            renderDepartmentsList();
            break;
        case 'admin/employees':
            document.getElementById('admin-employees-page').classList.add('active');
            renderEmployeesList();
            break;
        case 'admin/requests':
            document.getElementById('admin-requests-page').classList.add('active');
            renderAdminRequestsList();
            break;
        default:
            document.getElementById('home-page').classList.add('active');
    }
}

// Authentication
function handleRegister(e) {
    e.preventDefault();
   
    const firstName = document.getElementById('reg-firstname').value;
    const lastName = document.getElementById('reg-lastname').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
   
    // Check if email exists
    if (window.db.accounts.find(acc => acc.email === email)) {
        showToast('Email already exists', 'danger');
        return;
    }
   
    // Create account
    const newAccount = {
        id: generateId(),
        firstName,
        lastName,
        email,
        password,
        role: 'user',
        verified: false
    };
   
    window.db.accounts.push(newAccount);
    saveToStorage();
   
    localStorage.setItem('unverifiedemail', email);
    navigateTo('#/verify');
    showToast('Account created! Please verify your email.', 'success');
}

function simulateEmailVerification() {
    const email = localStorage.getItem('unverifiedemail');
    const account = window.db.accounts.find(acc => acc.email === email);
   
    if (account) {
        account.verified = true;
        saveToStorage();
        localStorage.removeItem('unverifiedemail');
        navigateTo('#/login');
        showToast('Email verified! You can now login.', 'success');
    }
}

function handleLogin(e) {
    e.preventDefault();
   
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
   
    const account = window.db.accounts.find(acc =>
        acc.email === email &&
        acc.password === password &&
        acc.verified === true
    );
   
    if (account) {
        localStorage.setItem('authtoken', email);
        setAuthState(true, account);
        navigateTo('#/profile');
        showToast(`Welcome back, ${account.firstName}!`, 'success');
    } else {
        showToast('Invalid credentials or email not verified', 'danger');
    }
}

function setAuthState(isAuth, user = null) {
    currentUser = user;
    const body = document.body;
   
    if (isAuth && user) {
        body.classList.remove('not-authenticated');
        body.classList.add('authenticated');
       
        if (user.role === 'admin') {
            body.classList.add('is-admin');
        } else {
            body.classList.remove('is-admin');
        }
    } else {
        body.classList.remove('authenticated', 'is-admin');
        body.classList.add('not-authenticated');
    }
}

function logout() {
    localStorage.removeItem('authtoken');
    setAuthState(false);
    navigateTo('#/');
    showToast('Logged out successfully', 'info');
}

// Profile rendering
function renderProfile() {
    if (!currentUser) return;
   
    const html = `
        <div class="profile-info">
            <div class="row">
                <div class="col-12">
                    <strong>Name:</strong> ${currentUser.firstName} ${currentUser.lastName}
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <strong>Email:</strong> ${currentUser.email}
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <strong>Role:</strong> <span class="badge ${currentUser.role === 'admin' ? 'bg-danger' : 'bg-primary'}">${currentUser.role.toUpperCase()}</span>
                </div>
            </div>
            <div class="row">
                <div class="col-12">
                    <strong>Status:</strong> <span class="badge bg-success">Verified</span>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-12">
                    <button class="btn btn-primary" onclick="alert('Edit profile not yet implemented')">Edit Profile</button>
                </div>
            </div>
        </div>
    `;
   
    document.getElementById('profile-content').innerHTML = html;
}

// Requests management
function renderRequests() {
    if (!currentUser) return;
   
    const userRequests = window.db.requests.filter(req => req.employeeEmail === currentUser.email);
   
    if (userRequests.length === 0) {
        document.getElementById('requests-list').innerHTML = `
            <div class="alert alert-info">No requests yet. Click "+ New Request" to create one.</div>
        `;
        return;
    }
   
    let html = `
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Items</th>
                        <th>Date</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
    `;
   
    userRequests.forEach(req => {
        const statusClass = req.status === 'Pending' ? 'warning' :
                          req.status === 'Approved' ? 'success' : 'danger';
        const itemsList = req.items.map(item => `${item.name} (${item.qty})`).join(', ');
       
        html += `
            <tr>
                <td>${req.type}</td>
                <td>${itemsList}</td>
                <td>${new Date(req.date).toLocaleDateString()}</td>
                <td><span class="badge bg-${statusClass}">${req.status}</span></td>
            </tr>
        `;
    });
   
    html += '</tbody></table></div>';
    document.getElementById('requests-list').innerHTML = html;
}

function openNewRequestModal() {
    // Reset form
    document.getElementById('request-form').reset();
    document.getElementById('request-items-container').innerHTML = `
        <div class="row mb-2 request-item">
            <div class="col-7">
                <input type="text" class="form-control item-name" placeholder="Item name" required>
            </div>
            <div class="col-3">
                <input type="number" class="form-control item-qty" placeholder="Qty" min="1" required>
            </div>
            <div class="col-2">
                <button type="button" class="btn btn-sm btn-danger" onclick="removeRequestItem(this)" disabled>×</button>
            </div>
        </div>
    `;
   
    const modal = new bootstrap.Modal(document.getElementById('requestModal'));
    modal.show();
}

function addRequestItem() {
    const container = document.getElementById('request-items-container');
    const newItem = document.createElement('div');
    newItem.className = 'row mb-2 request-item';
    newItem.innerHTML = `
        <div class="col-7">
            <input type="text" class="form-control item-name" placeholder="Item name" required>
        </div>
        <div class="col-3">
            <input type="number" class="form-control item-qty" placeholder="Qty" min="1" required>
        </div>
        <div class="col-2">
            <button type="button" class="btn btn-sm btn-danger" onclick="removeRequestItem(this)">×</button>
        </div>
    `;
    container.appendChild(newItem);
}

function removeRequestItem(btn) {
    btn.closest('.request-item').remove();
}

function handleRequestSubmit(e) {
    e.preventDefault();
   
    const type = document.getElementById('request-type').value;
    const itemElements = document.querySelectorAll('.request-item');
    const items = [];
   
    itemElements.forEach(elem => {
        const name = elem.querySelector('.item-name').value;
        const qty = elem.querySelector('.item-qty').value;
        if (name && qty) {
            items.push({ name, qty: parseInt(qty) });
        }
    });
   
    if (items.length === 0) {
        showToast('Please add at least one item', 'warning');
        return;
    }
   
    const newRequest = {
        id: generateId(),
        type,
        items,
        status: 'Pending',
        date: new Date().toISOString(),
        employeeEmail: currentUser.email
    };
   
    window.db.requests.push(newRequest);
    saveToStorage();
   
    bootstrap.Modal.getInstance(document.getElementById('requestModal')).hide();
    renderRequests();
    showToast('Request submitted successfully', 'success');
}

// Admin - Accounts
function renderAccountsList() {
    let html = `
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Verified</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
   
    window.db.accounts.forEach(acc => {
        html += `
            <tr>
                <td>${acc.firstName} ${acc.lastName}</td>
                <td>${acc.email}</td>
                <td><span class="badge ${acc.role === 'admin' ? 'bg-danger' : 'bg-primary'}">${acc.role}</span></td>
                <td>${acc.verified ? '✓' : '—'}</td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editAccount('${acc.id}')">Edit</button>
                    <button class="btn btn-sm btn-warning" onclick="resetPassword('${acc.id}')">Reset PW</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAccount('${acc.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
   
    html += '</tbody></table></div>';
    document.getElementById('accounts-list').innerHTML = html;
}

function openAccountModal(accountId = null) {
    const modal = new bootstrap.Modal(document.getElementById('accountModal'));
    const form = document.getElementById('account-form');
    form.reset();
   
    if (accountId) {
        const account = window.db.accounts.find(acc => acc.id === accountId);
        if (account) {
            document.getElementById('accountModalTitle').textContent = 'Edit Account';
            document.getElementById('account-id').value = account.id;
            document.getElementById('account-firstname').value = account.firstName;
            document.getElementById('account-lastname').value = account.lastName;
            document.getElementById('account-email').value = account.email;
            document.getElementById('account-role').value = account.role;
            document.getElementById('account-verified').checked = account.verified;
            document.getElementById('account-password').required = false;
        }
    } else {
        document.getElementById('accountModalTitle').textContent = 'Add Account';
        document.getElementById('account-password').required = true;
    }
   
    modal.show();
}

function editAccount(id) {
    openAccountModal(id);
}

function handleAccountSave(e) {
    e.preventDefault();
   
    const id = document.getElementById('account-id').value;
    const firstName = document.getElementById('account-firstname').value;
    const lastName = document.getElementById('account-lastname').value;
    const email = document.getElementById('account-email').value;
    const password = document.getElementById('account-password').value;
    const role = document.getElementById('account-role').value;
    const verified = document.getElementById('account-verified').checked;
   
    if (id) {
        // Edit existing
        const account = window.db.accounts.find(acc => acc.id === id);
        if (account) {
            account.firstName = firstName;
            account.lastName = lastName;
            account.email = email;
            if (password) account.password = password;
            account.role = role;
            account.verified = verified;
        }
    } else {
        // Check if email exists
        if (window.db.accounts.find(acc => acc.email === email)) {
            showToast('Email already exists', 'danger');
            return;
        }
       
        // Create new
        window.db.accounts.push({
            id: generateId(),
            firstName,
            lastName,
            email,
            password,
            role,
            verified
        });
    }
   
    saveToStorage();
    bootstrap.Modal.getInstance(document.getElementById('accountModal')).hide();
    renderAccountsList();
    showToast('Account saved successfully', 'success');
}

function resetPassword(id) {
    const newPassword = prompt('Enter new password (min 6 characters):');
    if (newPassword && newPassword.length >= 6) {
        const account = window.db.accounts.find(acc => acc.id === id);
        if (account) {
            account.password = newPassword;
            saveToStorage();
            showToast('Password reset successfully', 'success');
        }
    } else if (newPassword !== null) {
        showToast('Password must be at least 6 characters', 'danger');
    }
}

function deleteAccount(id) {
    if (currentUser && currentUser.id === id) {
        showToast('Cannot delete your own account', 'danger');
        return;
    }
   
    if (confirm('Are you sure you want to delete this account?')) {
        window.db.accounts = window.db.accounts.filter(acc => acc.id !== id);
        saveToStorage();
        renderAccountsList();
        showToast('Account deleted successfully', 'success');
    }
}

// Admin - Departments
function renderDepartmentsList() {
    let html = `
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
    `;
   
    window.db.departments.forEach(dept => {
        html += `
            <tr>
                <td>${dept.name}</td>
                <td>${dept.description}</td>
            </tr>
        `;
    });
   
    html += '</tbody></table></div>';
    document.getElementById('departments-list').innerHTML = html;
}

// Admin - Employees
function renderEmployeesList() {
    let html = `
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User</th>
                        <th>Position</th>
                        <th>Department</th>
                        <th>Hire Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
   
    window.db.employees.forEach(emp => {
        const account = window.db.accounts.find(acc => acc.id === emp.userId);
        const dept = window.db.departments.find(d => d.id === emp.deptId);
       
        html += `
            <tr>
                <td>${emp.employeeId}</td>
                <td>${account ? account.email : 'N/A'}</td>
                <td>${emp.position}</td>
                <td>${dept ? dept.name : 'N/A'}</td>
                <td>${new Date(emp.hireDate).toLocaleDateString()}</td>
                <td class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editEmployee('${emp.id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteEmployee('${emp.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
   
    html += '</tbody></table></div>';
    document.getElementById('employees-list').innerHTML = html;
}

function openEmployeeModal(employeeId = null) {
    const modal = new bootstrap.Modal(document.getElementById('employeeModal'));
    const form = document.getElementById('employee-form');
    form.reset();
   
    // Populate email dropdown
    const emailSelect = document.getElementById('employee-email');
    emailSelect.innerHTML = '<option value="">Select user...</option>';
    window.db.accounts.forEach(acc => {
        emailSelect.innerHTML += `<option value="${acc.id}">${acc.email}</option>`;
    });
   
    // Populate department dropdown
    const deptSelect = document.getElementById('employee-dept');
    deptSelect.innerHTML = '<option value="">Select department...</option>';
    window.db.departments.forEach(dept => {
        deptSelect.innerHTML += `<option value="${dept.id}">${dept.name}</option>`;
    });
   
    if (employeeId) {
        const employee = window.db.employees.find(emp => emp.id === employeeId);
        if (employee) {
            document.getElementById('employeeModalTitle').textContent = 'Edit Employee';
            document.getElementById('employee-id').value = employee.id;
            document.getElementById('employee-empid').value = employee.employeeId;
            document.getElementById('employee-email').value = employee.userId;
            document.getElementById('employee-position').value = employee.position;
            document.getElementById('employee-dept').value = employee.deptId;
            document.getElementById('employee-hiredate').value = employee.hireDate;
        }
    } else {
        document.getElementById('employeeModalTitle').textContent = 'Add Employee';
    }
   
    modal.show();
}

function editEmployee(id) {
    openEmployeeModal(id);
}

function handleEmployeeSave(e) {
    e.preventDefault();
   
    const id = document.getElementById('employee-id').value;
    const employeeId = document.getElementById('employee-empid').value;
    const userId = document.getElementById('employee-email').value;
    const position = document.getElementById('employee-position').value;
    const deptId = document.getElementById('employee-dept').value;
    const hireDate = document.getElementById('employee-hiredate').value;
   
    if (id) {
        // Edit existing
        const employee = window.db.employees.find(emp => emp.id === id);
        if (employee) {
            employee.employeeId = employeeId;
            employee.userId = userId;
            employee.position = position;
            employee.deptId = deptId;
            employee.hireDate = hireDate;
        }
    } else {
        // Create new
        window.db.employees.push({
            id: generateId(),
            employeeId,
            userId,
            position,
            deptId,
            hireDate
        });
    }
   
    saveToStorage();
    bootstrap.Modal.getInstance(document.getElementById('employeeModal')).hide();
    renderEmployeesList();
    showToast('Employee saved successfully', 'success');
}

function deleteEmployee(id) {
    if (confirm('Are you sure you want to delete this employee?')) {
        window.db.employees = window.db.employees.filter(emp => emp.id !== id);
        saveToStorage();
        renderEmployeesList();
        showToast('Employee deleted successfully', 'success');
    }
}

// Toast notifications
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    const toastId = 'toast-' + Date.now();
   
    const bgClass = type === 'success' ? 'bg-success' :
                   type === 'danger' ? 'bg-danger' :
                   type === 'warning' ? 'bg-warning' :
                   'bg-info';
   
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
   
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
   
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}

// Admin - All Requests Management
function renderAdminRequestsList() {
    const allRequests = window.db.requests;
   
    if (allRequests.length === 0) {
        document.getElementById('admin-requests-list').innerHTML = `
            <div class="alert alert-info">No requests have been submitted yet.</div>
        `;
        return;
    }
   
    let html = `
        <div class="table-responsive">
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>User</th>
                        <th>Type</th>
                        <th>Items</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;
   
    allRequests.forEach(req => {
        const statusClass = req.status === 'Pending' ? 'warning' :
                          req.status === 'Approved' ? 'success' : 'danger';
        const itemsList = req.items.map(item => `${item.name} (${item.qty})`).join(', ');
        const user = window.db.accounts.find(acc => acc.email === req.employeeEmail);
        const userName = user ? `${user.firstName} ${user.lastName}` : req.employeeEmail;
       
        html += `
            <tr>
                <td>${userName}<br><small class="text-muted">${req.employeeEmail}</small></td>
                <td>${req.type}</td>
                <td>${itemsList}</td>
                <td>${new Date(req.date).toLocaleDateString()}</td>
                <td><span class="badge bg-${statusClass}">${req.status}</span></td>
                <td class="action-buttons">
                    ${req.status === 'Pending' ? `
                        <button class="btn btn-sm btn-success" onclick="updateRequestStatus('${req.id}', 'Approved')">Approve</button>
                        <button class="btn btn-sm btn-danger" onclick="updateRequestStatus('${req.id}', 'Rejected')">Reject</button>
                    ` : `
                        <button class="btn btn-sm btn-secondary" disabled>${req.status}</button>
                    `}
                    <button class="btn btn-sm btn-danger" onclick="deleteRequest('${req.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
   
    html += '</tbody></table></div>';
    document.getElementById('admin-requests-list').innerHTML = html;
}

function updateRequestStatus(requestId, newStatus) {
    const request = window.db.requests.find(req => req.id === requestId);
    if (request) {
        request.status = newStatus;
        saveToStorage();
        renderAdminRequestsList();
        showToast(`Request ${newStatus.toLowerCase()}`, 'success');
    }
}

function deleteRequest(requestId) {
    if (confirm('Are you sure you want to delete this request?')) {
        window.db.requests = window.db.requests.filter(req => req.id !== requestId);
        saveToStorage();
        renderAdminRequestsList();
        showToast('Request deleted successfully', 'success');
    }
}