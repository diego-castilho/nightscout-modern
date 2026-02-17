# 🔗 Integrando ao Docker Compose Principal

Se você quiser adicionar o Nightscout Modern ao seu `docker-compose.yml` principal (ao invés de usar um arquivo separado), siga este guia.

## Opção 1: Arquivo Separado (Recomendado) ✅

Mantenha como está e use:

```bash
cd /home/dcastilho/nightscout-modern
docker-compose up -d
```

**Vantagens:**
- ✅ Separação de responsabilidades
- ✅ Mais fácil de versionar e manter
- ✅ Pode rebuildar sem afetar outros serviços
- ✅ Mais fácil de compartilhar/documentar

## Opção 2: Adicionar ao Docker Compose Principal

Se preferir ter tudo em um único arquivo, adicione isto ao seu `/home/dcastilho/Docker/docker-compose.yml`:

```yaml
  # ==========================================================================
  # NIGHTSCOUT MODERN
  # ==========================================================================

  nightscout-modern-backend:
    build:
      context: /home/dcastilho/nightscout-modern
      dockerfile: docker/Dockerfile.backend
    container_name: nightscout-modern-backend
    hostname: nightscout-modern-backend
    restart: unless-stopped

    labels:
      - "com.docker.compose.project=homelab"
      - "service.group=health"
      - "service.type=api"
      - "service.description=Nightscout Modern Backend API"

    networks:
      macvlan:
        ipv4_address: 10.0.0.229

    dns:
      - 10.0.0.4

    environment:
      NODE_ENV: production
      PORT: 3001
      TZ: ${TZ:-America/Sao_Paulo}
      MONGODB_URI: mongodb://10.0.0.225:27017
      MONGODB_DB_NAME: nightscout
      MONGODB_USER: ${MONGODB_USER}
      MONGODB_PASSWORD: ${MONGODB_PASSWORD}
      API_SECRET: ${NIGHTSCOUT_API_SECRET}
      JWT_SECRET: ${NIGHTSCOUT_MODERN_JWT_SECRET}
      JWT_EXPIRES_IN: 7d
      CORS_ORIGIN: http://10.0.0.231,https://nightscout-modern.diegocastilho.me
      LIBRELINK_USERNAME: ${LIBRELINK_USERNAME}
      LIBRELINK_PASSWORD: ${LIBRELINK_PASSWORD}
      LIBRELINK_REGION: LA
      LOG_LEVEL: info

    deploy:
      resources:
        limits:
          memory: 2048M
          cpus: '0.5'

    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nightscout-modern-frontend:
    build:
      context: /home/dcastilho/nightscout-modern
      dockerfile: docker/Dockerfile.frontend
      args:
        - VITE_API_URL=http://10.0.0.229:3001/api
        - VITE_WS_URL=ws://10.0.0.229:3001
    container_name: nightscout-modern-frontend
    hostname: nightscout-modern-frontend
    restart: unless-stopped

    labels:
      - "com.docker.compose.project=homelab"
      - "service.group=health"
      - "service.type=web"
      - "service.description=Nightscout Modern Frontend"

    networks:
      macvlan:
        ipv4_address: 10.0.0.231

    dns:
      - 10.0.0.4

    environment:
      TZ: ${TZ:-America/Sao_Paulo}

    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.25'

    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Variáveis de Ambiente

Adicione ao seu `.env` principal:

```bash
# Nightscout Modern
NIGHTSCOUT_MODERN_JWT_SECRET=seu-jwt-secret-aqui
```

## Build e Start

```bash
cd /home/dcastilho/Docker
docker-compose up -d nightscout-modern-backend nightscout-modern-frontend
```

## Manutenção

```bash
# Ver logs
docker-compose logs -f nightscout-modern-backend

# Restart
docker-compose restart nightscout-modern-backend nightscout-modern-frontend

# Rebuild após mudanças
docker-compose up -d --build nightscout-modern-backend
```

## 📌 Nota Importante

Se optar por integrar ao compose principal, lembre-se:
- Os caminhos de `context:` devem apontar para `/home/dcastilho/nightscout-modern`
- Você precisa fazer `docker-compose build` sempre que houver mudanças no código
- O arquivo `.env` deve estar em `/home/dcastilho/Docker/.env`

## Recomendação Final

Para desenvolvimento ativo, use o arquivo separado. Quando o projeto estiver estável e em produção, pode migrar para o compose principal.
