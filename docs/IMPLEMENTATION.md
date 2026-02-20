# Guia de Implementação — Nightscout Modern

Guia completo para colocar o Nightscout Modern em produção a partir do zero.

---

## Pré-requisitos

- **Docker** e **Docker Compose** v2+ instalados no host
- **Nightscout** rodando com MongoDB acessível na rede local
- **Dois IPs livres** na rede local (um para backend, um para frontend)
- Node.js 20+ (apenas para desenvolvimento local)

---

## 1. Clone e configuração inicial

```bash
git clone https://github.com/diego-castilho/nightscout-modern.git
cd nightscout-modern
```

---

## 2. Variáveis de ambiente

Crie o arquivo `.env` na raiz (ou em `backend/.env` se preferir):

```bash
cp .env.example .env
```

Edite `.env` com suas configurações:

```env
# ── MongoDB ─────────────────────────────────────────────────────────────────
MONGODB_URI=mongodb://192.168.1.100:27017   # IP do seu MongoDB
MONGODB_DB_NAME=nightscout                  # banco padrão do Nightscout
MONGODB_USER=                               # vazio se sem autenticação
MONGODB_PASSWORD=

# ── Segurança ────────────────────────────────────────────────────────────────
API_SECRET=sua_senha_de_acesso              # senha para login no dashboard
JWT_SECRET=string-aleatoria-longa-aqui     # segredo para assinatura JWT
JWT_EXPIRES_IN=7d                           # duração do token (ex: 1d, 7d, 30d)

# ── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGIN=http://192.168.1.11             # IP do container frontend
```

> **Dica de segurança:** use `openssl rand -base64 32` para gerar o `JWT_SECRET`.

---

## 3. Configurar IPs no docker-compose.yml

Abra `docker-compose.yml` e ajuste os IPs MacVLAN para IPs **livres** na sua rede:

```yaml
# Backend
nightscout-modern-backend:
  build:
    args:
      # Não há build arg no backend
  networks:
    macvlan_net:
      ipv4_address: 192.168.1.10    # ← IP livre para o backend

# Frontend
nightscout-modern-frontend:
  build:
    args:
      VITE_API_URL: http://192.168.1.10:3001/api   # ← deve apontar para o backend acima
  networks:
    macvlan_net:
      ipv4_address: 192.168.1.11    # ← IP livre para o frontend
```

> Consulte a referência de IPs da sua rede com `ip route` ou pelo roteador.

---

## 4. Build e deploy

```bash
# Build das imagens
docker compose build

# Start com MacVLAN (OBRIGATÓRIO — sem o override os containers ficam
# na rede bridge e não alcançam o MongoDB externo)
docker compose -f docker-compose.yml -f docker-compose.macvlan.yml up -d

# Acompanhar logs
docker compose logs -f
```

Aguarde o health check do backend ficar `healthy` antes de acessar o frontend.

---

## 5. Verificação

```bash
# Health check do backend
curl http://192.168.1.10:3001/api/health
# Esperado: {"status":"ok","timestamp":"..."}

# Última leitura de glicose
curl http://192.168.1.10:3001/api/glucose/latest
# Esperado: { "success": true, "data": { "sgv": 120, ... } }
```

Acesse o frontend pelo navegador:
```
http://192.168.1.11     → redireciona para /login
```

Faça login com a senha definida em `API_SECRET`.

---

## 6. Configurações pós-deploy

Nas **Configurações** do dashboard (`/settings`) ajuste:

| Campo | Descrição |
|-------|-----------|
| Nome do paciente | Exibido no cabeçalho |
| Unidade | mg/dL ou mmol/L |
| Faixas TIR | Muito Baixo / Baixo / Alto / Muito Alto |
| DIA | Duration of Insulin Action (h) — para cálculo de IOB |
| Taxa basal | U/h da bomba (0 para MDI) |
| ISF | Insulin Sensitivity Factor (mg/dL por U) |
| ICR | Insulin-to-Carb Ratio (g por U) |
| Passo da caneta | 1 U ou 0,5 U |

As configurações são persistidas no MongoDB e **compartilhadas entre todos os dispositivos**.

---

## 7. PWA — Instalação no celular

1. Acesse `http://192.168.1.11` no navegador do celular
2. Menu do navegador → **"Adicionar à tela inicial"** (ou "Instalar app")
3. Abra pelo ícone como app nativo — funciona com cache offline

---

## Desenvolvimento local

Para desenvolver sem Docker:

```bash
# Terminal 1 — Backend (porta 3001)
cd backend
npm install
cp .env.example .env   # edite com suas configurações
npm run dev

# Terminal 2 — Frontend (porta 5173)
cd frontend
npm install
npm run dev
```

O frontend em dev aponta para `http://localhost:3001` por padrão (`frontend/.env.development`).

Para fazer build do frontend e verificar TypeScript:
```bash
npm run build --prefix frontend
```

---

## Atualizar após mudanças no código

```bash
# Rebuild completo (recomendado após mudanças significativas)
docker compose build --no-cache
docker compose -f docker-compose.yml -f docker-compose.macvlan.yml up -d

# Rebuild seletivo — apenas frontend
docker compose build nightscout-modern-frontend
docker compose -f docker-compose.yml -f docker-compose.macvlan.yml up -d --force-recreate nightscout-modern-frontend

# Rebuild seletivo — apenas backend
docker compose build nightscout-modern-backend
docker compose -f docker-compose.yml -f docker-compose.macvlan.yml up -d --force-recreate nightscout-modern-backend
```

---

## Comandos úteis

```bash
# Status dos containers
docker compose ps

# Logs em tempo real (todos os serviços)
docker compose logs -f

# Logs de um serviço específico
docker compose logs -f nightscout-modern-backend

# Reiniciar um serviço
docker compose restart nightscout-modern-frontend

# Parar todos os containers
docker compose down

# Parar e remover volumes
docker compose down -v
```

---

## Acesso externo — Cloudflare Tunnel

Para acessar de fora da rede local:

```yaml
# ~/.cloudflared/config.yml
ingress:
  - hostname: nightscout-modern.seudominio.com
    service: http://192.168.1.11
  - service: http_status:404
```

Atualize `CORS_ORIGIN` no `.env` para incluir o domínio externo:

```bash
CORS_ORIGIN=http://192.168.1.11,https://nightscout-modern.seudominio.com
```

Rebuild o backend após alterar:
```bash
docker compose build nightscout-modern-backend
docker compose -f docker-compose.yml -f docker-compose.macvlan.yml up -d --force-recreate nightscout-modern-backend
```

---

## Integrar ao docker-compose principal (opcional)

Se preferir consolidar todos os serviços num único compose:

```yaml
# Adicione ao seu docker-compose.yml principal

  nightscout-modern-backend:
    build:
      context: /caminho/para/nightscout-modern
      dockerfile: docker/Dockerfile.backend
    container_name: nightscout-modern-backend
    env_file: /caminho/para/nightscout-modern/.env
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  nightscout-modern-frontend:
    build:
      context: /caminho/para/nightscout-modern
      dockerfile: docker/Dockerfile.frontend
      args:
        VITE_API_URL: http://192.168.1.10:3001/api
    container_name: nightscout-modern-frontend
    depends_on:
      nightscout-modern-backend:
        condition: service_healthy
    restart: unless-stopped
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
# Entre no container e teste a conectividade
docker exec -it nightscout-modern-backend sh
wget -qO- http://192.168.1.100:27017
```

Verifique:
- MongoDB está rodando: `docker ps | grep mongo`
- `MONGODB_URI` está correto no `.env`
- A rede MacVLAN está configurada (está usando o override `-f docker-compose.macvlan.yml`?)

### Frontend não carrega dados / erro de CORS

```bash
# Teste o backend diretamente
curl http://192.168.1.10:3001/api/health

# Verifique o console do browser (F12 → Network → ver resposta do /api/*)
```

- `CORS_ORIGIN` deve incluir exatamente o endereço pelo qual você acessa o frontend
- `VITE_API_URL` no `docker-compose.yml` deve apontar para o IP correto do backend
- Qualquer mudança nestas variáveis exige rebuild

### IPs em conflito

1. Identifique IPs livres: `nmap -sn 192.168.1.0/24` (ajuste para sua faixa)
2. Edite `docker-compose.yml` com os novos IPs
3. Atualize `CORS_ORIGIN` e `VITE_API_URL`
4. Rebuild completo: `docker compose down && docker compose build && docker compose -f docker-compose.yml -f docker-compose.macvlan.yml up -d`

### Host não acessa os containers

Limitação do MacVLAN: o host Docker não acessa diretamente IPs MacVLAN. Alternativas:
1. Acesse de outro dispositivo na mesma rede (celular, outro computador)
2. Use Cloudflare Tunnel para acesso externo
3. Teste via container: `docker exec nightscout-modern-backend wget -qO- http://192.168.1.11`

### Login retorna 429 (Too Many Requests)

Rate limiting ativo: 5 tentativas por 15 minutos por IP. Aguarde 15 minutos ou reinicie o backend para resetar o contador.
