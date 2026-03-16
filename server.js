const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');

const app        = express();
const PORT       = 3000;
const SECRET_KEY = 'your-very-secure-secret';

app.use(cors({ origin: '*' }));
app.use(express.json());

// Serve frontend files directly from the same folder
const path = require('path');
app.use(express.static(path.join(__dirname)));

// Root route — serves index.html so opening localhost:3000 works
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── IN-MEMORY DATABASE ───────────────────────────────────────────────────────
let users = [
    { id: 1, firstName: 'Admin',   lastName: 'User',  username: 'admin', password: '', role: 'admin', verified: true },
    { id: 2, firstName: 'Regular', lastName: 'User',  username: 'alice', password: '', role: 'user',  verified: true }
];
let departments = [
    { id: 1, name: 'Engineering',     description: 'Software development and IT' },
    { id: 2, name: 'Human Resources', description: 'HR and employee management'  }
];
let employees = [];
let requests  = [];
let nextUserId  = 3;
let nextDeptId  = 3;
let nextEmpId   = 1;
let nextReqId   = 1;

// Hash passwords on startup
users[0].password = bcrypt.hashSync('admin123', 10);
users[1].password = bcrypt.hashSync('user123',  10);

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access token required' });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
}

function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
}

function safeUser(u) {
    const { password, ...rest } = u;
    return rest;
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
    const { firstName = '', lastName = '', username, password, role = 'user' } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'User already exists' });

    const newUser = {
        id: nextUserId++,
        firstName, lastName,
        username,
        password: await bcrypt.hash(password, 10),
        role,
        verified: false
    };
    users.push(newUser);
    res.status(201).json({ message: 'User registered', user: safeUser(newUser) });
});

app.post('/api/verify', (req, res) => {
    const { username } = req.body;
    const user = users.find(u => u.username === username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.verified = true;
    res.json({ message: 'Email verified' });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.password)))
        return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.verified) return res.status(403).json({ error: 'Email not verified' });

    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        SECRET_KEY, { expiresIn: '2h' }
    );
    res.json({ token, user: safeUser(user) });
});

// ─── PROFILE ──────────────────────────────────────────────────────────────────
app.get('/api/profile', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(safeUser(user));
});

app.put('/api/profile', authenticateToken, async (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { firstName, lastName, currentPassword, newPassword } = req.body;
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName  !== undefined) user.lastName  = lastName;
    if (newPassword) {
        if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
        if (!(await bcrypt.compare(currentPassword, user.password)))
            return res.status(401).json({ error: 'Current password is incorrect' });
        user.password = await bcrypt.hash(newPassword, 10);
    }
    res.json({ message: 'Profile updated', user: safeUser(user) });
});

// ─── ADMIN: ACCOUNTS (CRUD) ───────────────────────────────────────────────────
app.get('/api/admin/accounts', authenticateToken, requireAdmin, (req, res) => {
    res.json(users.map(safeUser));
});

app.post('/api/admin/accounts', authenticateToken, requireAdmin, async (req, res) => {
    const { firstName = '', lastName = '', username, password, role = 'user', verified = false } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'User already exists' });
    const newUser = {
        id: nextUserId++, firstName, lastName, username,
        password: await bcrypt.hash(password, 10), role, verified
    };
    users.push(newUser);
    res.status(201).json(safeUser(newUser));
});

app.put('/api/admin/accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
    const user = users.find(u => u.id === parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { firstName, lastName, username, password, role, verified } = req.body;
    if (firstName  !== undefined) user.firstName = firstName;
    if (lastName   !== undefined) user.lastName  = lastName;
    if (username   !== undefined) user.username  = username;
    if (role       !== undefined) user.role      = role;
    if (verified   !== undefined) user.verified  = verified;
    if (password)                 user.password  = await bcrypt.hash(password, 10);
    res.json(safeUser(user));
});

app.delete('/api/admin/accounts/:id', authenticateToken, requireAdmin, (req, res) => {
    const id = parseInt(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    users.splice(idx, 1);
    res.json({ message: 'Account deleted' });
});

app.put('/api/admin/accounts/:id/reset-password', authenticateToken, requireAdmin, async (req, res) => {
    const user = users.find(u => u.id === parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password min 6 characters' });
    user.password = await bcrypt.hash(password, 10);
    res.json({ message: 'Password reset' });
});

// ─── ADMIN: DEPARTMENTS (CRUD) ────────────────────────────────────────────────
app.get('/api/departments', authenticateToken, (req, res) => {
    res.json(departments);
});

app.post('/api/admin/departments', authenticateToken, requireAdmin, (req, res) => {
    const { name, description = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    if (departments.find(d => d.name.toLowerCase() === name.toLowerCase()))
        return res.status(409).json({ error: 'Department already exists' });
    const dept = { id: nextDeptId++, name, description };
    departments.push(dept);
    res.status(201).json(dept);
});

app.put('/api/admin/departments/:id', authenticateToken, requireAdmin, (req, res) => {
    const dept = departments.find(d => d.id === parseInt(req.params.id));
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const { name, description } = req.body;
    if (name        !== undefined) dept.name        = name;
    if (description !== undefined) dept.description = description;
    res.json(dept);
});

app.delete('/api/admin/departments/:id', authenticateToken, requireAdmin, (req, res) => {
    const id  = parseInt(req.params.id);
    const idx = departments.findIndex(d => d.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Department not found' });
    departments.splice(idx, 1);
    res.json({ message: 'Department deleted' });
});

// ─── ADMIN: EMPLOYEES (CRUD) ──────────────────────────────────────────────────
app.get('/api/admin/employees', authenticateToken, requireAdmin, (req, res) => {
    res.json(employees);
});

app.post('/api/admin/employees', authenticateToken, requireAdmin, (req, res) => {
    const { employeeId, userId, position, deptId, hireDate } = req.body;
    if (!employeeId || !userId || !position || !deptId || !hireDate)
        return res.status(400).json({ error: 'All fields required' });
    const emp = { id: nextEmpId++, employeeId, userId: parseInt(userId), position, deptId: parseInt(deptId), hireDate };
    employees.push(emp);
    res.status(201).json(emp);
});

app.put('/api/admin/employees/:id', authenticateToken, requireAdmin, (req, res) => {
    const emp = employees.find(e => e.id === parseInt(req.params.id));
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const { employeeId, userId, position, deptId, hireDate } = req.body;
    if (employeeId !== undefined) emp.employeeId = employeeId;
    if (userId     !== undefined) emp.userId     = parseInt(userId);
    if (position   !== undefined) emp.position   = position;
    if (deptId     !== undefined) emp.deptId     = parseInt(deptId);
    if (hireDate   !== undefined) emp.hireDate   = hireDate;
    res.json(emp);
});

app.delete('/api/admin/employees/:id', authenticateToken, requireAdmin, (req, res) => {
    const idx = employees.findIndex(e => e.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Employee not found' });
    employees.splice(idx, 1);
    res.json({ message: 'Employee deleted' });
});

// ─── REQUESTS ─────────────────────────────────────────────────────────────────
// User: view own requests, create
app.get('/api/requests', authenticateToken, (req, res) => {
    const mine = requests.filter(r => r.userId === req.user.id);
    res.json(mine);
});

app.post('/api/requests', authenticateToken, (req, res) => {
    const { type, items } = req.body;
    if (!type || !items?.length) return res.status(400).json({ error: 'Type and items required' });
    const req_ = {
        id: nextReqId++, type, items,
        status: 'Pending',
        date: new Date().toISOString(),
        userId: req.user.id,
        username: req.user.username
    };
    requests.push(req_);
    res.status(201).json(req_);
});

// Admin: view all requests, approve/reject/delete
app.get('/api/admin/requests', authenticateToken, requireAdmin, (req, res) => {
    const enriched = requests.map(r => {
        const u = users.find(u => u.id === r.userId);
        return { ...r, userFullName: u ? `${u.firstName} ${u.lastName}` : r.username };
    });
    res.json(enriched);
});

app.put('/api/admin/requests/:id/status', authenticateToken, requireAdmin, (req, res) => {
    const r = requests.find(r => r.id === parseInt(req.params.id));
    if (!r) return res.status(404).json({ error: 'Request not found' });
    const { status } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    r.status = status;
    res.json(r);
});

app.delete('/api/admin/requests/:id', authenticateToken, requireAdmin, (req, res) => {
    const idx = requests.findIndex(r => r.id === parseInt(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Request not found' });
    requests.splice(idx, 1);
    res.json({ message: 'Request deleted' });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`✅ Backend running on http://localhost:${PORT}`);
    console.log(`   Admin → admin / admin123`);
    console.log(`   User  → alice / user123`);
});