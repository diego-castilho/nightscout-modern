# Nightscout Modern - Guia de Deployment

> Ajuste os IPs adequadamente para seu ambiente. Os exemplos abaixo usam a faixa `192.168.1.0/24` como referência.

---

## Endereços de referência

| Serviço | IP de exemplo | URL |
|---------|---------------|-----|
| **MongoDB** | 192.168.1.100:27017 | — (acesso interno) |
| **Backend API** | 192.168.1.10:3001 | http://192.168.1.10:3001/api |
| **Frontend Web** | 192.168.1.11 | http://192.168.1.11 |

Estes IPs são apenas exemplos. Defina IPs livres na sua rede local e ajuste:
- `docker-compose.yml` (campos `ipv4_address`)
- `backend/.env` (`MONGODB_URI`, `CORS_ORIGIN`)
- `docker-compose.yml` build arg `VITE_API_URL`

---

## Como Acessar

### De outro dispositivo na rede (celular, tablet, outro computador):
```bash
# Frontend (interface web)
http://192.168.1.11

# Backend API (para testes)
http://192.168.1.10:3001/api/health
```

### Do próprio host Docker:
> **Limitação do MacVLAN**: O host não consegue acessar diretamente containers na rede MacVLAN.

Opções:
1. Acesse de outro dispositivo na mesma rede
2. Use acesso externo via Cloudflare Tunnel
3. Teste via outro container: `docker exec nightscout-modern-backend wget -qO- http://192.168.1.11`

---

## Testes Rápidos

```bash
# Health check
curl http://192.168.1.10:3001/api/health

# Stats do banco de dados
curl http://192.168.1.10:3001/api/stats

# Última glicose
curl http://192.168.1.10:3001/api/glucose/latest

# Analytics das últimas 24h com thresholds customizados
curl "http://192.168.1.10:3001/api/analytics?startDate=$(date -u -d '24 hours ago' +%FT%TZ)&endDate=$(date -u +%FT%TZ)&veryLow=54&low=70&high=180&veryHigh=250"

# Configurações salvas
curl http://192.168.1.10:3001/api/settings

# Ver logs
docker compose logs -f nightscout-modern-backend
docker compose logs -f nightscout-modern-frontend
```

---

## Endpoints Disponíveis

### Health & Stats
- `GET /api/health` — Health check
- `GET /api/stats` — Database statistics

### Glucose
- `GET /api/glucose` — Lista de glicemias (`startDate`, `endDate`, `limit`)
- `GET /api/glucose/latest` — Última leitura
- `GET /api/glucose/range` — Range de datas

### Analytics
Todos aceitam `startDate`, `endDate` (ISO 8601) e opcionalmente `veryLow`, `low`, `high`, `veryHigh` (mg/dL):

- `GET /api/analytics` — Análise completa (stats + TIR + padrões)
- `GET /api/analytics/stats` — Estatísticas de glicose
- `GET /api/analytics/tir` — Time in Range
- `GET /api/analytics/patterns` — Padrões diários por hora (P5/P25/P75/P95)
- `GET /api/analytics/detect` — Detecção de padrões glicêmicos

### Configurações
- `GET /api/settings` — Carregar configurações
- `PUT /api/settings` — Salvar configurações (`unit`, `patientName`, `refreshInterval`, `alarmThresholds`)

---

## Gerenciamento

```bash
# Ver status
docker compose ps

# Ver logs
docker compose logs -f

# Restart
docker compose restart

# Stop
docker compose down

# Start
docker compose up -d

# Rebuild após mudanças no frontend
docker compose build nightscout-modern-frontend
docker compose up -d --force-recreate nightscout-modern-frontend

# Rebuild após mudanças no backend
docker compose build nightscout-modern-backend
docker compose up -d --force-recreate nightscout-modern-backend

# Rebuild completo
docker compose build && docker compose up -d --force-recreate
```

---

## Cloudflare Tunnel (Acesso Externo)

Adicione ao arquivo de configuração do tunnel:

```yaml
ingress:
  - hostname: nightscout-modern.seudominio.com
    service: http://192.168.1.11
```

Backend `.env`:
```bash
CORS_ORIGIN=http://192.168.1.11,https://nightscout-modern.seudominio.com
```

Rebuild o backend após alterar:
```bash
docker compose build nightscout-modern-backend
docker compose up -d --force-recreate nightscout-modern-backend
```

---

## Notas Importantes

1. **MongoDB Change Streams**: Requerem replica set. Em MongoDB standalone, updates em tempo real funcionam via polling a cada 30 segundos (fallback automático).

2. **Acesso do Host**: Por limitação do MacVLAN, o host não acessa diretamente os IPs dos containers. Use outro dispositivo na rede ou o Cloudflare Tunnel.

3. **Configurações multi-dispositivo**: As configurações (thresholds, unidade, nome) são persistidas no MongoDB e compartilhadas entre todos os dispositivos que acessam o dashboard.

4. **Segurança**: Secrets no `backend/.env`:
   - `API_SECRET` — igual ao Nightscout API Secret
   - `JWT_SECRET` — string aleatória longa

5. **Índice automático**: Na primeira inicialização o backend cria o índice `{type, date}` na coleção `entries` para acelerar queries de analytics. É uma operação idempotente (seguro executar novamente).

---

## PWA (Progressive Web App)

O frontend é um PWA instalável no celular:
1. Acesse `http://192.168.1.11` (ou seu domínio externo) no celular
2. Menu do navegador → "Adicionar à tela inicial"
3. Use como app nativo com cache offline

---

## Stack

- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- Backend: Node.js 20 + Express + TypeScript
- Database: MongoDB (Nightscout existente)
- Deploy: Docker + MacVLAN + Cloudflare Tunnel (opcional)
