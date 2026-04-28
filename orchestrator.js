#!/usr/bin/env node
/**
 * Agent Flow — Orchestrator
 * 
 * Varre tasks no Agent Flow e spawna agentes automaticamente via OpenClaw.
 * Tasks com assigned_to preenchido e status 'backlog' ou 'assigned'
 * disparam subagentes dedicados.
 * 
 * Uso:
 *   node orchestrator.js                    # Uma execução
 *   node orchestrator.js --watch            # Loop a cada 60s
 *   node orchestrator.js --watch=30         # Loop a cada 30s
 * 
 * Integração com OpenClaw:
 *   Usa sessions_spawn para criar subagentes. Cada subagente recebe
 *   prompt completo com contexto da task + docs do LDV.
 */

const AGENT_FLOW_URL = process.env.AGENT_FLOW_URL || 'http://localhost:3790';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'agent-5678';

// Mapeamento de nomes de agentes → suas funções e sessões OpenClaw
const AGENTS = {
  'Nina 🐱': {
    role: 'Frontend React',
    sessionId: 'agent:main:subagent:33a15fad',
    getPrompt: (task) => `
🎯 **Nina 🐱** — Você é a desenvolvedora Frontend React do projeto Liga das Vendas.

## Task #${task.id.substring(0, 8)}
**${task.title}**
${task.description ? '\n' + task.description : ''}

Prioridade: ${task.priority}
Status atual: ${task.status}

### 📋 Instruções
1. Leia os docs do projeto em ldv-docs/
2. Consulte aprendizados em ldv-docs/aprendizados-agentes.md
3. Implemente a task no código em ldv-app/
4. Faça commit e push
5. Atualize o status da task no Agent Flow para 'done'

### 📚 Docs obrigatórios
- PRD: ldv-docs/PRD-Liga-das-Vendas-v0.4.md
- Arquitetura: ldv-docs/Arquitetura-Liga-das-Vendas-Parte-1-v0.3.md

### 🔗 Agent Flow
Base URL: ${AGENT_FLOW_URL}
Token: ${AUTH_TOKEN}
Task ID: ${task.id}

Boa sorte! 🐱
`
  },
  'Bento 🦊': {
    role: 'Backend Laravel',
    sessionId: 'agent:main:subagent:50384b69',
    getPrompt: (task) => `
🎯 **Bento 🦊** — Você é o desenvolvedor Backend Laravel do projeto Liga das Vendas.

## Task #${task.id.substring(0, 8)}
**${task.title}**
${task.description ? '\n' + task.description : ''}

Prioridade: ${task.priority}
Status atual: ${task.status}

### 📋 Instruções
1. Leia os docs do projeto em ldv-docs/
2. Consulte aprendizados em ldv-docs/aprendizados-agentes.md
3. Implemente a task no código em ldv-app/
4. Faça commit e push
5. Atualize o status da task no Agent Flow para 'done'

### 📚 Docs obrigatórios
- Motor de Comissão: ldv-docs/Motor-Comissao-Liga-das-Vendas.md
- PRD: ldv-docs/PRD-Liga-das-Vendas-v0.4.md

### 🔗 Agent Flow
Base URL: ${AGENT_FLOW_URL}
Token: ${AUTH_TOKEN}
Task ID: ${task.id}

Boa sorte! 🦊
`
  },
  'Luna 🦄': {
    role: 'UI/UX Designer',
    sessionId: 'agent:main:subagent:f07c636e',
    getPrompt: (task) => `
🎯 **Luna 🦄** — Você é a UI/UX Designer do projeto Liga das Vendas.

## Task #${task.id.substring(0, 8)}
**${task.title}**
${task.description ? '\n' + task.description : ''}

Prioridade: ${task.priority}
Status atual: ${task.status}

### 📋 Instruções
1. Leia o manual de marca em ldv-docs/
2. Consulte aprendizados em ldv-docs/aprendizados-agentes.md
3. Implemente as alterações de design no código
4. Faça commit e push
5. Atualize o status da task no Agent Flow para 'done'

### 🔗 Agent Flow
Base URL: ${AGENT_FLOW_URL}
Token: ${AUTH_TOKEN}
Task ID: ${task.id}

Boa sorte! 🦄
`
  },
  'Teco 🐶': {
    role: 'QA Testes',
    sessionId: 'agent:main:subagent:6496d290',
    getPrompt: (task) => `
🎯 **Teco 🐶** — Você é o QA Tester do projeto Liga das Vendas.

## Task #${task.id.substring(0, 8)}
**${task.title}**
${task.description ? '\n' + task.description : ''}

Prioridade: ${task.priority}
Status atual: ${task.status}

### 📋 Instruções
1. Leia os docs do projeto
2. Teste a funcionalidade
3. Se aprovado → atualize status para 'done'
4. Se rejeitado → atualize para 'rejected' com comentário detalhado

### 🔗 Agent Flow
Base URL: ${AGENT_FLOW_URL}
Token: ${AUTH_TOKEN}
Task ID: ${task.id}

Boa sorte! 🐶
`
  },
  'Dock 🐳': {
    role: 'DevOps Infra',
    sessionId: 'agent:main:subagent:1c9bee20',
    getPrompt: (task) => `
🎯 **Dock 🐳** — Você é o DevOps do projeto Liga das Vendas.

## Task #${task.id.substring(0, 8)}
**${task.title}**
${task.description ? '\n' + task.description : ''}

Prioridade: ${task.priority}
Status atual: ${task.status}

### 📋 Instruções
1. Leia os docs relevantes em ldv-docs/
2. Execute a task de infraestrutura
3. Faça commit e push se aplicar
4. Atualize o status da task no Agent Flow para 'done'

### 🔗 Agent Flow
Base URL: ${AGENT_FLOW_URL}
Token: ${AUTH_TOKEN}
Task ID: ${task.id}

Boa sorte! 🐳
`
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const url = `${AGENT_FLOW_URL}${path}`;
  const opts = {
    method,
    headers: {
      'x-auth-token': AUTH_TOKEN,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path}: ${res.status} ${text}`);
  }
  return res.json();
}

async function findPendingTasks() {
  const tasks = await api('GET', '/api/tasks');
  return tasks.filter(t =>
    t.assigned_to &&
    AGENTS[t.assigned_to] &&
    (t.status === 'backlog' || t.status === 'assigned')
  );
}

function getAgentPrompt(task) {
  const agent = AGENTS[task.assigned_to];
  if (!agent) return null;
  return agent.getPrompt(task);
}

async function spawnSubagent(task) {
  const agent = AGENTS[task.assigned_to];
  if (!agent) {
    console.log(`  ❌ Agente desconhecido: ${task.assigned_to}`);
    return;
  }

  const prompt = agent.getPrompt(task);
  const taskIdShort = task.id.substring(0, 8);

  console.log(`  🚀 Spawnando ${task.assigned_to} para: ${task.title} (#${taskIdShort})`);

  // Marcar como in_progress
  try {
    await api('PATCH', `/api/tasks/${task.id}`, { status: 'in_progress' });
    await api('POST', `/api/tasks/${task.id}/comments`, {
      author: 'Orchestrator',
      body: `⏳ **${task.assigned_to}** iniciou esta tarefa via Orchestrator.`,
    });
  } catch (err) {
    console.log(`  ⚠️ Erro ao marcar in_progress: ${err.message}`);
  }

  // Spawnar subagente no OpenClaw
  // NOTA: Isso é um placeholder. A implementação real depende de como
  // o OpenClaw expõe sessions_spawn via API ou CLI.
  // Por enquanto, salvamos um trigger file que o OpenClaw lê.
  const triggerDir = '/home/pcgustavo/.openclaw/workspace/agent-flow/triggers';
  const fs = require('fs');
  const path = require('path');
  fs.mkdirSync(triggerDir, { recursive: true });
  
  const triggerFile = path.join(triggerDir, `task-${taskIdShort}-${task.assigned_to.replace(/[^a-zA-Z0-9]/g, '_')}.md`);
  fs.writeFileSync(triggerFile, prompt, 'utf-8');
  console.log(`  📄 Trigger criado: ${triggerFile}`);

  // Também enviar heartbeat do agente
  try {
    await api('POST', '/api/agents/heartbeat', {
      name: task.assigned_to,
      status: 'busy',
      taskId: task.id,
      thinking: `Iniciando task: ${task.title}`
    });
  } catch (err) {
    // heartbeat não autenticado, ignora erro
  }
}

async function run() {
  console.log(`\n🔍 [${new Date().toLocaleTimeString('pt-BR')}] Orchestrator: varrendo tasks...`);

  let pending;
  try {
    pending = await findPendingTasks();
  } catch (err) {
    console.log(`  ❌ Erro ao conectar ao Agent Flow: ${err.message}`);
    console.log(`  ⚠️ Certifique-se de que o servidor está rodando em ${AGENT_FLOW_URL}`);
    return;
  }

  if (pending.length === 0) {
    console.log('  ✅ Nenhuma task pendente.');
    return;
  }

  console.log(`  📋 ${pending.length} task(s) pendente(s):`);
  for (const task of pending) {
    console.log(`    • [${task.priority}] ${task.title} → ${task.assigned_to}`);
  }

  for (const task of pending) {
    await spawnSubagent(task);
  }

  console.log(`  ✅ ${pending.length} agente(s) disparado(s)!`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const watchArg = args.find(a => a.startsWith('--watch'));
  
  if (watchArg) {
    const interval = parseInt(watchArg.split('=')[1] || '60', 10) * 1000;
    console.log(`👁️  Modo watch: varrendo a cada ${interval / 1000}s`);
    await run();
    setInterval(run, interval);
  } else {
    await run();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('❌ Orchestrator error:', err.message);
  process.exit(1);
});
