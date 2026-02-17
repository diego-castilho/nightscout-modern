# 🩺 Nightscout Modern

Uma interface moderna, responsiva e rica em recursos para monitoramento contínuo de glicose (CGM) usando Nightscout.

## ✨ Características

### Implementado ✅
- ✅ Backend Node.js + Express + TypeScript
- ✅ MongoDB direto (acesso otimizado aos dados)
- ✅ Frontend React 18 + TypeScript + Vite
- ✅ Tailwind CSS + shadcn/ui
- ✅ API REST completa
- ✅ WebSocket para updates em tempo real
- ✅ Analytics avançado:
  - Estatísticas de glicose (média, mediana, desvio padrão)
  - GMI (Glucose Management Indicator)
  - Estimativa de HbA1c
  - Coeficiente de Variação (CV%)
  - Time in Range (TIR) detalhado
  - Padrões diários (hourly averages)
  - Detecção automática de padrões (fenômeno do alvorecer, hipoglicemia noturna, etc.)

### Em Desenvolvimento 🚧
- 🚧 Gráficos interativos (Recharts)
- 🚧 Integração Claude AI via MCP LibreLink
- 🚧 PWA (Progressive Web App)
- 🚧 Push Notifications
- 🚧 Exportação PDF/Excel
- 🚧 Visualização de tratamentos (insulina/carboidratos)
- 🚧 AGP (Ambulatory Glucose Profile)

## 🏗️ Arquitetura

```
┌─────────────────────────────────────┐
│  Frontend (React + TypeScript)      │
│  - Dashboard em tempo real          │
│  - Charts e visualizações           │
│  - PWA com Service Worker           │
└────────────┬────────────────────────┘
             │ REST API + WebSocket
┌────────────▼────────────────────────┐
│  Backend (Node.js + Express)        │
│  - API REST endpoints               │
│  - WebSocket server (Socket.io)     │
│  - Analytics engine                 │
│  - MCP LibreLink integration        │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  MongoDB (Nightscout database)      │
│  - entries (glucose readings)       │
│  - treatments (insulin/carbs)       │
│  - devicestatus                     │
└─────────────────────────────────────┘
```

## 🚀 Quick Start

### Pré-requisitos
- Docker e Docker Compose
- Nightscout rodando com MongoDB
- Node.js 20+ (para desenvolvimento local)

### Instalação com Docker (Produção)

1. **Clone o repositório**
   ```bash
   cd /home/dcastilho/nightscout-modern
   ```

2. **Configure as variáveis de ambiente**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```

   Edite os arquivos `.env` com suas configurações.

3. **Build e start**
   ```bash
   docker-compose up -d
   ```

4. **Acesse a aplicação**
   - Frontend: http://10.0.0.231
   - Backend API: http://10.0.0.229:3001/api

### Desenvolvimento Local

#### Backend
```bash
cd backend
npm install
npm run dev
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 📡 API Endpoints

### Health & Stats
- `GET /api/health` - Health check
- `GET /api/stats` - Database statistics

### Glucose Endpoints
- `GET /api/glucose` - Get glucose entries (with filters)
- `GET /api/glucose/latest` - Get latest glucose reading
- `GET /api/glucose/range` - Get glucose in date range

### Analytics Endpoints
- `GET /api/analytics` - Complete analytics report
- `GET /api/analytics/stats` - Glucose statistics only
- `GET /api/analytics/tir` - Time in Range statistics
- `GET /api/analytics/patterns` - Daily patterns (hourly)
- `GET /api/analytics/detect` - Detect glucose patterns

### Exemplo de Request
```bash
# Get latest glucose
curl http://localhost:3001/api/glucose/latest

# Get 24h analytics
curl "http://localhost:3001/api/analytics?startDate=2024-01-20T00:00:00Z&endDate=2024-01-21T00:00:00Z"
```

## 🔌 WebSocket Events

Conecte ao WebSocket para receber updates em tempo real:

```javascript
import io from 'socket.io-client';

const socket = io('ws://localhost:3001');

// New glucose reading
socket.on('glucose:new', (data) => {
  console.log('New glucose:', data);
});

// New treatment
socket.on('treatment:new', (data) => {
  console.log('New treatment:', data);
});

// Device status update
socket.on('deviceStatus:new', (data) => {
  console.log('Device status:', data);
});
```

## 📊 Analytics Explicados

### GMI (Glucose Management Indicator)
Estimativa de HbA1c baseada na média de glicose.
- Fórmula: `GMI = 3.31 + 0.02392 × média_glicose`
- Alvo: < 7.0%

### Coeficiente de Variação (CV%)
Mede a estabilidade glicêmica.
- Fórmula: `CV = (desvio_padrão / média) × 100`
- Alvo: < 36%

### Time in Range (TIR)
Porcentagem de leituras em diferentes faixas:
- **Very Low**: < 54 mg/dL (hipoglicemia grave)
- **Low**: 54-70 mg/dL (hipoglicemia)
- **In Range**: 70-180 mg/dL (alvo ✅)
- **High**: 180-250 mg/dL (hiperglicemia)
- **Very High**: > 250 mg/dL (hiperglicemia grave)

Alvo: **> 70% Time in Range**

## 🛠️ Stack Tecnológica

### Backend
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: MongoDB (driver nativo)
- **WebSocket**: Socket.io
- **Validation**: Zod

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **Charts**: Recharts
- **State**: Zustand
- **HTTP Client**: Axios
- **PWA**: Vite PWA Plugin

### DevOps
- **Containerization**: Docker
- **Orchestration**: Docker Compose
- **Web Server**: Nginx (frontend)
- **Network**: MacVLAN

## 📝 Roadmap

### Fase 1: Fundação ✅ (Completo)
- [x] Setup backend
- [x] Setup frontend
- [x] MongoDB connection
- [x] API REST básica
- [x] Analytics engine

### Fase 2: Dashboard Core 🚧 (Em Progresso)
- [ ] Componente de gráfico principal
- [ ] Time in Range visualization
- [ ] Cards de métricas
- [ ] Filtros de período
- [ ] Dark mode
- [ ] Layout responsivo

### Fase 3: Tempo Real + PWA
- [ ] WebSocket integration
- [ ] Auto-refresh
- [ ] PWA manifest
- [ ] Service Worker
- [ ] Offline caching

### Fase 4: Analytics Avançado
- [ ] Gráficos de distribuição
- [ ] AGP (Ambulatory Glucose Profile)
- [ ] Análise de tratamentos
- [ ] Comparativo de períodos

### Fase 5: Integrações Premium
- [ ] Claude AI via MCP
- [ ] Push Notifications
- [ ] PDF Export
- [ ] Excel Export

### Fase 6: Deploy + Refinamentos
- [ ] Documentação completa
- [ ] Testes automatizados
- [ ] CI/CD pipeline
- [ ] Polimento UI/UX

## 🤝 Contribuindo

Este é um projeto pessoal, mas sugestões e feedback são bem-vindos!

## 📄 Licença

MIT License - Diego Castilho

## 🔗 Links Relacionados

- [Nightscout Project](https://nightscout.github.io/)
- [LibreLink MCP Server](https://github.com/sedoglia/librelink-mcp-server)
