// agent-flow/public/app.js — Frontend Kanban + WebSocket em tempo real
const API = window.location.origin;
const TOKEN = 'agent-5678';
const headers = { 'Content-Type': 'application/json', 'x-auth-token': TOKEN };

// ── State ─────────────────────────────────────────────────────────────────
let tasks = [];
let agents = [];
let ws = null;
let logMessages = [];

// ── WebSocket ──────────────────────────────────────────────────────────────
function connectWS() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);

  ws.onopen = () => { addLog('Conectado ao Agent Flow ✅'); };

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    switch (data.type) {
      case 'connected':
        break;
      case 'tasks:sync':
        tasks = data.tasks;
        render();
        break;
      case 'agents:sync':
        agents = data.agents;
        renderAgents();
        break;
      case 'task:created':
        tasks.unshift(data.task);
        addLog(`📋 Nova tarefa criada: "${data.task.title}"`);
        render();
        break;
      case 'task:updated':
        const idx = tasks.findIndex(t => t.id === data.task.id);
        if (idx >= 0) {
          const oldStatus = tasks[idx].status;
          tasks[idx] = data.task;
          if (oldStatus !== data.task.status) {
            addLog(`🔄 "${data.task.title}" → ${statusLabel(data.task.status)}`);
          }
        } else {
          tasks.unshift(data.task);
        }
        render();
        break;
      case 'task:deleted':
        tasks = tasks.filter(t => t.id !== data.taskId);
        addLog(`🗑️ Tarefa removida`);
        render();
        break;
      case 'task:comment':
        addLog(`💬 Comentário em task ${data.taskId.slice(0,8)}: "${data.comment.body.slice(0,40)}..."`);
        break;
      case 'agent:heartbeat':
        const a = agents.findIndex(a => a.name === data.agent.name);
        if (a >= 0) agents[a] = data.agent;
        else agents.push(data.agent);
        addLog(`📡 ${data.agent.name} — ${data.agent.status}`);
        renderAgents();
        break;
      case 'agent:offline':
        const a2 = agents.findIndex(a => a.name === data.agent.name);
        if (a2 >= 0) agents[a2].status = 'offline';
        addLog(`⚠️ ${data.agent.name} ficou offline`);
        renderAgents();
        break;
    }
  };

  ws.onclose = () => {
    addLog('❌ Desconectado. Reconectando em 3s...');
    setTimeout(connectWS, 3000);
  };
  ws.onerror = () => { ws.close(); };
}

// ── API ────────────────────────────────────────────────────────────────────
async function api(url, opts = {}) {
  const res = await fetch(API + url, { headers, ...opts });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────
function statusLabel(s) {
  return { backlog:'Backlog', assigned:'Atribuída', in_progress:'Em Andamento', review:'Revisão', done:'Concluída', rejected:'Rejeitada' }[s] || s;
}
function statusEmoji(s) {
  return { backlog:'📋', assigned:'👤', in_progress:'⚡', review:'🔍', done:'✅', rejected:'❌' }[s] || '❓';
}
function priorityLabel(p) {
  return { low:'🟢 Baixa', medium:'🟡 Média', high:'🔴 Alta', critical:'🔥 Crítica' }[p] || p;
}
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso + 'Z').getTime())/1000);
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s/60)}min`;
  return `${Math.floor(s/3600)}h`;
}

// ── Agent Status Bar ───────────────────────────────────────────────────────
function renderAgents() {
  const el = document.getElementById('agents-status');
  const names = ['PO 🧑‍💼','Nina 🐱','Bento 🦊','Luna 🦄','Teco 🐶','Dock 🐳'];
  let html = '';
  let totalOnline = 0;
  for (const name of names) {
    const agent = agents.find(a => a.name === name);
    const status = agent ? agent.status : 'offline';
    const dotClass = status === 'online' ? 'online' : status === 'busy' ? 'busy' : 'offline';
    if (status === 'online' || status === 'busy') totalOnline++;
    html += `<span class="agent-chip"><span class="dot ${dotClass}"></span>${name}`;
    if (agent && agent.thinking) html += `<span class="thinking">${agent.thinking}</span>`;
    html += `</span>`;
  }
  el.innerHTML = html;
}

// ── Log ────────────────────────────────────────────────────────────────────
function addLog(msg) {
  const el = document.getElementById('log-messages');
  const span = document.createElement('span');
  span.className = 'log-msg';
  const time = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  span.textContent = `[${time}] ${msg}`;
  el.appendChild(span);
  if (el.children.length > 30) el.removeChild(el.firstChild);
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  for (const status of ['backlog','assigned','in_progress','review','done','rejected']) {
    const col = document.getElementById(`col-${status}`);
    const count = document.getElementById(`count-${status}`);
    const filtered = tasks.filter(t => t.status === status);
    count.textContent = filtered.length;
    col.innerHTML = filtered.map(t => renderCard(t)).join('');
  }
}

function renderCard(task) {
  const pClass = `priority-${task.priority}`;
  const statusClass = `status-${task.status.replace('_','-')}`;
  return `<div class="card" onclick="openModal('${task.id}')">
    <div class="card-title">${task.title}</div>
    <div class="card-meta">
      ${task.assigned_to ? `<span class="card-assignee">${task.assigned_to}</span>` : ''}
      <span class="card-priority ${pClass}">${priorityLabel(task.priority)}</span>
      <span>${timeAgo(task.updated_at)}</span>
    </div>
  </div>`;
}

// ── Modal ──────────────────────────────────────────────────────────────────
async function openModal(id) {
  const overlay = document.getElementById('modal-overlay');
  const title = document.getElementById('modal-title');
  const body = document.getElementById('modal-body');

  try {
    const task = await api(`/api/tasks/${id}`);
    const statusClass = `status-${task.status.replace('_','-')}`;
    const pClass = `priority-${task.priority}`;

    title.textContent = `${statusEmoji(task.status)} ${task.title}`;

    let html = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <span class="status-pill ${statusClass}">${statusLabel(task.status)}</span>
        <span class="card-priority ${pClass}">${priorityLabel(task.priority)}</span>
        ${task.assigned_to ? `<span class="card-assignee">${task.assigned_to}</span>` : ''}
      </div>
      ${task.description ? `<p style="font-size:14px;color:var(--text2);margin-bottom:12px">${task.description}</p>` : ''}
      <p style="font-size:11px;color:var(--text2);margin-bottom:12px">Criada ${timeAgo(task.created_at)} | Atualizada ${timeAgo(task.updated_at)}</p>

      <label>Status</label>
      <select onchange="updateStatus('${task.id}', this.value)" style="margin-bottom:12px">
        <option value="backlog" ${task.status==='backlog'?'selected':''}>📋 Backlog</option>
        <option value="assigned" ${task.status==='assigned'?'selected':''}>👤 Atribuída</option>
        <option value="in_progress" ${task.status==='in_progress'?'selected':''}>⚡ Em Andamento</option>
        <option value="review" ${task.status==='review'?'selected':''}>🔍 Revisão</option>
        <option value="done" ${task.status==='done'?'selected':''}>✅ Concluída</option>
        <option value="rejected" ${task.status==='rejected'?'selected':''}>❌ Rejeitada</option>
      </select>

      <label>Responsável</label>
      <select onchange="updateAssignee('${task.id}', this.value)" style="margin-bottom:12px">
        <option value="">—</option>
        <option value="PO 🧑‍💼" ${task.assigned_to==='PO 🧑‍💼'?'selected':''}>PO 🧑‍💼</option>
        <option value="Nina 🐱" ${task.assigned_to==='Nina 🐱'?'selected':''}>Nina 🐱</option>
        <option value="Bento 🦊" ${task.assigned_to==='Bento 🦊'?'selected':''}>Bento 🦊</option>
        <option value="Luna 🦄" ${task.assigned_to==='Luna 🦄'?'selected':''}>Luna 🦄</option>
        <option value="Teco 🐶" ${task.assigned_to==='Teco 🐶'?'selected':''}>Teco 🐶</option>
        <option value="Dock 🐳" ${task.assigned_to==='Dock 🐳'?'selected':''}>Dock 🐳</option>
      </select>

      <hr style="border-color:var(--border);margin:12px 0">
      <label style="font-weight:600">💬 Comentários (${task.comments ? task.comments.length : 0})</label>
      <div id="comments-list">
        ${(task.comments || []).map(c => `
          <div class="comment">
            <span class="comment-author">${c.author}</span>
            <span class="comment-time">${timeAgo(c.created_at)}</span>
            <div class="comment-body">${c.body}</div>
          </div>
        `).join('') || '<p style="font-size:12px;color:var(--text2)">Nenhum comentário ainda.</p>'}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <input type="text" id="comment-input" placeholder="Escreva um comentário..." style="flex:1">
        <button class="btn" onclick="addComment('${task.id}')">Enviar</button>
      </div>
    `;

    body.innerHTML = html;
    overlay.classList.add('active');
  } catch(e) {
    alert('Erro ao carregar task: ' + e.message);
  }
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

async function updateStatus(id, status) {
  await api(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
}

async function updateAssignee(id, assigned_to) {
  await api(`/api/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ assigned_to: assigned_to || null })
  });
}

async function addComment(taskId) {
  const input = document.getElementById('comment-input');
  const body = input.value.trim();
  if (!body) return;
  input.value = '';
  await api(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ author: 'PO 🧑‍💼', body })
  });
  // Recarrega a modal
  openModal(taskId);
}

// ── New Task ───────────────────────────────────────────────────────────────
function showNewTaskModal() {
  document.getElementById('newtask-overlay').classList.add('active');
}
function closeNewTaskModal() {
  document.getElementById('newtask-overlay').classList.remove('active');
}

async function createTask(e) {
  e.preventDefault();
  const title = document.getElementById('nt-title').value.trim();
  if (!title) return;
  await api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: document.getElementById('nt-desc').value.trim(),
      assigned_to: document.getElementById('nt-assigned').value || null,
      priority: document.getElementById('nt-priority').value,
    })
  });
  document.getElementById('new-task-form').reset();
  closeNewTaskModal();
}

// ── Init ───────────────────────────────────────────────────────────────────
connectWS();
addLog('Agent Flow iniciado. Aguardando tarefas...');
