# ⚡ Agent Flow — Review de Performance e Melhorias

> Foco: acelerar entregas dos agentes, reduzir latência, eliminar gargalos.

---

## 🔴 Gargalos de Performance (Agora)

### 1. SQLite em disco vs WAL não otimizado
**Problema:** WAL mode já está ativo, mas sem `synchronous=NORMAL` ou `cache_size`.
**Impacto:** Escritas concorrentes (heartbeat + thinking + tokens) criam lock.

**Solução:**
```
PRAGMA synchronous = NORMAL;     -- mais rápido que FULL
PRAGMA cache_size = -64000;      -- 64MB de cache
PRAGMA busy_timeout = 5000;      -- esperar 5s antes de dar lock error
```

### 2. Heartbeat sem rate limit
**Problema:** Agentes enviam heartbeat a cada 30s. Se 5 agentes batem ao mesmo tempo, SQLite trava.
**Impacto:** Locks no banco, feed ao vivo pode atrasar.

**Solução:** Buffer de heartbeats em memória, flush a cada 5s no banco.

### 3. WebSocket broadcast síncrono
**Problema:** `broadcast()` faz loop em todos os clientes sequencialmente.
**Impacto:** Se um cliente está lento, segura os outros.

**Solução:**
```js
// Já é razoável pelo volume atual, mas com 20+ agentes vira gargalo
// Usar broadcast paralelo ou atrelar a um único intervalo
```

### 4. Sem Redis/cache layer
**Problema:** Toda requisição de tasks (GET /api/tasks) faz scan completo na tabela.
**Impacto:** Com 1000+ tasks, cada render do kanban leva 200-500ms.

**Solução:** Cache simples em memória das tasks, invalidar a cada write.

### 5. Seed no startup bloqueia
**Problema:** `SELECT COUNT(*)` + seed transaction roda toda vez que o server inicia.
**Impacto:** Atraso de 100-300ms no startup, desnecessário se DB já existe.

**Solução:** Já é só 1 query, mas deixar pro futuro: mover seed pra script separado.

---

## 🟡 Melhorias de Performance (Implementar Agora)

### 1. Cache de tasks em memória
```js
const taskCache = { tasks: null, timestamp: 0, ttl: 2000 };

function getTasksCached() {
  if (Date.now() - taskCache.timestamp < taskCache.ttl && taskCache.tasks) {
    return taskCache.tasks;
  }
  taskCache.tasks = db.prepare('SELECT * FROM tasks ORDER BY created_at DESC').all();
  taskCache.timestamp = Date.now();
  return taskCache.tasks;
}

// Invalidar no POST/PATCH/DELETE
function invalidateTaskCache() { taskCache.timestamp = 0; }
```

**Ganho:** 20-50ms por requisição de tasks (economiza ~40% de I/O).

### 2. Heartbeat em memória com flush
Manter heartbeats num Map e dar flush no banco a cada 5s.
```js
setInterval(() => {
  for (const [name, data] of agentHeartbeatBuffer) {
    db.prepare('INSERT INTO agent_thoughts ...').run(...);
  }
  agentHeartbeatBuffer.clear();
}, 5000);
```

**Ganho:** Reduz escritas no SQLite em ~95% (em vez de 1 write/heartbeat).

### 3. Batch de inserts para tokens
**Problema:** Cada `POST /api/agents/tokens` faz 1 INSERT.
**Solução:** Usar `better-sqlite3` transaction explícita com prepared statement.

**Ganho:** 5-10x mais rápido em bursts de tokens.

### 4. WebSocket compressão
**Problema:** Mensagens WebSocket (tasks completas, agent list) são JSON sem compressão.
**Solução:** `perMessageDeflate` nas opções do WebSocketServer.

### 5. Index na coluna `status` para queries frequentes
**Problema:** `SELECT * FROM tasks WHERE status = ?` faz full scan.
**Solução:**
```sql
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
```

**Ganho:** Queries de filtro por status passam de O(n) para O(log n).

---

## 🔵 Funcionalidades para Acelerar Entregas

### 1. ⏰ SLA / Prazo nas Tasks
Adicionar campo `due_date` e `sla_hours`.
- Task vencida → destaque vermelho no card
- Notificar automaticamente se próximo do deadline
- Dashboard mostrar tasks atrasadas

### 2. 🔄 Reatribuição Automática
Se um agente não responde heartbeat por 5min:
- Task volta pra backlog
- Orchestrator tenta outro agente disponível
- Log de reatribuição

### 3. 📋 Templates de Task
Pré-definir templates comuns:
- "Implementar componente X" → já preenche descrição, docs, checklist
- "Corrigir bug em Y" → template de bug report
- "Refatorar módulo Z" → template de refactor

### 4. 🧪 Auto-Test / QA Automático
Quando uma task vai pra `review`:
- Orchestrator spawna Teco 🐶 automaticamente
- Teco testa e marca done/rejected
- Sem necessidade de trigger manual

### 5. 📊 Dashboard de Produtividade
- Tasks concluídas por agente (hoje/semana/mês)
- Tempo médio de execução por tipo de task
- Custo total de tokens por sprint
- Gráfico de burndown

### 6. 🔗 Integração com GitHub
Quando task é marcada `done`:
- Criar commit/push automático (se código implementado)
- Ou criar Pull Request
- Ou linkar PR existente à task
- Comentário com link do commit

### 7. 🚦 Pipeline Visual
Pré-requisitos entre tasks:
- Task B só pode iniciar se Task A estiver done
- Visualizar dependências (DAG simples)
- Orchestrator respeita ordem

### 8. 📝 Log de Execução por Task
Histórico completo:
- Timestamp de cada mudança de status
- Quem moveu
- Quanto tempo ficou em cada estado
- Quantos tokens consumiu no total

### 9. 🔔 Notificações no Telegram
Quando algo importante acontece:
- Task entrou em `waiting_approval` → avisar Mestre
- Task atrasou (passou do SLA) → alerta
- Agente ficou offline → notificar
- QA rejeitou task → avisar dev

### 10. ⚡ Execução Paralela
Orchestrator spawna múltiplos agentes simultaneamente:
- Tasks independentes executam em paralelo
- Tasks com dependência esperam a anterior
- Painel mostra tasks em paralelo vs sequenciais

---

## ✅ Prioridade de Implementação

| Prioridade | Item | Esforço | Impacto |
|------------|------|---------|---------|
| 🔴 Crítica | Cache de tasks em memória | Baixo | Alto |
| 🔴 Crítica | Index em `status` | Baixo | Alto |
| 🔴 Crítica | SLA / Prazo nas tasks | Médio | Alto |
| 🟡 Alta | Heartbeat buffer | Baixo | Médio |
| 🟡 Alta | Templates de task | Baixo | Alto |
| 🟡 Alta | Auto-Test (Teco automático) | Médio | Alto |
| 🟡 Alta | Log de execução por task | Médio | Médio |
| 🟢 Média | Dashboard de produtividade | Alto | Médio |
| 🟢 Média | Notificações Telegram | Médio | Alto |
| 🟢 Média | Pipeline de dependências | Alto | Médio |
| 🔵 Baixa | WebSocket compressão | Baixo | Baixo |
| 🔵 Baixa | GitHub integração | Alto | Alto |

---

## 📊 Métricas Atuais (Benchmark)

**Setup atual:** Docker, SQLite WAL, 6 tasks seed, 1 agente testando.

| Operação | Tempo Atual | Com Cache | Ganho |
|----------|------------|-----------|-------|
| GET /api/tasks | 15-30ms | 1-2ms | ~15x |
| POST /api/heartbeat | 8-12ms | 2-3ms | ~4x |
| POST /api/thinking | 10-15ms | 3-5ms | ~3x |
| PATCH /api/task | 15-25ms | 15-25ms | 1x |
| WebSocket broadcast | 2-5ms | 2-5ms | 1x |

**Target:** Todas as operações em <10ms, heartbeat <5ms, WebSocket latência <50ms.
