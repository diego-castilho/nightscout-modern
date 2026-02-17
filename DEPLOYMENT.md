# 🚀 Nightscout Modern - Deployment Status

## ✅ Sistema Rodando com Sucesso!

**Data de Deploy:** 16/02/2026 20:35 BRT

### 📍 Endereços

| Serviço | IP | URL | Status |
|---------|-------|-----|--------|
| **Backend API** | 10.0.0.229:3001 | http://10.0.0.229:3001/api | ✅ Healthy |
| **Frontend Web** | 10.0.0.231 | http://10.0.0.231 | ✅ Running |

### 🌐 Como Acessar

#### De outro dispositivo na rede (celular, tablet, outro computador):
```bash
# Frontend (interface web)
http://10.0.0.231

# Backend API (para testes)
http://10.0.0.229:3001/api/health
```

#### Do próprio host Docker:
⚠️ **Limitação do MacVLAN**: O host não consegue acessar diretamente containers na rede MacVLAN.

**Opções:**
1. Acesse de outro dispositivo na mesma rede
2. Use o Cloudflare Tunnel (já configurado)
3. Teste via outro container: `docker exec nightscout-modern-backend wget -qO- http://10.0.0.231`

### 🧪 Testes Rápidos

```bash
# Testar backend API
curl http://10.0.0.229:3001/api/health

# Testar stats do banco de dados
curl http://10.0.0.229:3001/api/stats

# Testar última glicose
curl http://10.0.0.229:3001/api/glucose/latest

# Ver logs
docker compose logs -f nightscout-modern-backend
docker compose logs -f nightscout-modern-frontend
```

### 📊 Endpoints Disponíveis

#### Health & Stats
- `GET /api/health` - Health check
- `GET /api/stats` - Database statistics

#### Glucose
- `GET /api/glucose` - Lista de glicemias
- `GET /api/glucose/latest` - Última leitura
- `GET /api/glucose/range?startDate=...&endDate=...` - Range de datas

#### Analytics
- `GET /api/analytics?startDate=...&endDate=...` - Análise completa
- `GET /api/analytics/stats?startDate=...&endDate=...` - Estatísticas
- `GET /api/analytics/tir?startDate=...&endDate=...` - Time in Range
- `GET /api/analytics/patterns?startDate=...&endDate=...` - Padrões diários
- `GET /api/analytics/detect?startDate=...&endDate=...` - Detecção de padrões

### ⚙️ Gerenciamento

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

# Rebuild após mudanças
docker compose build
docker compose up -d --force-recreate
```

### 🔧 Cloudflare Tunnel (Acesso Externo)

Para acessar de qualquer lugar, adicione ao seu tunnel:

```yaml
ingress:
  - hostname: nightscout-modern.diegocastilho.me
    service: http://10.0.0.231

  - hostname: nightscout-api.diegocastilho.me
    service: http://10.0.0.229:3001
```

E atualize o CORS no backend (`.env`):
```bash
CORS_ORIGIN=http://10.0.0.231,https://nightscout-modern.diegocastilho.me
```

### ⚠️ Notas Importantes

1. **MongoDB Change Streams**: Desabilitados porque o MongoDB não está em replica set. Updates em tempo real funcionarão via polling manual (refresh).

2. **Acesso do Host**: Por limitação do MacVLAN, o host não consegue acessar diretamente os IPs 10.0.0.229 e 10.0.0.231. Acesse de outro dispositivo ou via Cloudflare Tunnel.

3. **Segurança**: Certifique-se de configurar o `.env` com secrets seguros:
   - `NIGHTSCOUT_API_SECRET`
   - `NIGHTSCOUT_MODERN_JWT_SECRET`

### 📱 PWA (Progressive Web App)

O frontend é um PWA! Você pode instalar como app no celular:
1. Acesse http://10.0.0.231 no celular
2. Menu do navegador → "Adicionar à tela inicial"
3. Use como app nativo!

### 🎯 Próximas Features (Roadmap)

- [ ] Gráficos interativos (Recharts)
- [ ] Integração Claude AI (MCP)
- [ ] Dark mode completo
- [ ] Push notifications
- [ ] Export PDF/Excel
- [ ] AGP (Ambulatory Glucose Profile)

---

**Stack:**
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- Backend: Node.js 20 + Express + TypeScript
- Database: MongoDB (Nightscout existing)
- Deploy: Docker + MacVLAN network
