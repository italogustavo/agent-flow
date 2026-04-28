#!/usr/bin/env python3
import os

path = "/home/pcgustavo/.openclaw/workspace/agent-flow/public/index.html"

# Split into parts to avoid massive single string
parts = []

# Part 1: everything up to and including the approval-section div
part1 = '''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Flow - Centro de Comando</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #242738;
    --border: #2a2d3e;
    --text: #e4e6f0;
    --text-muted: #8b8fa3;
    --accent: #6c5ce7;
    --accent2: #a29bfe;
    --green: #00b894;
    --yellow: #fdcb6e;
    --red: #e17055;
    --blue: #74b9ff;
    --radius: 10px;
    --shadow: 0 4px 20px rgba(0,0,0,.4);
    --transition: all .2s ease;
  }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 14px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  header .brand { display: flex; align-items: center; gap: 10px; }
  header .brand h1 { font-size: 1.25rem; font-weight: 700; letter-spacing: -.02em; }
  header .brand h1 span { color: var(--accent2); }
  .header-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .conn-indicator {
    font-size: .75rem; padding: 4px 10px; border-radius: 20px;
    display: flex; align-items: center; gap: 5px; white-space: nowrap;
    background: var(--surface2); border: 1px solid var(--border);
  }
  .conn-indicator.connected { color: var(--green); border-color: var(--green); }
  .conn-indicator.disconnected { color: var(--red); border-color: var(--red); animation: pulse 1.5s ease-in-out infinite; }
  .conn-indicator.reconnecting { color: var(--yellow); border-color: var(--yellow); }
  .conn-indicator .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .conn-indicator.connected .dot { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .conn-indicator.disconnected .dot { background: var(--red); box-shadow: 0 0 6px var(--red); }
  .conn-indicator.reconnecting .dot { background: var(--yellow); box-shadow: 0 0 6px var(--yellow); }
  .btn {
    background: var(--accent);
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: .85rem;
    font-weight: 600;
    transition: var(--transition);
    display: inline-flex; align-items: center; gap: 6px;
    white-space: nowrap;
  }
  .btn:hover { background: #5a4bd1; transform: translateY(-1px); }
  .btn:active { transform: translateY(0); }
  .btn-sm { padding: 5px 12px; font-size: .8rem; }
  .btn-xs { padding: 3px 8px; font-size: .7rem; border-radius: 6px; }
  .btn-primary { background: var(--green); }
  .btn-primary:hover { background: #00a381; }
  .btn-danger { background: var(--red); }
  .btn-danger:hover { background: #c0392b; }
  .btn-outline {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text);
  }
  .btn-outline:hover { border-color: var(--accent); color: var(--accent2); }
  .btn .spinner {
    display: none; width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,.3);
    border-top-color: #fff;
    border-radius: 50%; animation: spin .6s linear infinite;
  }
  .btn.loading { pointer-events: none; opacity: .8; }
  .btn.loading .spinner { display: inline-block; }
  .btn.loading .btn-text { display: none; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; padding: 0 5px;
    border-radius: 10px; font-size: .65rem; font-weight: 700;
    background: var(--red); color: #fff;
  }
  .agent-bar {
    background: var(--surface2);
    padding: 8px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--border);
    font-size: .82rem;
    min-height: 42px;
  }
  .agent-bar-label { color: var(--text-muted); font-size: .75rem; white-space: nowrap; }
  .agent-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
    font-size: .78rem;
    transition: var(--transition);
    max-width: 220px;
  }
  .agent-item:hover { border-color: var(--accent); }
  .agent-item.busy { border-color: var(--yellow); }
  .agent-item.idle { border-color: var(--green); }
  .agent-item.offline { opacity: .5; }
  .agent-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .dot-online { background: var(--green); }
  .dot-away { background: var(--yellow); }
  .dot-offline { background: var(--text-muted); }
  .agent-name { font-weight: 600; white-space: nowrap; }
  .agent-thinking-dot { display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: var(--accent2); margin: 0 2px; }
  @keyframes thinkBounce { 0%,100%{opacity:1} 50%{transform:translateY(-3px)} }
  .agent-thinking-dot:nth-child(1) { animation: thinkBounce .6s ease-in-out infinite; }
  .agent-thinking-dot:nth-child(2) { animation: thinkBounce .6s ease-in-out infinite .15s; }
  .agent-thinking-dot:nth-child(3) { animation: thinkBounce .6s ease-in-out infinite .3s; }
  .agent-thinking-indicator { display: inline-flex; align-items: center; gap: 2px; }
  .agent-task-ref { font-size: .68rem; color: var(--accent2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 90px; }
  .live-feed {
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    padding: 0 20px;
    font-size: .78rem;
    color: var(--text-muted);
    height: 32px;
    display: flex;
    align-items: center;
    overflow: hidden;
    position: relative;
  }
  .feed-scroll { overflow: hidden; flex: 1; position: relative; height: 100%; }
  #feed-list { position: absolute; bottom: 0; left: 0; right: 0; display: flex; flex-direction: column-reverse; }
  .feed-item { padding: 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0; animation: feedIn .3s ease forwards; }
  @keyframes feedIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .board { display: flex; gap: 12px; padding: 14px 20px; flex: 1; overflow-x: auto; align-items: flex-start; }
  .column { min-width: 260px; max-width: 310px; flex: 1; background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); display: flex; flex-direction: column; max-height: calc(100vh - 180px); transition: border-color .2s; }
  .column.drag-over { border-color: var(--accent); box-shadow: 0 0 16px rgba(108,92,231,.2); }
  .column-header { padding: 12px 14px; font-weight: 700; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; flex-shrink: 0; }
  .column-header .count { background: var(--surface2); padding: 2px 9px; border-radius: 12px; font-size: .7rem; color: var(--text-muted); font-weight: 600; }
  .col-backlog .column-header { border-left: 3px solid var(--text-muted); }
  .col-assigned .column-header { border-left: 3px solid var(--blue); }
  .col-in_progress .column-header { border-left: 3px solid var(--yellow); }
  .col-review .column-header { border-left: 3px solid var(--accent2); }
  .col-done .column-header { border-left: 3px solid var(--green); }
  .col-rejected .column-header { border-left: 3px solid var(--red); }
  .col-waiting_approval .column-header { border-left: 3px solid var(--accent); }
  .column-body { padding: 6px; overflow-y: auto; flex: 1; min-height: 60px; transition: background .2s; }
  .column.drag-over .column-body { background: rgba(108,92,231,.06); }
  .card { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin-bottom: 6px; cursor: pointer; transition: var(--transition); position: relative; user-select: none; }
  .card:hover { border-color: var(--accent); transform: translateY(-1px); box-shadow: 0 3px 12px rgba(0,0,0,.3); }
  .card:active { transform: translateY(0); }
  .card[draggable="true"] { cursor: grab; }
  .card[draggable="true"]:active { cursor: grabbing; }
  .card.dragging { opacity: .4; transform: rotate(1deg) scale(.97); }
  .card .card-title { font-weight: 600; font-size: .85rem; margin-bottom: 5px; word-break: break-word; line-height: 1.3; }
  .card .card-meta { display: flex; justify-content: space-between; align-items: center; font-size: .72rem; color: var(--text-muted); gap: 6px; }
  .card .card-meta-left { display: flex; align-items: center; gap: 6px; overflow: hidden; }
  .card .card-agent { background: var(--surface); padding: 1px 7px; border-radius: 9px; color: var(--accent2); white-space: nowrap; font-size: .7rem; }
  .card .card-executing-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent2); animation: pulse 1s ease-in-out infinite; }
  .card .priority-badge { padding: 1px 7px; border-radius: 9px; font-size: .65rem; font-weight: 700; white-space: nowrap; }
  .prio-low { background: #2d4059; color: var(--blue); }
  .prio-medium { background: #3d3520; color: var(--yellow); }
  .prio-high { background: #3d2020; color: var(--red); }
  .prio-critical { background: #4a1515; color: #ff6b6b; animation: pulse 1.5s ease-in-out infinite; }
  .approval-pending-badge { display: inline-block; padding: 1px 6px; border-radius: 8px; background: var(--accent); color: #fff; font-size: .6rem; font-weight: 700; margin-left: 4px; }
  .empty-col { text-align: center; padding: 20px 10px; color: var(--text-muted); font-size: .75rem; line-height: 1.5; }
  .empty-col .empty-icon { font-size: 1.5rem; margin-bottom: 6px; }
  .empty-col .empty-hint { opacity: .6; font-size: .7rem; margin-top: 4px; }
  .new-task-form { background: var(--surface); border-bottom: 1px solid var(--border); padding: 14px 20px; display: none; gap: 10px; flex-wrap: wrap; align-items: end; }
  .new-task-form.active { display: flex; animation: slideDown .2s ease; }
  @keyframes slideDown { from { opacity: 0; max-height: 0; padding: 0 20px; } to { opacity: 1; max-height: 120px; padding: 14px 20px; } }
  .new-task-form .field { flex: 1; min-width: 140px; }
  .new-task-form label { display: block; font-size: .7rem; color: var(--text-muted); margin-bottom: 3px; text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
  .new-task-form .required::after { content: ' *'; color: var(--red); }
  .new-task-form input, .new-task-form select { width: 100%; padding: 7px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 7px; color: var(--text); font-size: .85rem; font-family: inherit; transition: var(--transition); }
  .new-task-form input:focus, .new-task-form select:focus { outline: none; border-color: var(--accent); }
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.65); backdrop-filter: blur(4px); z-index: 100; justify-content: center; align-items: center; animation: fadeIn .15s ease; }
  .modal-overlay.active { display: flex; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .modal-header h2 { font-size: 1.15rem; line-height: 1.3; flex: 1; }
  .btn-close { background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; padding: 0 4px; line-height: 1; transition: var(--transition); }
  .btn-close:hover { color: var(--text); }
  .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 24px 24px 20px; max-width: 580px; width: 92%; max-height: 85vh; overflow-y: auto; box-shadow: 0 10px 60px rgba(0,0,0,.6); animation: modalIn .2s ease; }
  @keyframes modalIn { from { opacity: 0; transform: translateY(20px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
  .modal-id { color: var(--text-muted); font-size: .75rem; margin-bottom: 14px; font-family: monospace; }
  .modal label { display: block; font-size: .75rem; font-weight: 600; margin-top: 12px; margin-bottom: 4px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
  .modal input, .modal select, .modal textarea { width: 100%; padding: 9px 11px; background: var(--bg); border: 1px solid var(--border); border-radius: 7px; color: var(--text); font-size: .85rem; font-family: inherit; transition: var(--transition); }
  .modal textarea { min-height: 70px; resize: vertical; }
  .modal input:focus, .modal select:focus, .modal textarea:focus { outline: none; border-color: var(--accent); }
  .modal .modal-actions { display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; flex-wrap: wrap; border-top: 1px solid var(--border); padding-top: 14px; }
  .modal .modal-status { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
  .modal .status-btn { padding: 5px 11px; border-radius: 16px; border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; font-size: .72rem; transition: var(--transition); }
  .modal .status-btn.active { border-color: var(--accent); background: var(--accent); color: #fff; }
  .modal .status-btn:hover { border-color: var(--accent); }
  .exec-section { margin-top: 10px; background: var(--surface2); border-radius: 8px; padding: 10px 12px; border-left: 3px solid var(--accent2); display: none; }
  .exec-section.visible { display: block; }
  .exec-section h3 { font-size: .8rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
  .exec-agent { margin-bottom: 4px; }
  .exec-agent:last-child { margin-bottom: 0; }
  .exec-agent-name { font-weight: 600; font-size: .8rem; }
  .exec-agent-thinking { font-size: .75rem; color: var(--accent2); margin-top: 2px; }
  .approval-section { margin-top: 10px; background: var(--surface2); border-radius: 8px; padding: 12px 14px; border: 2px solid var(--accent); display: none; animation: fadeIn .3s ease; }
  .approval-section.visible { display: block; }
  .approval-section h3 { font-size: .85rem; display: flex; align-items: center; gap: 6px; }
  .approval-question { font-size: .82rem; color: var(--text-muted); margin: 6px 0 10px; padding: 8px; background: var(--bg); border-radius: 6px; }
  .approval-actions { display: flex; gap: 8px; }
  .approval-actions .btn { flex: 1; justify-content: center; padding: 10px; font-size: .85rem; }
  .request-section { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); }
  .comments-section { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px; }
  .comments-section h3 { font-size: .82rem; margin-bottom: 8px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
  .comment { background: var(--bg); border-radius: 7px; padding: 8px 10px; margin-bottom: 6px; animation: feedIn .2s ease; }
  .comment .comment-meta { font-size: .7rem; color: var(--text-muted); margin-bottom: 3px; }
  .comment .comment-meta strong { color: var(--accent2); }
  .comment .comment-body { font-size: .8rem; }
  .comment-form { display: flex; gap: 6px; margin-top: 8px; }
  .comment-form input { flex: 1; padding: 7px 10px; border-radius: 7px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: .82rem; transition: var(--transition); }
  .comment-form input:focus { outline: none; border-color: var(--accent); }
  .comment-form input::placeholder { color: var(--text-muted); }
  .toast-container { position: fixed; bottom: 20px; right: 20px; z-index: 999; display: flex; flex-direction: column; gap: 6px; pointer-events: none; max-width: 380px; }
  .toast { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 10px 16px; font-size: .82rem; box-shadow: 0 6px 24px rgba(0,0,0,.5); pointer-events: auto; animation: toastIn .3s ease; display: flex; align-items: center; gap: 8px; }
  .toast.success { border-left: 3px solid var(--green); }
  .toast.error { border-left: 3px solid var(--red); }
  .toast.warning { border-left: 3px solid var(--yellow); }
  .toast.info { border-left: 3px solid var(--blue); }
  @keyframes toastIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
  .toast .toast-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1rem; padding: 0 2px; margin-left: auto; transition: var(--transition); }
  .toast .toast-close:hover { color: var(--text); }
  .report-table { width:100%; border-collapse:collapse; font-size:13px; }
  .report-table th,.report-table td { padding:7px 10px; text-align:left; border-bottom:1px solid var(--border); }
  .report-table th { color:var(--text-muted); font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
  .report-table tr:hover td { background:var(--surface2); }
  .report-table .total-row td { font-weight:700; border-top:2px solid var(--accent); }
  .modal-chat { max-width: 620px; height: 75vh; display: flex; flex-direction: column; }
  .modal-chat .modal-body { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .chat-messages { flex: 1; overflow-y: auto; padding: 10px; background: var(--bg); border-radius: 8px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 5px; }
  .chat-msg { background: var(--surface2); padding: 7px 10px; border-radius: 8px; border: 1px solid var(--border); animation: feedIn .2s ease; }
  .chat-msg.chat-mine { border-color: var(--accent); margin-left: 28px; background: rgba(108,92,231,.08); }
  .chat-msg:not(.chat-mine) { margin-right: 28px; }
  .chat-msg .msg-top { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
  .chat-msg-author { font-size: .7rem; font-weight: 600; color: var(--accent2); }
  .chat-msg-subject { font-size: .7rem; font-weight: 500; color: var(--yellow); }
  .chat-msg-body { font-size: .8rem; margin-top: 2px; line-height: 1.4; }
  .chat-msg-time { font-size: .65rem; color: var(--text-muted); margin-top: 2px; text-align: right; }
  .chat-input-area { display: flex; gap: 6px; align-items: center; }
  .chat-input-area input { flex: 1; padding: 7px 10px; border-radius: 7px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); font-size: .82rem; }
  .chat-input-area input:focus { outline: none; border-color: var(--accent); }
  .chat-input-area select { padding: 7px; border-radius: 7px; border: 1px solid var(--border); background: var(--surface2); color: var(--text); font-size: .82rem; }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
  @media (max-width: 768px) {
    .board { flex-direction: column; align-items: stretch; padding: 10px; }
    .column { max-width: none; min-width: 0; max-height: none; }
    header { flex-direction: column; align-items: stretch; }
    .header-controls { justify-content: flex-start; }
    .new-task-form .field { min-width: 100%; }
    .agent-item { max-width: 160px; }
  }
</style>
</head>
<body>
<header>
  <div class="brand">
    <h1>Agent <span>Flow</span></h1>
    <span class="conn-indicator connected" id="conn-indicator">
      <span class="dot"></span>
      <span id="conn-text">Conectado</span>
    </span>
  </div>
  <div class="header-controls">
    <button class="btn btn-primary btn-sm" onclick="showNewTaskForm()" id="btn-new-task">
      <span class="btn-text">+ Nova Tarefa</span>
    </button>
    <button class="btn btn-outline btn-sm" onclick="openReportModal()">Relatrio</button>
    <button class="btn btn-outline btn-sm" onclick="openAgentChat()" id="btn-chat" style="position:relative">
      Chat <span class="badge" id="chat-badge" style="display:none;position:absolute;top:-5px;right:-5px">0</span>
    </button>
    <button class="btn btn-outline btn-sm" onclick="refreshAll()">Sincronizar</button>
  </div>
</header>
<div class="agent-bar" id="agent-bar">
  <span class="agent-bar-label">Agentes:</span>
  <span id="agent-list" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">Nenhum agente ativo</span>
</div>
<div class="live-feed" id="live-feed">
  <span style="flex-shrink:0;margin-right:6px">Feed</span>
  <div class="feed-scroll" id="feed-scroll"><div id="feed-list"></div></div>
</div>
<div class="new-task-form" id="new-task-form">
  <div class="field">
    <label class="required">Ttulo</label>
    <input type="text" id="nt-title" placeholder="Ex: Criar endpoint de usurios" autofocus>
  </div>
  <div class="field" style="flex:1.5">
    <label>Descrio</label>
    <input type="text" id="nt-desc" placeholder="Resumo rpido (opcional)">
  </div>
  <div class="field" style="flex:0 0 130px">
    <label>Prioridade</label>
    <select id="nt-prio">
      <option value="low">Baixa</option>
      <option value="medium" selected>Mdia</option>
      <option value="high">Alta</option>
      <option value="critical">Crtica</option>
    </select>
  </div>
  <div class="field" style="flex:0 0 140px">
    <label>Responsvel</label>
    <select id="nt-agent"><option value="">Ninguém</option></select>
  </div>
  <button class="btn btn-primary" onclick="createTask()" id="btn-create-task" style="height:36px">
    <span class="spinner"></span><span class="btn-text">Criar</span>
  </button>
  <button class="btn btn-outline btn-sm" onclick="hideNewTaskForm()">Cancelar</button>
</div>
<div class="board" id="board">
  <div class="column col-backlog" data-status="backlog">
    <div class="column-header" onclick="showNewTaskForm()">Backlog <span class="count" id="count-backlog">0</span></div>
    <div class="column-body" id="col-backlog"></div>
  </div>
  <div class="column col-assigned" data-status="assigned">
    <div class="column-header">Atribudo <span class="count" id="count-assigned">0</span></div>
    <div class="column-body" id="col-assigned"></div>
  </div>
  <div class="column col-in_progress" data-status="in_progress">
    <div class="column-header">Em Progresso <span class="count" id="count-in_progress">0</span></div>
    <div class="column-body" id="col-in_progress"></div>
  </div>
  <div class="column col-review" data-status="review">
    <div class="column-header">Reviso <span class="count" id="count-review">0</span></div>
    <div class="column-body" id="col-review"></div>
  </div>
  <div class="column col-done" data-status="done">
    <div class="column-header">Concludo <span class="count" id="count-done">0</span></div>
    <div class="column-body" id="col-done"></div>
  </div>
  <div class="column col-waiting_approval" data-status="waiting_approval">
    <div class="column-header" style="background:var(--accent);color:#fff">Aguardando Aprovaco <span class="count" id="count-waiting_approval">0</span></div>
    <div class="column-body" id="col-waiting_approval"></div>
  </div>
  <div class="column col-rejected" data-status="rejected">
    <div class="column-header">Rejeitado <span class="count" id="count-rejected">0</span></div>
    <div class="column-body" id="col-rejected"></div>
  </div>
</div>
'''

with open(path, 'w') as f:
    f.write(part1)

print(f"Part 1 written: {os.path.getsize(path)} bytes")
PYEOF