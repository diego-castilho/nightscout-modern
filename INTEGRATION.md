# Integração ao Docker Compose Principal

> Ajuste os IPs adequadamente para seu ambiente. Os exemplos abaixo usam a faixa `192.168.1.0/24` como referência.

Se você preferir manter tudo em um único `docker-compose.yml` ao invés de um arquivo separado, use os snippets abaixo.

## Opção 1: Arquivo separado (recomendado)

```bash
cd /caminho/para/nightscout-modern
docker compose up -d
```

**Vantagens:** rebuild independente, versionamento separado, sem afetar outros serviços.

---

## Opção 2: Adicionar ao compose principal

Adicione ao seu `docker-compose.yml` principal (ajuste os IPs adequadamente para seu ambiente):

```yaml
  # ── Nightscout Modern ──────────────────────────────────────────────────────

  nightscout-modern-backend:
    build:
      context: /caminho/para/nightscout-modern
      dockerfile: docker/Dockerfile.backend
    container_name: nightscout-modern-backend
    hostname: nightscout-modern-backend
    restart: unless-stopped
    networks:
      macvlan:
        ipv4_address: 192.168.1.10    # ← IP livre para o backend na sua rede
    dns:
      - 192.168.1.1                   # ← seu gateway/DNS
    environment:
      NODE_ENV: production
      PORT: 3001
      TZ: ${TZ:-America/Sao_Paulo}
      MONGODB_URI: mongodb://192.168.1.100:27017   # ← IP do MongoDB
      MONGODB_DB_NAME: nightscout
      MONGODB_USER: ${MONGODB_USER:-}
      MONGODB_PASSWORD: ${MONGODB_PASSWORD:-}
      API_SECRET: ${NIGHTSCOUT_API_SECRET}
      JWT_SECRET: ${NIGHTSCOUT_MODERN_JWT_SECRET}
      JWT_EXPIRES_IN: 7d
      CORS_ORIGIN: http://192.168.1.11             # ← IP do frontend
      LOG_LEVEL: info
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nightscout-modern-frontend:
    build:
      context: /caminho/para/nightscout-modern
      dockerfile: docker/Dockerfile.frontend
      args:
        VITE_API_URL: http://192.168.1.10:3001/api  # ← IP do backend acima
    container_name: nightscout-modern-frontend
    hostname: nightscout-modern-frontend
    restart: unless-stopped
    networks:
      macvlan:
        ipv4_address: 192.168.1.11    # ← IP livre para o frontend na sua rede
    dns:
      - 192.168.1.1                   # ← seu gateway/DNS
    environment:
      TZ: ${TZ:-America/Sao_Paulo}
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: '0.25'
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    depends_on:
      nightscout-modern-backend:
        condition: service_healthy
```

## Variáveis de ambiente

Adicione ao `.env` principal:

```bash
# Nightscout Modern
NIGHTSCOUT_API_SECRET=seu-api-secret
NIGHTSCOUT_MODERN_JWT_SECRET=string-aleatoria-longa-aqui
```

## Build e start

```bash
cd /caminho/para/seu/docker-compose-principal
docker compose up -d nightscout-modern-backend nightscout-modern-frontend
```

## Rebuild após atualizar o código

```bash
# Pull do repositório
cd /caminho/para/nightscout-modern && git pull

# Rebuild
cd /caminho/para/seu/docker-compose-principal
docker compose build nightscout-modern-frontend nightscout-modern-backend
docker compose up -d --force-recreate nightscout-modern-frontend nightscout-modern-backend
```
