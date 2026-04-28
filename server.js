// agent-flow/server.js — Backend completo: API REST + WebSocket + SQLite
const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');

// ── Config ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3790;
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'agent-5678';
const HEARTBEAT_TIMEOUT_MS = 120_000; // 2 min sem heartbeat = offline
const DB_PATH = path.join(__dirname, 'data', 'agent-flow.db');

// ── Database ──────────────────────────────────────────────────────────────
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'backlog'
      CHECK(status IN ('backlog','assigned','in_progress','review','done','rejected')),
    assigned_to TEXT DEFAULT NULL,
    priority TEXT NOT NULL DEFAULT 'medium'
      CHECK(priority IN ('low','medium','high','critical')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author TEXT NOT NULL DEFAULT 'system',
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);
`);

// Seed some demo tasks
const count = db.prepare('SELECT COUNT(*) as cnt FROM tasks').get();
if (count.cnt === 0) {
  const insert = db.prepare(
    'INSERT INTO tasks (id, title, description, status, assigned_to, priority) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const seed = [
    ['Configurar ambiente de dev', 'Instalar dependências e configurar Docker', 'backlog', null, 'high'],
    ['Criar endpoint de usuários', 'CRUD básico de usuários no backend', 'backlog', 'Bento', 'medium'],
    ['Desenvolver tela de login', 'Login com JWT e refresh token', 'assigned', 'Nina', 'high'],
    ['Testar fluxo de pagamento', 'Cobrir cenários de sucesso e erro', 'in_progress', 'Teco', 'critical'],
    ['Deploy staging', 'Subir ambiente de staging com Docker Compose', 'review', 'Dock', 'medium'],
    ['Documentar API', 'Swagger/OpenAPI dos endpoints', 'done', 'Luna', 'low'],
  ];
  const tx = db.transaction(() => {
    for (const [title, desc, status, who, priority] of seed) {
      insert.run(uuidv4(), title, desc, status, who, priority);
    }
  });
  tx();
}

// ── Express App ──────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function auth(req, res, next) {
  const token = req.headers['x-auth-token'] || req.query.token;
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── API Routes ───────────────────────────────────────────────────────────

// GET /api/tasks
app.get('/api/tasks', auth, (req, res) => {
  const { status, assigned_to } = req.query;
  let sql = 'SELECT * FROM tasks';
  const params = [];
  const clauses = [];
  if (status) { clauses.push('status = ?'); params.push(status); }
  if (assigned_to) { clauses.push('assigned_to = ?'); params.push(assigned_to); }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  const tasks = db.prepare(sql).all(...params);
  res.json(tasks);
});

// POST /api/tasks
app.post('/api/tasks', auth, (req, res) => {
  const { title, description, assigned_to, priority } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const id = uuidv4();
  db.prepare(
    'INSERT INTO tasks (id, title, description, status, assigned_to, priority) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, title, description || '', 'backlog', assigned_to || null, priority || 'medium');
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  broadcast({ type: 'task:created', task });
  res.status(201).json(task);
});

// GET /api/tasks/:id
app.get('/api/tasks/:id', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const comments = db.prepare('SELECT * FROM comments WHERE task_id = ? ORDER BY created_at').all(req.params.id);
  res.json({ ...task, comments });
});

// PATCH /api/tasks/:id
app.patch('/api/tasks/:id', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const allowed = ['title', 'description', 'status', 'assigned_to', 'priority'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(req.body[key]);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

  sets.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  broadcast({ type: 'task:updated', task: updated, changes: req.body });
  res.json(updated);
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  broadcast({ type: 'task:deleted', taskId: req.params.id });
  res.json({ ok: true });
});

// POST /api/tasks/:id/comments
app.post('/api/tasks/:id/comments', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { author, body } = req.body;
  if (!body) return res.status(400).json({ error: 'body is required' });
  const id = uuidv4();
  db.prepare('INSERT INTO comments (id, task_id, author, body) VALUES (?, ?, ?, ?)').run(
    id, req.params.id, author || 'system', body
  );
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  broadcast({ type: 'task:comment', taskId: req.params.id, comment });
  res.status(201).json(comment);
});

// ── Agent Heartbeat ───────────────────────────────────────────────────────
const agents = new Map(); // agent_name -> { name, lastSeen, status }

app.post('/api/agents/heartbeat', (req, res) => {
  const { name, status } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  // accept heartbeat without auth so agents can ping easily
  agents.set(name, {
    name,
    lastSeen: Date.now(),
    status: status || 'online',
  });
  broadcast({ type: 'agent:heartbeat', agent: agents.get(name) });
  res.json({ ok: true });
});

app.get('/api/agents', (req, res) => {
  const now = Date.now();
  const list = [];
  for (const [name, data] of agents) {
    const elapsed = now - data.lastSeen;
    list.push({
      ...data,
      status: elapsed > HEARTBEAT_TIMEOUT_MS ? 'offline' : data.status,
    });
  }
  res.json(list);
});

// ── WebSocket ─────────────────────────────────────────────────────────────
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const ws of wss.clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', message: 'Agent Flow WebSocket connected' }));
  // Send current agents & tasks on connect
  const now = Date.now();
  const agentList = [];
  for (const [name, data] of agents) {
    const elapsed = now - data.lastSeen;
    agentList.push({
      ...data,
      status: elapsed > HEARTBEAT_TIMEOUT_MS ? 'offline' : data.status,
    });
  }
  ws.send(JSON.stringify({ type: 'agents:sync', agents: agentList }));
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  ws.send(JSON.stringify({ type: 'tasks:sync', tasks }));
});

// Periodic agent cleanup
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [name, data] of agents) {
    if (now - data.lastSeen > HEARTBEAT_TIMEOUT_MS && data.status !== 'offline') {
      data.status = 'offline';
      changed = true;
      broadcast({ type: 'agent:offline', agent: { name, status: 'offline' } });
    }
  }
}, 30_000);

// ── Start ─────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🚀 Agent Flow rodando em http://localhost:${PORT}`);
  console.log(`🔑 Auth token: ${AUTH_TOKEN}`);
  console.log(`📡 WebSocket ativo em ws://localhost:${PORT}`);
});
