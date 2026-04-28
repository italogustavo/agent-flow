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
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = 32000'); // 32MB
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');
db.pragma('mmap_size = 268435456'); // 256MB memory map

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'backlog'
      CHECK(status IN ('backlog','assigned','in_progress','review','waiting_approval','done','rejected')),
    assigned_to TEXT DEFAULT NULL,
    priority TEXT NOT NULL DEFAULT 'medium'
      CHECK(priority IN ('low','medium','high','critical')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    due_date TEXT DEFAULT NULL,
    sla_hours REAL DEFAULT NULL,
    template_id TEXT DEFAULT NULL
  );


  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author TEXT NOT NULL DEFAULT 'system',
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id);

  CREATE TABLE IF NOT EXISTS agent_thoughts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    thinking TEXT NOT NULL,
    task_id TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS agent_token_usage (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    model TEXT DEFAULT 'deepseek/deepseek-chat',
    cost REAL DEFAULT 0,
    task_id TEXT DEFAULT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_thoughts_name ON agent_thoughts(name);
  CREATE TABLE IF NOT EXISTS agent_messages (
    id TEXT PRIMARY KEY,
    from_agent TEXT NOT NULL,
    to_agent TEXT DEFAULT NULL,
    task_id TEXT DEFAULT NULL,
    type TEXT NOT NULL DEFAULT 'chat'
      CHECK(type IN ('chat','mention','system','request','response')),
    subject TEXT DEFAULT NULL,
    body TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_from ON agent_messages(from_agent);
  CREATE INDEX IF NOT EXISTS idx_messages_to ON agent_messages(to_agent);
  CREATE INDEX IF NOT EXISTS idx_messages_task ON agent_messages(task_id);

  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_token_usage_name ON agent_token_usage(name);

  CREATE TABLE IF NOT EXISTS status_history (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    from_status TEXT DEFAULT NULL,
    to_status TEXT NOT NULL,
    changed_by TEXT DEFAULT 'system',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_history_task ON status_history(task_id);

  CREATE TABLE IF NOT EXISTS task_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    default_title TEXT NOT NULL,
    default_description TEXT DEFAULT '',
    category TEXT NOT NULL DEFAULT 'geral'
      CHECK(category IN ('geral','frontend','backend','devops','design','qa','bug','refactor')),
    checklist TEXT DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Safe migrations
try { db.exec('ALTER TABLE tasks ADD COLUMN approval TEXT DEFAULT NULL'); } catch(e) {}
try { db.exec('ALTER TABLE tasks ADD COLUMN approval_question TEXT DEFAULT NULL'); } catch(e) {}
try { db.exec('ALTER TABLE tasks ADD COLUMN due_date TEXT DEFAULT NULL'); } catch(e) {}
try { db.exec('ALTER TABLE tasks ADD COLUMN sla_hours REAL DEFAULT NULL'); } catch(e) {}
try { db.exec('ALTER TABLE tasks ADD COLUMN template_id TEXT DEFAULT NULL'); } catch(e) {}
try { db.exec('ALTER TABLE tasks ADD COLUMN assigned_agents TEXT DEFAULT NULL'); } catch(e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS task_dependencies (
    parent_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    child_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(parent_id, child_id)
  );
  CREATE INDEX IF NOT EXISTS idx_dep_parent ON task_dependencies(parent_id);
  CREATE INDEX IF NOT EXISTS idx_dep_child ON task_dependencies(child_id);
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

// Seed task templates
const tplCount = db.prepare('SELECT COUNT(*) as cnt FROM task_templates').get();
if (tplCount.cnt === 0) {
  const tplInsert = db.prepare(
    'INSERT INTO task_templates (id, name, description, default_title, default_description, category, checklist) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const templates = [
    ['Implementar componente', 'Criar um componente React funcional', 'Implementar [Componente]', 'Criar o componente [Nome] com suporte a props, estados e eventos. Seguir guia de estilo do projeto.', 'frontend', JSON.stringify(['Criar arquivo do componente', 'Adicionar props/interface', 'Implementar renderização', 'Adicionar testes'])],
    ['Corrigir bug', 'Template para correção de bugs', 'Corrigir bug em [Funcionalidade]', 'Descrever o bug: o que acontece, onde ocorre, como reproduzir.', 'bug', JSON.stringify(['Reproduzir o bug', 'Identificar causa raiz', 'Implementar correção', 'Testar cenário de falha'])],
    ['Endpoint API', 'Criar endpoint REST no backend', 'Criar endpoint [recurso]', 'Implementar CRUD para [recurso] seguindo padrão REST.', 'backend', JSON.stringify(['Definir rotas', 'Criar controller', 'Validar dados', 'Escrever testes'])],
    ['Query SQL / Relatório', 'Criar query ou relatório SQL', 'Criar relatório [nome]', 'Construir query SQL para dashboard/relatório conforme especificação.', 'backend', JSON.stringify(['Entender os dados necessários', 'Escrever query', 'Otimizar índices', 'Testar com dados reais'])],
    ['Tarefa DevOps', 'Infraestrutura, deploy, CI/CD', 'Configurar [infra/tool]', 'Implementar/configurar ferramenta de infraestrutura/deploy.', 'devops', JSON.stringify(['Planejar execução', 'Configurar ambiente', 'Testar funcionamento', 'Documentar'])],
    ['Melhoria UX', 'Ajuste de layout, design ou usabilidade', 'Melhorar UX de [tela]', 'Ajustar layout, cores, espaçamentos e fluxos para melhor usabilidade.', 'design', JSON.stringify(['Identificar problema de UX', 'Propor solução visual', 'Implementar alterações', 'Verificar responsividade'])],
    ['Refatorar código', 'Melhorar código existente sem mudar comportamento', 'Refatorar [módulo]', 'Melhorar estrutura, legibilidade e performance do código existente.', 'refactor', JSON.stringify(['Mapear código atual', 'Identificar pontos de melhoria', 'Aplicar refatoração', 'Garantir que testes passam'])],
    ['Testes / QA', 'Template para tarefas de teste', 'Testar [funcionalidade]', 'Cobrir cenários de teste, incluindo borda, erro e fluxo feliz.', 'qa', JSON.stringify(['Planejar casos de teste', 'Executar testes manuais/automáticos', 'Documentar resultados', 'Aprovar ou rejeitar'])]
  ];
  const tplTx = db.transaction(() => {
    for (const [name, desc, title, body, cat, checklist] of templates) {
      tplInsert.run(uuidv4(), name, desc, title, body, cat, checklist);
    }
  });
  tplTx();
}

// ── Cache ─────────────────────────────────────────────────────────────────
const taskCache = { tasks: null, timestamp: 0, ttl: 2000 };
const agentHeartbeatBuffer = new Map(); // flush a cada 5s

function getTasksCached(query) {
  const now = Date.now();
  if (now - taskCache.timestamp < taskCache.ttl && taskCache.tasks && !query.status && !query.assigned_to) {
    return taskCache.tasks;
  }
  let sql = 'SELECT t.*, (SELECT COUNT(*) FROM task_dependencies d JOIN tasks p ON p.id = d.parent_id WHERE d.child_id = t.id AND p.status NOT IN (\'done\',\'rejected\')) AS blocked_count FROM tasks t';
  const params = [];
  const clauses = [];
  if (query.status) { clauses.push('t.status = ?'); params.push(query.status); }
  if (query.assigned_to) { clauses.push('t.assigned_to = ?'); params.push(query.assigned_to); }
  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY t.created_at DESC';
  const tasks = db.prepare(sql).all(...params);
  // Parse assigned_agents for each task
  for (const t of tasks) {
    t.assigned_agents = t.assigned_agents ? JSON.parse(t.assigned_agents) : [];
  }
  if (!query.status && !query.assigned_to) {
    taskCache.tasks = tasks;
    taskCache.timestamp = now;
  }
  return tasks;
}

function invalidateTaskCache() { taskCache.timestamp = 0; }

// Heartbeat flush a cada 5s (bufferiza pensamentos no banco)
setInterval(() => {
  if (agentHeartbeatBuffer.size === 0) return;
  const insert = db.prepare('INSERT OR IGNORE INTO agent_thoughts (id, name, thinking, task_id) VALUES (?, ?, ?, ?)');
  const tx = db.transaction(() => {
    for (const [key, val] of agentHeartbeatBuffer) {
      insert.run(uuidv4(), val.name, val.thinking, val.taskId || null);
    }
  });
  try { tx(); agentHeartbeatBuffer.clear(); } catch(e) { /* ignore write errors */ }
}, 5000);

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
  const tasks = getTasksCached({ status, assigned_to });
  res.json(tasks);
});

// POST /api/tasks
app.post('/api/tasks', auth, (req, res) => {
  const { title, description, assigned_to, priority, assigned_agents, dependencies } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const id = uuidv4();
  const agentsJson = assigned_agents && Array.isArray(assigned_agents) ? JSON.stringify(assigned_agents) : null;
  db.prepare(
    'INSERT INTO tasks (id, title, description, status, assigned_to, priority, assigned_agents) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title, description || '', 'backlog', assigned_to || null, priority || 'medium', agentsJson);
  // Register dependencies
  if (dependencies && Array.isArray(dependencies)) {
    const depInsert = db.prepare('INSERT OR IGNORE INTO task_dependencies (parent_id, child_id) VALUES (?, ?)');
    for (const parentId of dependencies) {
      depInsert.run(parentId, id);
    }
  }
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  invalidateTaskCache();
  broadcast({ type: 'task:created', task });
  res.status(201).json(task);
});

// GET /api/tasks/:id
app.get('/api/tasks/:id', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const comments = db.prepare('SELECT * FROM comments WHERE task_id = ? ORDER BY created_at').all(req.params.id);
  const history = db.prepare('SELECT * FROM status_history WHERE task_id = ? ORDER BY created_at DESC LIMIT 50').all(req.params.id);
  // Resolve dependencies
  const blocking = db.prepare(`
    SELECT t.id, t.title, t.status FROM task_dependencies d
    JOIN tasks t ON t.id = d.child_id
    WHERE d.parent_id = ? AND t.status NOT IN ('done', 'rejected')`).all(req.params.id);
  const blockedBy = db.prepare(`
    SELECT t.id, t.title, t.status FROM task_dependencies d
    JOIN tasks t ON t.id = d.parent_id
    WHERE d.child_id = ?`).all(req.params.id);
  const parsedAgents = task.assigned_agents ? JSON.parse(task.assigned_agents) : [];
  res.json({ ...task, assigned_agents: parsedAgents, blocking, blockedBy, comments, history });
});

// GET /api/tasks/:id/history
app.get('/api/tasks/:id/history', auth, (req, res) => {
  const history = db.prepare('SELECT * FROM status_history WHERE task_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(history);
});

// GET /api/templates
app.get('/api/templates', auth, (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM task_templates';
  const params = [];
  if (category) { sql += ' WHERE category = ?'; params.push(category); }
  sql += ' ORDER BY category, name';
  res.json(db.prepare(sql).all(...params));
});

// POST /api/tasks/from-template — criar task a partir de template
app.post('/api/tasks/from-template', auth, (req, res) => {
  const { templateId, title, assigned_to, priority, due_date } = req.body;
  if (!templateId) return res.status(400).json({ error: 'templateId is required' });
  const template = db.prepare('SELECT * FROM task_templates WHERE id = ?').get(templateId);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  const id = uuidv4();
  const finalTitle = title || template.default_title.replace(/\[.*?\]/g, '').trim();
  db.prepare(
    'INSERT INTO tasks (id, title, description, status, assigned_to, priority, template_id, due_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, finalTitle, template.default_description, 'backlog', assigned_to || null, priority || 'medium', templateId, due_date || null);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  invalidateTaskCache();
  broadcast({ type: 'task:created', task });
  res.status(201).json(task);
});

// GET /api/overdue — tasks atrasadas (SLA)
app.get('/api/overdue', auth, (req, res) => {
  const tasks = db.prepare(`
    SELECT * FROM tasks
    WHERE status NOT IN ('done', 'rejected')
      AND (
        (due_date IS NOT NULL AND due_date < datetime('now'))
        OR
        (sla_hours IS NOT NULL AND datetime(created_at, '+' || sla_hours || ' hours') < datetime('now'))
      )
    ORDER BY due_date ASC, created_at ASC
  `).all();
  res.json(tasks);
});

// PATCH /api/tasks/:id
app.patch('/api/tasks/:id', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const allowed = ['title', 'description', 'status', 'assigned_to', 'priority', 'approval', 'approval_question', 'due_date', 'sla_hours', 'template_id'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      sets.push(`${key} = ?`);
      params.push(req.body[key]);
    }
  }
  // Handle assigned_agents (JSON array -> string)
  if (req.body.assigned_agents !== undefined) {
    sets.push('assigned_agents = ?');
    params.push(Array.isArray(req.body.assigned_agents) ? JSON.stringify(req.body.assigned_agents) : null);
  }
  // Handle dependencies
  if (req.body.dependencies !== undefined && Array.isArray(req.body.dependencies)) {
    db.prepare('DELETE FROM task_dependencies WHERE child_id = ?').run(req.params.id);
    const depInsert = db.prepare('INSERT OR IGNORE INTO task_dependencies (parent_id, child_id) VALUES (?, ?)');
    for (const parentId of req.body.dependencies) {
      depInsert.run(parentId, req.params.id);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No fields to update' });

  // Auto-register status change in history
  if (req.body.status && req.body.status !== task.status) {
    db.prepare(
      'INSERT INTO status_history (id, task_id, from_status, to_status, changed_by) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), req.params.id, task.status, req.body.status, req.body.changed_by || 'system');
  }

  sets.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  invalidateTaskCache();
  broadcast({ type: 'task:updated', task: updated, changes: req.body });
  res.json(updated);
});

// DELETE /api/tasks/:id
app.delete('/api/tasks/:id', auth, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  invalidateTaskCache();
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
  const { name, status, taskId, thinking } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  // accept heartbeat without auth so agents can ping easily
  const data = {
    name,
    lastSeen: Date.now(),
    status: status || 'online',
  };
  if (taskId) data.taskId = taskId;
  if (thinking) data.thinking = thinking;
  agents.set(name, data);
  broadcast({ type: 'agent:heartbeat', agent: data });
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

// ── Agent Chat / Messages ──────────────────────────────────────────────────

// POST /api/agents/messages — Send a message to another agent
app.post('/api/agents/messages', auth, (req, res) => {
  const { from, to, taskId, type, subject, body } = req.body;
  if (!from || !body) return res.status(400).json({ error: 'from and body are required' });
  if (!to && !taskId) return res.status(400).json({ error: 'to (agent) or taskId is required' });

  const id = uuidv4();
  const msgType = type || (to ? 'chat' : 'request');

  db.prepare(
    'INSERT INTO agent_messages (id, from_agent, to_agent, task_id, type, subject, body) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, from, to || null, taskId || null, msgType, subject || null, body);

  const message = db.prepare('SELECT * FROM agent_messages WHERE id = ?').get(id);

  // Update agent thinking if it sent a message
  const senderData = agents.get(from);
  if (senderData) {
    senderData.lastSeen = Date.now();
    agents.set(from, senderData);
  }

  broadcast({
    type: 'agent:message',
    message: { id, from, to, taskId: taskId || null, type: msgType, subject: subject || null, body, created_at: message.created_at }
  });

  // Also add as comment on the task if taskId provided
  if (taskId) {
    const taskExists = db.prepare('SELECT id FROM tasks WHERE id = ?').get(taskId);
    if (taskExists) {
      const bodyWithMention = to ? `${from} → ${to}: ${body}` : `${from}: ${body}`;
      db.prepare('INSERT INTO comments (id, task_id, author, body) VALUES (?, ?, ?, ?)').run(
        uuidv4(), taskId, from, bodyWithMention
      );
    }
  }

  res.status(201).json(message);
});

// GET /api/agents/messages — Get messages (filterable)
app.get('/api/agents/messages', auth, (req, res) => {
  const { from, to, taskId, limit, unread } = req.query;
  let sql = 'SELECT * FROM agent_messages';
  const clauses = [];
  const params = [];

  if (from) { clauses.push('from_agent = ?'); params.push(from); }
  if (to) { clauses.push('to_agent = ?'); params.push(to); }
  if (taskId) { clauses.push('task_id = ?'); params.push(taskId); }
  if (unread === 'true') { clauses.push('read = 0'); }

  if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
  sql += ' ORDER BY created_at DESC';
  const limitNum = parseInt(limit);
  if (limit && !isNaN(limitNum) && limitNum > 0) { sql += ' LIMIT ?'; params.push(limitNum); } else { sql += ' LIMIT 50'; }

  res.json(db.prepare(sql).all(...params));
});

// PATCH /api/agents/messages/:id/read — Mark message as read
app.patch('/api/agents/messages/:id/read', auth, (req, res) => {
  db.prepare('UPDATE agent_messages SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/agents/messages/conversation/:agent1/:agent2 — Full conversation
app.get('/api/agents/messages/conversation/:agent1/:agent2', auth, (req, res) => {
  const msgs = db.prepare(`
    SELECT * FROM agent_messages
    WHERE (from_agent = ? AND to_agent = ?)
       OR (from_agent = ? AND to_agent = ?)
    ORDER BY created_at ASC
  `).all(req.params.agent1, req.params.agent2, req.params.agent2, req.params.agent1);
  res.json(msgs);
});

// GET /api/agents/messages/unread-count — Count of unread messages per agent
app.get('/api/agents/messages/unread-count', auth, (req, res) => {
  const counts = db.prepare(`
    SELECT to_agent as agent, COUNT(*) as count
    FROM agent_messages
    WHERE read = 0 AND to_agent IS NOT NULL
    GROUP BY to_agent
  `).all();
  res.json(counts);
});

// ── Agent Thinking ────────────────────────────────────────────────────────

// POST /api/agents/thinking — Register agent thinking
app.post('/api/agents/thinking', (req, res) => {
  const { name, thinking, taskId } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!thinking) return res.status(400).json({ error: 'thinking is required' });

  // Bufferizar no heartbeat buffer (flush a cada 5s)
  agentHeartbeatBuffer.set('think:' + name + ':' + Date.now(), {
    name, thinking, taskId: taskId || null
  });

  // Update agent in-memory with thinking
  const agentData = agents.get(name);
  if (agentData) {
    agentData.thinking = thinking;
    agentData.taskId = taskId || agentData.taskId;
    agentData.lastSeen = Date.now();
    agents.set(name, agentData);
  }

  const payload = { name, thinking, taskId: taskId || null, timestamp: new Date().toISOString() };
  broadcast({ type: 'agent:thinking', agent: payload });
  res.status(201).json({ ok: true });
});

// GET /api/agents/thinking — Get current thinking of each agent
app.get('/api/agents/thinking', auth, (req, res) => {
  const thoughts = db.prepare(`
    SELECT a.* FROM agent_thoughts a
    INNER JOIN (
      SELECT name, MAX(created_at) as max_created
      FROM agent_thoughts GROUP BY name
    ) b ON a.name = b.name AND a.created_at = b.max_created
  `).all();
  res.json(thoughts);
});

// GET /api/agents/thinking/history?name=X — Full history by agent
app.get('/api/agents/thinking/history', auth, (req, res) => {
  const { name, limit } = req.query;
  let sql = 'SELECT * FROM agent_thoughts';
  const params = [];
  if (name) { sql += ' WHERE name = ?'; params.push(name); }
  sql += ' ORDER BY created_at DESC';
  if (limit) { sql += ' LIMIT ?'; params.push(parseInt(limit)); }
  res.json(db.prepare(sql).all(...params));
});

// ── Agent Token Usage ─────────────────────────────────────────────────────

// POST /api/agents/tokens — Register token usage
app.post('/api/agents/tokens', (req, res) => {
  const { name, tokensIn, tokensOut, model, taskId, cost } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = uuidv4();
  const ti = parseInt(tokensIn) || 0;
  const to = parseInt(tokensOut) || 0;
  const mdl = model || 'deepseek/deepseek-chat';

  let c = parseFloat(cost) || 0;
  if (!cost) {
    c = (ti / 1_000_000) * 0.27 + (to / 1_000_000) * 1.10;
  }

  db.prepare(
    'INSERT INTO agent_token_usage (id, name, tokens_in, tokens_out, model, cost, task_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, ti, to, mdl, c, taskId || null);

  broadcast({ type: 'agent:tokens', usage: { name, tokensIn: ti, tokensOut: to, model: mdl, cost: c, taskId: taskId || null } });
  res.status(201).json({ ok: true, id, cost: c });
});

// GET /api/agents/tokens — Tokens by agent
app.get('/api/agents/tokens', auth, (req, res) => {
  const { name } = req.query;
  let sql = 'SELECT * FROM agent_token_usage';
  const params = [];
  if (name) { sql += ' WHERE name = ?'; params.push(name); }
  sql += ' ORDER BY created_at DESC';
  if (!name) sql += ' LIMIT 100';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/agents/tokens/summary — Overall summary
app.get('/api/agents/tokens/summary', auth, (req, res) => {
  const byAgent = db.prepare(`
    SELECT
      name,
      SUM(tokens_in) as total_tokens_in,
      SUM(tokens_out) as total_tokens_out,
      SUM(tokens_in + tokens_out) as total_tokens,
      SUM(cost) as total_cost,
      COUNT(*) as usage_count
    FROM agent_token_usage
    GROUP BY name
    ORDER BY total_cost DESC
  `).all();

  const grandTotal = db.prepare(`
    SELECT
      SUM(tokens_in) as total_tokens_in,
      SUM(tokens_out) as total_tokens_out,
      SUM(tokens_in + tokens_out) as total_tokens,
      SUM(cost) as total_cost,
      COUNT(*) as usage_count
    FROM agent_token_usage
  `).get();

  res.json({ byAgent, grandTotal });
});

// ── API de Dependências ────────────────────────────────────────────────────

// POST /api/tasks/:id/dependencies — adicionar dependencia
app.post('/api/tasks/:id/dependencies', auth, (req, res) => {
  const { parent_id } = req.body;
  if (!parent_id) return res.status(400).json({ error: 'parent_id is required' });
  if (parent_id === req.params.id) return res.status(400).json({ error: 'A task cannot depend on itself' });
  // Check both exist
  const child = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
  const parent = db.prepare('SELECT id FROM tasks WHERE id = ?').get(parent_id);
  if (!child || !parent) return res.status(404).json({ error: 'Task not found' });
  db.prepare('INSERT OR IGNORE INTO task_dependencies (parent_id, child_id) VALUES (?, ?)').run(parent_id, req.params.id);
  invalidateTaskCache();
  res.json({ ok: true });
});

// DELETE /api/tasks/:id/dependencies/:parentId — remover dependencia
app.delete('/api/tasks/:id/dependencies/:parentId', auth, (req, res) => {
  db.prepare('DELETE FROM task_dependencies WHERE child_id = ? AND parent_id = ?').run(req.params.id, req.params.parentId);
  invalidateTaskCache();
  res.json({ ok: true });
});

// ── Dashboard de Produtividade ────────────────────────────────────────────
app.get('/api/dashboard', auth, (req, res) => {
  const { days } = req.query;
  const lookback = Math.max(1, parseInt(days) || 7);
  const since = new Date(Date.now() - lookback * 86400_000).toISOString();

  // Tasks concluídas por agente (período)
  const doneByAgent = db.prepare(`
    SELECT assigned_to as name, COUNT(*) as total
    FROM tasks WHERE status = 'done' AND updated_at >= ? AND assigned_to IS NOT NULL
    GROUP BY assigned_to ORDER BY total DESC
  `).all(since);

  // Tasks por status (contagem geral)
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as total FROM tasks GROUP BY status
  `).all();

  // Tempo médio entre created_at e done (horas)
  const avgTime = db.prepare(`
    SELECT
      assigned_to as name,
      ROUND(AVG(
        (julianday(updated_at) - julianday(created_at)) * 24
      ), 1) as avg_hours
    FROM tasks WHERE status = 'done' AND assigned_to IS NOT NULL
      AND updated_at >= ?
    GROUP BY assigned_to
  `).all(since);

  // Tokens por agente (período)
  const tokensByAgent = db.prepare(`
    SELECT
      name,
      SUM(tokens_in) as tokens_in_total,
      SUM(tokens_out) as tokens_out_total,
      SUM(cost) as cost_total,
      COUNT(*) as usage_count
    FROM agent_token_usage
    WHERE created_at >= ?
    GROUP BY name ORDER BY cost_total DESC
  `).all(since);

  // Tasks por dia (últimos 7 dias)
  const byDay = db.prepare(`
    SELECT DATE(updated_at) as day, COUNT(*) as total
    FROM tasks WHERE status = 'done' AND updated_at >= ?
    GROUP BY DATE(updated_at) ORDER BY day ASC
  `).all(since);

  // Tasks por prioridade
  const byPriority = db.prepare(`
    SELECT priority, COUNT(*) as total FROM tasks GROUP BY priority
  `).all();

  // Total geral de tasks
  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN status IN ('backlog','assigned') THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
    FROM tasks
  `).get();

  // Heartbeat ativo dos agentes (online agora)
  const now = Date.now();
  const agentList = [];
  for (const [name, data] of agents) {
    const elapsed = now - data.lastSeen;
    const active = elapsed <= HEARTBEAT_TIMEOUT_MS && data.status !== 'offline';
    agentList.push({ name, status: active ? data.status : 'offline', lastSeen: data.lastSeen });
  }

  res.json({
    period: { days: lookback, since },
    totals,
    byStatus,
    byPriority,
    doneByAgent,
    avgTime,
    tokensByAgent,
    byDay,
    activeAgents: agentList.filter(a => a.status !== 'offline'),
  });
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
