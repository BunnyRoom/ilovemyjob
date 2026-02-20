const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

const MAX_GIVERS = 7;
let systemEnabled = true;
let receivers = new Map();
let idCounter = 1;

function getR(id) { return receivers.get(parseInt(id)); }

function serialize(r) {
    return {
        id: r.id, name: r.name, jobId: r.jobId,
        givers: r.givers, giverCount: r.givers.length,
        maxGivers: MAX_GIVERS, isFull: r.givers.length >= MAX_GIVERS,
        createdAt: r.createdAt
    };
}

function sysCheck(req, res, next) {
    if (!systemEnabled) return res.status(403).json({ success: false, message: 'ระบบปิดอยู่' });
    next();
}

// Base
app.get('/', (req, res) => res.json({ message: 'BunnyServer!', status: 'online', systemEnabled, receiverCount: receivers.size, timestamp: new Date().toISOString() }));
app.get('/health', (req, res) => res.send('OK'));

// System
app.post('/system', (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') return res.status(400).json({ success: false, message: 'enabled must be boolean' });
    systemEnabled = enabled;
    res.json({ success: true, systemEnabled, message: systemEnabled ? 'ระบบเปิดแล้ว' : 'ระบบปิดแล้ว' });
});

app.get('/system/status', (req, res) => {
    res.json({ systemEnabled, receiverCount: receivers.size, receivers: [...receivers.values()].map(serialize) });
});

// Receivers CRUD
app.post('/receivers', sysCheck, (req, res) => {
    const { name, jobId } = req.body;
    if (!name || !jobId) return res.status(400).json({ success: false, message: 'กรุณาระบุ name และ jobId' });
    for (const [, r] of receivers) {
        if (r.name === name) return res.status(409).json({ success: false, message: `ชื่อ "${name}" มีอยู่แล้ว` });
        if (r.jobId === jobId) return res.status(409).json({ success: false, message: `jobId "${jobId}" มีอยู่แล้ว` });
    }
    const id = idCounter++;
    const receiver = { id, name, jobId, givers: [], createdAt: new Date().toISOString() };
    receivers.set(id, receiver);
    res.status(201).json({ success: true, message: `สร้าง receiver "${name}" สำเร็จ`, receiver: serialize(receiver) });
});

app.get('/receivers', (req, res) => {
    res.json({ success: true, systemEnabled, receivers: [...receivers.values()].map(serialize), total: receivers.size });
});

app.get('/receivers/:id', (req, res) => {
    const r = getR(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'ไม่พบ receiver' });
    res.json({ success: true, receiver: serialize(r) });
});

app.put('/receivers/:id', sysCheck, (req, res) => {
    const r = getR(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'ไม่พบ receiver' });
    const { name, jobId } = req.body;
    if (name) r.name = name;
    if (jobId) r.jobId = jobId;
    res.json({ success: true, message: 'อัปเดตสำเร็จ', receiver: serialize(r) });
});

app.delete('/receivers/:id', (req, res) => {
    const r = getR(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'ไม่พบ receiver' });
    receivers.delete(parseInt(req.params.id));
    res.json({ success: true, message: `ลบ "${r.name}" สำเร็จ` });
});

// Givers
app.post('/receivers/:id/givers/join', sysCheck, (req, res) => {
    const r = getR(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'ไม่พบ receiver' });
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อ' });
    if (r.givers.find(g => g.name === name))
        return res.status(409).json({ success: false, message: `"${name}" อยู่ใน receiver นี้แล้ว` });
    if (r.givers.length >= MAX_GIVERS)
        return res.status(409).json({ success: false, full: true, message: `ตัวให้ของ "${r.name}" เต็มแล้ว (7/7)` });
    const giver = { name, joinedAt: new Date().toISOString() };
    r.givers.push(giver);
    res.json({ success: true, message: `${name} เข้าร่วมแล้ว`, giver, giverCount: r.givers.length });
});

app.post('/receivers/:id/givers/leave', (req, res) => {
    const r = getR(req.params.id);
    if (!r) return res.status(404).json({ success: false, message: 'ไม่พบ receiver' });
    const { name } = req.body;
    const idx = r.givers.findIndex(g => g.name === name);
    if (idx === -1) return res.status(404).json({ success: false, message: `ไม่พบ "${name}"` });
    r.givers.splice(idx, 1);
    res.json({ success: true, message: `${name} ออกแล้ว`, giverCount: r.givers.length });
});

// Check name
app.get('/check/:name', (req, res) => {
    const name = req.params.name;
    for (const [, r] of receivers) {
        if (r.name === name) return res.json({ found: true, name, role: 'receiver', receiverId: r.id, jobId: r.jobId });
        const g = r.givers.find(g => g.name === name);
        if (g) return res.json({ found: true, name, role: 'giver', receiverId: r.id, receiverName: r.name, jobId: r.jobId });
    }
    res.json({ found: false, name, message: `"${name}" ไม่อยู่ในระบบ` });
});

app.get('/list', (req, res) => {
    res.json({ systemEnabled, receivers: [...receivers.values()].map(serialize), total: receivers.size });
});

app.listen(port, () => {
    console.log(`BunnyServer  http://localhost:${port}`);
    console.log(`Dashboard    http://localhost:${port}/dashboard.html`);
});