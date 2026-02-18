# Guia de Setup — Nightscout Modern

> **v0.3-beta** — Dashboard completo com gráficos interativos (zoom/pan), AGP clínico, comparação de períodos e TIR configurável.

## Pré-requisitos

- Docker e Docker Compose instalados
- Nightscout rodando com MongoDB acessível na rede
- IP livre na rede local para o backend e outro para o frontend

## Configuração

### 1. Variáveis de ambiente

```bash
cd nightscout-modern
cp backend/.env.example backend/.env
nano backend/.env
```

Variáveis obrigatórias no `backend/.env`:

```bash
# MongoDB do Nightscout (ajuste o IP adequadamente para seu ambiente)
MONGODB_URI=mongodb://192.168.1.100:27017
MONGODB_DB_NAME=nightscout                  # banco padrão do Nightscout
MONGODB_USER=                               # deixe vazio se sem auth
MONGODB_PASSWORD=

# Segredos
API_SECRET=seu-api-secret-do-nightscout
JWT_SECRET=qualquer-string-aleatoria-longa

# CORS — IP/domínio do frontend (ajuste para seu ambiente)
CORS_ORIGIN=http://192.168.1.11
```

O frontend não precisa de `.env` próprio — o IP do backend é fixado em tempo de build via `docker-compose.yml`.

### 2. Ajustar IPs no docker-compose.yml

Abra `docker-compose.yml` e edite os IPs MacVLAN conforme sua rede (ajuste os IPs adequadamente para seu ambiente):

```yaml
nightscout-modern-backend:
  networks:
    macvlan:
      ipv4_address: 192.168.1.10   # ← seu IP livre para o backend

nightscout-modern-frontend:
  build:
    args:
      VITE_API_URL: http://192.168.1.10:3001/api   # ← IP do backend acima
  networks:
    macvlan:
      ipv4_address: 192.168.1.11   # ← seu IP livre para o frontend
```

### 3. Build e start

```bash
docker compose build
docker compose up -d
docker compose logs -f          # acompanhe os logs
```

### 4. Verificar

```bash
# Backend saudável
curl http://192.168.1.10:3001/api/health

# Última leitura de glicose
curl http://192.168.1.10:3001/api/glucose/latest

# Configurações (unit, patientName, thresholds)
curl http://192.168.1.10:3001/api/settings
```

Acesse o frontend pelo browser: `http://192.168.1.11`

As configurações (unidade, nome do paciente, thresholds) podem ser ajustadas na página **Configurações** do dashboard e são persistidas no MongoDB — compartilhadas entre todos os dispositivos.

---

## Desenvolvimento Local

```bash
# Backend (porta 3001)
cd backend
npm install
npm run dev

# Frontend (porta 5173) — em outro terminal
cd frontend
npm install
npm run dev
```

O frontend em dev aponta para `http://localhost:3001` por padrão (configurado no `frontend/.env.development`).

---

## Atualizar após mudanças no código

```bash
# Rebuild apenas o frontend (mais comum)
cd frontend && npm run build
docker compose build nightscout-modern-frontend
docker compose up -d --force-recreate nightscout-modern-frontend

# Rebuild o backend
docker compose build nightscout-modern-backend
docker compose up -d --force-recreate nightscout-modern-backend

# Rebuild tudo
docker compose build && docker compose up -d
```

---

## Troubleshooting

### Container não sobe

```bash
docker compose logs nightscout-modern-backend
docker compose logs nightscout-modern-frontend
```

### Erro de conexão ao MongoDB

```bash
# Entre no container e teste a conexão
docker exec -it nightscout-modern-backend sh
wget -O- http://192.168.1.100:27017
```

Verifique:
- MongoDB está rodando: `docker ps | grep mongo`
- `MONGODB_URI` está correto no `.env`
- IP do MongoDB está acessível na rede

### Frontend não carrega dados

```bash
# Teste o backend diretamente
curl http://192.168.1.10:3001/api/health

# Verifique se o CORS_ORIGIN inclui o IP do frontend
# Verifique o console do browser (F12 → Network)
```

### IPs em conflito

1. Edite `docker-compose.yml` com IPs livres na sua rede
2. Atualize `CORS_ORIGIN` no `backend/.env`
3. Atualize `VITE_API_URL` no `args` do build do frontend
4. Rebuild completo: `docker compose down && docker compose build && docker compose up -d`

---

## Cloudflare Tunnel (acesso externo)

Adicione ao seu tunnel:

```yaml
ingress:
  - hostname: nightscout-modern.seudominio.com
    service: http://192.168.1.11
```

Atualize o `CORS_ORIGIN` no `backend/.env`:

```bash
CORS_ORIGIN=http://192.168.1.11,https://nightscout-modern.seudominio.com
```

Rebuild o backend:

```bash
docker compose up -d --build nightscout-modern-backend
```

---

## Comandos úteis

```bash
# Status dos containers
docker compose ps

# Logs em tempo real
docker compose logs -f

# Reiniciar um serviço
docker compose restart nightscout-modern-frontend

# Parar tudo
docker compose down

# Parar e remover volumes
docker compose down -v
```
