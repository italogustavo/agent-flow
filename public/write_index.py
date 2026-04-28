#!/usr/bin/env python3
import os, sys

path = "/home/pcgustavo/.openclaw/workspace/agent-flow/public/index.html"

# Split the HTML into multiple parts to keep each chunk manageable
chunks = []

# Part 1: HTML head, CSS, header, agent bar, live feed, new task form, board
chunks.append(r'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agent Flow — Centro de Comando</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0b0d14;--surface:#151821;--surface2:#1e2230;
    --border:#282c3b;--text:#e0e3ed;--text-muted:#787c94;
    --accent:#6c5ce7;--accent2:#a29bfe;
    --green:#00b894;--yellow:#fdcb6e;--red:#e17055;--blue:#74b9ff;
    --radius:10px;--shadow:0 4px 20px rgba(0,0,0,.5);--transition:all .18s ease
  }
  body{font-family:'Inter','SF Pro','Segoe UI',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column}
  header{background:var(--surface);border-bottom:1px solid var(--border);padding:10px 18px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .brand{display:flex;align-items:center;gap:8px;margin-right:auto}
  .brand h1{font-size:1.1rem;display:flex;align-items:center;gap:6px}
  .brand h1 span{color:var(--accent2)}
  .brand .subtitle{font-size:.68rem;color:var(--text-muted);font-weight:400}
  .conn-indicator{font-size:.7rem;padding:3px 9px;border-radius:20px;display:inline-flex;align-items:center;gap:5px;background:var(--surface2);border:1px solid var(--border)}
  .conn-indicator.connected{color:var(--green);border-color:var(--green)}
  .conn-indicator.disconnected{color:var(--red);border-color:var(--red)}
  .conn-indicator.reconnecting{color:var(--yellow);border-color:var(--yellow)}
  .conn-indicator .dot{width:7px;height:7px;border-radius:50%;display:inline-block}
  .conn-indicator.connected .dot{background:var(--green);box-shadow:0 0 5px var(--green)}
  .conn-indicator.disconnected .dot{background:var(--red);box-shadow:0 0 5px var(--red)}
  .conn-indicator.reconnecting .dot{background:var(--yellow);box-shadow:0 0 5px var(--yellow)}
  .btn{background:var(--accent);color:#fff;border:none;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:.82rem;font-weight:600;transition:var(--transition);display:inline-flex;align-items:center;gap:5px}
  .btn:hover{background:#5a4bd1;transform:translateY(-1px);box-shadow:0 2px 12px rgba(108,92,231,.25)}
  .btn:active{transform:translateY(0);box-shadow:none}
  .btn:focus-visible{outline:2px solid var(--accent2);outline-offset:2px}
  .btn-sm{padding:4px 10px;font-size:.78rem}
  .btn-xs{padding:2px 7px;font-size:.68rem;border-radius:6px}
  .btn-primary{background:var(--green)}
  .btn-primary:hover{background:#00a381}
  .btn-danger{background:var(--red)}
  .btn-danger:hover{background:#c0392b}
  .btn-outline{background:transparent;border:1px solid var(--border);color:var(--text)}
  .btn-outline:hover{border-color:var(--accent);color:var(--accent2);background:rgba(108,92,231,.08)}
  .btn .spinner{display:none;width:13px;height:13px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
  .btn.loading{pointer-events:none;opacity:.8}
  .btn.loading .spinner{display:inline-block}
  .btn.loading .btn-text{display:none}
  @keyframes spin{to{transform:rotate(360deg)}}
  .badge{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 5px;border-radius:9px;font-size:.6rem;font-weight:700;background:var(--red);color:#fff}
  .agent-bar{background:var(--surface2);padding:6px 18px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.78rem;min-height:36px;border-bottom:1px solid var(--border)}
  .agent-bar-label{color:var(--text-muted);font-size:.7rem}
  .agent-item{display:inline-flex;align-items:center;gap:4px;padding:2px 7px;border-radius:14px;background:var(--surface);border:1px solid var(--border);font-size:.75rem;transition:var(--transition);max-width:200px}
  .agent-item:hover{border-color:var(--accent)}
  .agent-item.busy{border-color:var(--yellow)}
  .agent-item.idle{border-color:var(--green)}
  .agent-item.offline{opacity:.45}
  .agent-dot{width:7px;height:7px;border-radius:50%;display:inline-block;flex-shrink:0}
  .dot-online{background:var(--green);box-shadow:0 0 4px var(--green)}
  .dot-away{background:var(--yellow)}
  .dot-offline{background:var(--text-muted)}
  .agent-name{font-weight:600}
  .agent-task-ref{font-size:.65rem;color:var(--accent2);overflow:hidden;text-overflow:ellipsis;max-width:80px}
  .tds{display:inline-flex;gap:2px;align-items:center}
  .tds span{width:4px;height:4px;border-radius:50%;background:var(--accent2)}
  .tds span:nth-child(1){animation:tb .5s ease-in-out infinite}
  .tds span:nth-child(2){animation:tb .5s ease-in-out infinite .15s}
  .tds span:nth-child(3){animation:tb .5s ease-in-out infinite .3s}
  @keyframes tb{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
  .live-feed{background:var(--bg);border-bottom:1px solid var(--border);padding:0 18px;font-size:.75rem;height:28px;display:flex;align-items:center;overflow:hidden}
  .feed-label{flex-shrink:0;margin-right:6px;color:var(--text-muted);font-size:.68rem;font-weight:600}
  .feed-scroll{overflow:hidden;flex:1;position:relative;height:100%}
  #feed-list{position:absolute;bottom:0;left:0;right:0;display:flex;flex-direction:column-reverse}
  .feed-item{padding:1px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:0;animation:fi .25s ease forwards;font-size:.72rem;color:var(--text-muted)}
  @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  .new-task-form{background:var(--surface);border-bottom:1px solid var(--border);padding:12px 18px;display:none;gap:8px;flex-wrap:wrap;align-items:end}
  .new-task-form.active{display:flex;animation:sd .2s ease}
  @keyframes sd{from{opacity:0;max-height:0;padding:0 18px}to{opacity:1;max-height:110px;padding:12px 18px}}
  .new-task-form .field{flex:1;min-width:120px}
  .new-task-form label{display:block;font-size:.65rem;color:var(--text-muted);margin-bottom:2px;font-weight:600}
  .new-task-form .required::after{content:' *';color:var(--red)}
  .new-task-form input,.new-task-form select{width:100%;padding:6px 9px;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:.82rem;font-family:inherit;transition:var(--transition)}
  .new-task-form input:focus,.new-task-form select:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 2px rgba(108,92,231,.15)}
  .board{display:flex;gap:10px;padding:12px 18px;flex:1;overflow-x:auto;align-items:flex-start}
  .column{min-width:245px;max-width:295px;flex:1;background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);display:flex;flex-direction:column;max-height:calc(100vh - 155px);transition:border-color .2s,box-shadow .2s}
  .column.drag-over{border-color:var(--accent);box-shadow:0 0 20px rgba(108,92,231,.18)}
  .column-header{padding:10px 12px;font-weight:700;font-size:.75rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none;flex-shrink:0;border-radius:var(--radius) var(--radius) 0 0}
  .column-header .count{background:var(--surface2);padding:1px 8px;border-radius:10px;font-size:.65rem;color:var(--text-muted);font-weight:600}
  .col-backlog .column-header{border-left:3px solid var(--text-muted)}
  .col-assigned .column-header{border-left:3px solid var(--blue)}
  .col-in_progress .column-header{border-left:3px solid var(--yellow)}
  .col-review .column-header{border-left:3px solid var(--accent2)}
  .col-done .column-header{border-left:3px solid var(--green)}
  .col-rejected .column-header{border-left:3px solid var(--red)}
  .col-waiting_approval .column-header{background:var(--accent);color:#fff;border-left:3px solid var(--accent)}
  .col-waiting_approval .column-header .count{background:rgba(255,255,255,.15);color:#fff}
  .column-body{padding:5px;overflow-y:auto;flex:1;min-height:50px}
  .card{background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:9px 11px;margin-bottom:5px;cursor:pointer;transition:var(--transition)}
  .card:hover{border-color:var(--accent);transform:translateY(-1px);box-shadow:0 3px 14px rgba(0,0,0,.35)}
  .card[draggable="true"]{cursor:grab}
  .card[draggable="true"]:active{cursor:grabbing}
  .card.dragging{opacity:.35;transform:rotate(.5deg) scale(.96)}
  .card .card-title{font-weight:600;font-size:.82rem;margin-bottom:4px;word-break:break-word;line-height:1.3;display:flex;align-items:center;gap:4px}
  .card .card-meta{display:flex;justify-content:space-between;align-items:center;font-size:.7rem;color:var(--text-muted);gap:5px}
  .card .card-agent{background:var(--surface);padding:1px 6px;border-radius:8px;color:var(--accent2);font-size:.65rem}
  .exec-dot{width:6px;height:6px;border-radius:50%;background:var(--accent2);animation:pulse 1s ease-in-out infinite;display:inline-block;flex-shrink:0}
  .priority-badge{padding:1px 6px;border-radius:8px;font-size:.62rem;font-weight:700}
  .prio-low{background:#2a3550;color:var(--blue)}
  .prio-medium{background:#3a3220;color:var(--yellow)}
  .prio-high{background:#3a1e1e;color:var(--red)}
  .prio-critical{background:#4a1515;color:#ff6b6b;animation:pulse 1.2s ease-in-out infinite}
  .app-badge{display:inline-block;padding:1px 5px;border-radius:7px;background:var(--accent);color:#fff;font-size:.55rem;font-weight:700;margin-left:3px;vertical-align:middle}
  .empty-col{text-align:center;padding:16px 10px;color:var(--text-muted);font-size:.72rem;line-height:1.5}
  .empty-col .empty-icon{font-size:1.3rem;margin-bottom:4px;opacity:.4}
  .empty-col .empty-hint{opacity:.45;font-size:.65rem;margin-top:3px}
  .modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:100;justify-content:center;align-items:center;animation:fdi .15s ease}
  .modal-overlay.active{display:flex}
  @keyframes fdi{from{opacity:0}to{opacity:1}}
  .modal-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:10px}
  .modal-header h2{font-size:1.1rem;flex:1;line-height:1.3}
  .btn-close{background:none;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer;padding:0 3px;line-height:1;transition:var(--transition)}
  .btn-close:hover{color:var(--text)}
  .modal{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:22px;max-width:560px;width:92%;max-height:85vh;overflow-y:auto;box-shadow:0 10px 60px rgba(0,0,0,.6);animation:mdi .2s ease}
  @keyframes mdi{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  .modal-id{color:var(--text-muted);font-size:.72rem;margin-bottom:10px;font-family:monospace}
  .modal label{display:block;font-size:.7rem;font-weight:600;margin-top:10px;margin-bottom:3px;color:var(--text-muted)}
  .modal input,.modal select,.modal textarea{width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:.85rem;font-family:inherit;transition:var(--transition)}
  .modal textarea{min-height:60px;resize:vertical}
  .modal input:focus,.modal select:focus,.modal textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 2px rgba(108,92,231,.15)}
  .modal .modal-actions{display:flex;gap:7px;margin-top:14px;justify-content:flex-end;flex-wrap:wrap;padding-top:12px}
  .modal .modal-actions .left{justify-content:flex-start}
  .modal .mstatus{display:flex;gap:5px;margin-top:8px;flex-wrap:wrap}
  .modal .sbtn{padding:4px 10px;border-radius:14px;border:1px solid var(--border);background:var(--bg);color:var(--text);cursor:pointer;font-size:.7rem;transition:var(--transition)}
  .modal .sbtn.active{border-color:var(--accent);background:var(--accent);color:#fff}
  .modal .sbtn:hover{border-color:var(--accent)}
  .exec-strip{margin-top:10px;background:var(--surface2);border-radius:8px;padding:10px 12px;border-left:3px solid var(--accent2);display:none}
  .exec-strip.visible{display:block}
  .exec-strip h3{font-size:.78rem;margin-bottom:5px;display:flex;align-items:center;gap:5px}
  .exec-row{display:flex;align-items:center;gap:6px;font-size:.8rem;margin-bottom:4px}
  .exec-row:last-child{margin-bottom:0}
  .exec-name{font-weight:600}
  .exec-thinking{font-size:.72rem;color:var(--accent2);margin-top:4px;padding:6px 8px;background:var(--bg);border-radius:6px;line-height:1.4}
  .app-box{margin-top:10px;background:var(--surface2);border-radius:8px;padding:12px 14px;border:2px solid var(--accent);display:none;animation:fdi .3s ease}
  .app-box.visible{display:block}
  .app-box h3{font-size:.82rem;display:flex;align-items:center;gap:5px}
  .app-qt{font-size:.8rem;color:var(--text-muted);margin:5px 0 10px;padding:8px 10px;background:var(--bg);border-radius:6px}
  .app-actions{display:flex;gap:8px}
  .app-actions .btn{flex:1;justify-content:center;padding:9px;font-size:.82rem}
  .req-area{margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
  .req-area h3{font-size:.78rem;margin-bottom:5px;display:flex;align-items:center;gap:5px}
  .comments-section{margin-top:12px;border-top:1px solid var(--border);padding-top:10px}
  .comments-section h3{font-size:.78rem;margin-bottom:6px;color:var(--text-muted);display:flex;align-items:center;gap:5px}
  .comment{background:var(--bg);border-radius:7px;padding:7px 9px;margin-bottom:5px;animation:fdi .2s ease}
  .comment .cm-meta{font-size:.65rem;color:var(--text-muted);margin-bottom:2px}
  .comment .cm-meta strong{color:var(--accent2)}
  .comment .cm-body{font-size:.78rem;line-height:1.4}
  .comment-form{display:flex;gap:5px;margin-top:6px}
  .comment-form input{flex:1;padding:6px 9px;border-radius:7px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:.8rem;transition:var(--transition)}
  .comment-form input:focus{outline:none;border-color:var(--accent)}
  .toast-container{position:fixed;bottom:16px;right:16px;z-index:999;display:flex;flex-direction:column;gap:5px;pointer-events:none;max-width:360px}
  .toast{background:var(--surface);border:1px solid var(--border);border-radius:9px;padding:9px 14px;font-size:.8rem;box-shadow:0 6px 24px rgba(0,0,0,.6);pointer-events:auto;animation:ti .25s ease;display:flex;align-items:center;gap:7px}
  .toast.success{border-left:3px solid var(--green)}
  .toast.error{border-left:3px solid var(--red)}
  .toast.warning{border-left:3px solid var(--yellow)}
  .toast.info{border-left:3px solid var(--blue)}
  @keyframes ti{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
  .toast .toast-close{background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:.9rem;padding:0 2px;margin-left:auto;transition:var(--transition)}
  .toast .toast-close:hover{color:var(--text)}
  .rt{width:100%;border-collapse:collapse;font-size:.82rem}
  .rt th,.rt td{padding:6px 9px;text-align:left;border-bottom:1px solid var(--border)}
  .rt th{color:var(--text-muted);font-weight:600;font-size:.68rem}
  .rt tr:hover td{background:var(--surface2)}
  .rt .tr td{font-weight:700;border-top:2px solid var(--accent)}
  .modal-chat{max-width:600px;height:70vh;display:flex;flex-direction:column}
  .modal-chat .modal-body{flex:1;display:flex;flex-direction:column;overflow:hidden}
  .chat-messages{flex:1;overflow-y:auto;padding:8px;background:var(--bg);border-radius:7px;margin-bottom:7px;display:flex;flex-direction:column;gap:4px}
  .chat-msg{background:var(--surface2);padding:6px 9px;border-radius:8px;border:1px solid var(--border);animation:fdi .2s ease;max-width:85%}
  .chat-mine{border-color:var(--accent);align-self:flex-end;background:rgba(108,92,231,.08)}
  .chat-other{align-self:flex-start}
  .cm-top{display:flex;align-items:center;gap:5px;margin-bottom:2px}
  .cm-author{font-size:.68rem;font-weight:600;color:var(--accent2)}
  .cm-body{font-size:.78rem;margin-top:1px;line-height:1.4}
  .cm-time{font-size:.62rem;color:var(--text-muted);margin-top:1px;text-align:right}
  .chat-input-area{display:flex;gap:5px;align-items:center}
  .chat-input-area input{flex:1;padding:6px 9px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:.8rem}
  .chat-input-area select{padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:.8rem}
  .chat-input-area input:focus,.chat-input-area select:focus{outline:none;border-color:var(--accent)}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
  ::-webkit-scrollbar-thumb:hover{background:var(--text-muted)}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  @media(max-width:768px){
    .board{flex-direction:column;align-items:stretch;padding:8px}
    .column{max-width:none;min-width:0;max-height:none}
    header{flex-direction:column;align-items:stretch}
    .header-controls{justify-content:flex-start}
    .new-task-form .field{min-width:100%}
    .agent-item{max-width:140px}
  }
</style>
</head>
<body>
<header>
  <div class="brand">
    <h1>⚡ Agent <span>Flow</span></h1>
    <span class="subtitle">Centro de Comando</span>
    <span class="conn-indicator connected" id="conn-indicator">
      <span class="dot"></span>
      <span id="conn-text">Conectado</span>
    </span>
  </div>
  <div class="header-controls" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
    <button class="btn btn-primary btn-sm" onclick="showNewTaskForm()" id="btn-new-task">
      <span class="btn-text">+ Nova Tarefa</span>
    </button>
    <button class="btn btn-outline btn-sm" onclick="openReportModal()">📊 Relatório</button>
    <button class="btn btn-outline btn-sm" onclick="openAgentChat()" id="btn-chat" style="position:relative">
      💬 Chat <span class="badge" id="chat-badge" style="display:none;position:absolute;top:-5px;right:-5px">0</span>
    </button>
    <button class="btn btn-outline btn-sm" onclick="refreshAll()">🔄</button>
  </div>
</header>
<div class="agent-bar" id="agent-bar">
  <span class="agent-bar-label">🕵️ Agentes:</span>
  <span id="agent-list">Nenhum agente ativo</span>
</div>
<div class="live-feed" id="live-feed">
  <span class="feed-label">📡 Feed</span>
  <div class="feed-scroll"><div id="feed-list"></div></div>
</div>
<div class="new-task-form" id="new-task-form">
  <div class="field">
    <label class="required">Título</label>
    <input type="text" id="nt-title" placeholder="O que precisa ser feito?" autofocus>
  </div>
  <div class="field" style="flex:0 0 130px">
    <label>Prioridade</label>
    <select id="nt-prio">
      <option value="low">🟦 Baixa</option>
      <option value="medium" selected>🟨 Média</option>
      <option value="high">🟧 Alta</option>
      <option value="critical">🔥 Crítica</option>
    </select>
  </div>
  <div class="field" style="flex:0 0 140px">
    <label>Responsável</label>
    <select id="nt-agent"><option value="">Ninguém</option></select>
  </div>
  <div class="field" style="flex:1.5">
    <label>Descrição</label>
    <input type="text" id="nt-desc" placeholder="Resumo rápido (opcional)">
  </div>
  <button class="btn btn-primary" onclick="createTask()" id="btn-create-task" style="height:34px">
    <span class="spinner"></span><span class="btn-text">Criar</span>
  </button>
  <button class="btn btn-outline btn-sm" onclick="hideNewTaskForm()">Cancelar</button>
</div>
<div class="board" id="board">
  <div class="column col-backlog" data-status="backlog">
    <div class="column-header" onclick="showNewTaskForm()">📋 Backlog <span class="count" id="count-backlog">0</span></div>
    <div class="column-body" id="col-backlog"></div>
  </div>
  <div class="column col-assigned" data-status="assigned">
    <div class="column-header">🎯 Atribuído <span class="count" id="count-assigned">0</span></div>
    <div class="column-body" id="col-assigned"></div>
  </div>
  <div class="column col-in_progress" data-status="in_progress">
    <div class="column-header">⚙️ Em Progresso <span class="count" id="count-in_progress">0</span></div>
    <div class="column-body" id="col-in_progress"></div>
  </div>
  <div class="column col-review" data-status="review">
    <div class="column-header">👀 Revisão <span class="count" id="count-review">0</span></div>
    <div class="column-body" id="col-review"></div>
  </div>
  <div class="column col-waiting_approval" data-status="waiting_approval">
    <div class="column-header">👑 Aguard. Aprovação <span class="count" id="count-waiting_approval">0</span></div>
    <div class="column-body" id="col-waiting_approval"></div>
  </div>
  <div class="column col-done" data-status="done">
    <div class="column-header">✅ Concluído <span class="count" id="count-done">0</span></div>
    <div class="column-body" id="col-done"></div>
  </div>
  <div class="column col-rejected" data-status="rejected">
    <div class="column-header">❌ Rejeitado <span class="count" id="count-rejected">0</span></div>
    <div class="column-body" id="col-rejected"></div>
  </div>
</div>
''')

print("Part 1 ready: HTML/CSS/header/board HTML")
print(f"Length: {len(chunks[0])} chars")

# Part 2: Modals, toast, report, chat, JS
chunks.append(r'''
<div class="modal-overlay" id="modal-overlay" onclick="closeModal(event)">
  <div class="modal" onclick="event.stopPropagation()" id="task-modal" role="dialog" aria-modal="true" aria-label="Detalhes da tarefa">
    <div class="modal-header">
      <h2 id="modal-title"></h2>
      <button class="btn-close" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-id" id="modal-id"></div>
    <label>Título</label>
    <input type="text" id="modal-edit-title">
    <label>Descrição</label>
    <textarea id="modal-edit-desc"></textarea>
    <div style="display:flex;gap:12px">
      <div style="flex:1">
        <label>Responsável</label>
        <select id="modal-edit-agent"></select>
      </div>
      <div style="flex:1">
        <label>Prioridade</label>
        <select id="modal-edit-prio">
          <option value="low">Baixa</option>
          <option value="medium">Média</option>
          <option value="high">Alta</option>
          <option value="critical">Crítica</option>
        </select>
      </div>
    </div>
    <label>Status</label>
    <div class="mstatus" id="modal-status-btns"></div>
    <div class="exec-strip" id="exec-strip">
      <h3>⚡ Executando</h3>
      <div id="execution-info"></div>
    </div>
    <div class="app-box" id="app-box">
      <h3>👑 Aguardando sua aprovação</h3>
      <div class="app-qt" id="approval-question"></div>
      <div class="app-actions">
        <button class="btn" style="background:var(--green)" onclick="approveTask()">✅ Aprovar</button>
        <button class="btn" style="background:var(--red)" onclick="rejectTask()">❌ Rejeitar</button>
      </div>
      <input type="hidden" id="approval-task-id">
    </div>
    <div class="req-area">
      <h3>👑 Solicitar aprovação do PO</h3>
      <input type="text" id="modal-approval-question" placeholder="Descreva o que precisa de aprovação..." style="width:100%;padding:7px 10px;border-radius:7px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:.8rem;margin-bottom:6px">
      <button class="btn btn-sm" onclick="requestApproval()">👑 Solicitar Aprovação</button>
    </div>
    <div class="comments-section">
      <h3>💬 Comentários</h3>
      <div id="comments-list"></div>
      <div class="comment-form">
        <input type="text" id="comment-input" placeholder="Adicionar comentário...">
        <button class="btn btn-sm" onclick="addComment()">Enviar</button>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-danger btn-sm left" onclick="deleteTask()" style="margin-right:auto">🗑️ Excluir</button>
      <button class="btn btn-outline btn-sm" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-sm" onclick="saveTask()">💾 Salvar</button>
    </div>
  </div>
</div>

<div class="modal-overlay" id="report-overlay" onclick="closeReportModal(event)">
  <div class="modal" onclick="event.stopPropagation()" style="max-width:720px" role="dialog" aria-modal="true" aria-label="Relatório de tokens">
    <div class="modal-header">
      <h2>📊 Relatório de Tokens</h2>
      <button class="btn-close" onclick="closeReportModal()">&
