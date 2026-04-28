FROM node:22-alpine

WORKDIR /app

# Dependências do sistema (better-sqlite3 precisa de build tools)
RUN apk add --no-cache python3 make g++ sqlite

# Copiar apenas package.json primeiro (melhor cache de camadas)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Copiar o resto do código
COPY . .

# Criar diretório de dados (pode ser montado como volume)
RUN mkdir -p /app/data

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3790/api/tasks?token=agent-5678 || exit 1

EXPOSE 3790

CMD ["node", "server.js"]
