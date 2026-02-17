# Nightscout Modern

Interface moderna, responsiva e rica em recursos para monitoramento contínuo de glicose (CGM), construída sobre o banco de dados MongoDB do Nightscout existente.

> **v0.2-beta** — Dashboard interativo completo com gráficos, dark mode e seletor de período.

---

## Características

### Implementado ✅

**Backend**
- Node.js 20 + Express + TypeScript
- Acesso direto ao MongoDB do Nightscout (banco `test`)
- API REST completa (glucose, analytics, patterns)
- Analytics engine:
  - Estatísticas: média, mediana, desvio padrão, mín/máx
  - GMI (Glucose Management Indicator)
  - Estimativa de HbA1c
  - Coeficiente de Variação (CV%)
  - Time in Range — 5 faixas com metas internacionais (TIR/TAR/TBR)
  - Padrões diários por hora (P5/P25/P75/P95)
  - Detecção automática de padrões:
    - Fenômeno do alvorecer
    - Hipoglicemia noturna
    - Alta variabilidade
    - Pico pós-prandial

**Frontend**
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- PWA com Service Worker e cache offline
- Dark mode persistido (toggle no header)
- Seletor de período: 1h · 3h · 6h · 12h · 24h · 7d · 14d · 30d
- Auto-refresh a cada 5 minutos

**Gráficos**

| Gráfico | Descrição |
|---------|-----------|
| **Leituras de Glicose** | AreaChart com gradiente dinâmico por zona TIR. Eixo X com ticks configurados por período. Tooltip com valor, seta de tendência e horário. |
| **Tempo no Alvo (TIR)** | Barra horizontal empilhada + tabela com metas internacionais, tempo/dia real e indicadores ✓/✗. |
| **Padrão Diário (AGP)** | Bandas de percentil P5–P25–P75–P95 + linha de mediana. Para ≤ 24h: timeline das últimas 24h com horas fora do período sombreadas. Para 7d+: padrão AGP clássico (00:00–23:00) com dados do período selecionado. |
| **Cartão de Glicose Atual** | Valor em destaque (7xl) com cor por zona, seta de tendência, delta, badge de status e alerta de dados antigos. |
| **Grid de Estatísticas** | 4 cards: Média · GMI · A1c Estimada · CV% com semáforo verde/amarelo/vermelho. |
| **Alertas de Padrões** | Cards de alerta para padrões detectados com severidade (baixa/média/alta). |

### Em Desenvolvimento 🚧

- Alarmes sonoros / Push Notifications (PWA)
- Página de configurações (targets, unidades, nome)
- Relatório PDF estilo AGP
- Comparação de períodos
- Zoom/pan no gráfico de glicose
- Integração Claude AI via MCP LibreLink

---

## Arquitetura

```
┌─────────────────────────────────────┐
│  Frontend (React + TypeScript)      │
│  - Dashboard em tempo real          │
│  - 4 gráficos Recharts              │
│  - PWA / Service Worker             │
│  Nginx  →  http://10.0.0.231        │
└────────────┬────────────────────────┘
             │ REST API
┌────────────▼────────────────────────┐
│  Backend (Node.js + Express)        │
│  - API REST endpoints               │
│  - Analytics engine                 │
│  Node.js  →  http://10.0.0.229:3001 │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  MongoDB  10.0.0.225:27017          │
│  database: test (Nightscout)        │
│  - entries (glucose readings)       │
│  - treatments                       │
│  - devicestatus                     │
└─────────────────────────────────────┘
```

**Rede:** MacVLAN — cada container tem IP próprio na rede local.

---

## Quick Start

### Pré-requisitos
- Docker e Docker Compose
- Nightscout rodando com MongoDB acessível
- Node.js 20+ (apenas para desenvolvimento local)

### Deploy com Docker

```bash
# 1. Clone
git clone https://github.com/diego-castilho/nightscout-modern.git
cd nightscout-modern

# 2. Configure as variáveis de ambiente
cp backend/.env.example backend/.env
# edite backend/.env com suas configurações

# 3. Build e start
docker compose build
docker compose up -d

# 4. Verifique os logs
docker compose logs -f
```

**Acesso:**
- Frontend: `http://10.0.0.231`
- Backend API: `http://10.0.0.229:3001/api`
- Health check: `http://10.0.0.229:3001/api/health`

### Desenvolvimento Local

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (outro terminal)
cd frontend && npm install && npm run dev
```

---

## API Endpoints

### Saúde e Stats
```
GET /api/health          — Health check
GET /api/stats           — Estatísticas do banco de dados
```

### Glicose
```
GET /api/glucose         — Leituras com filtros (startDate, endDate, limit)
GET /api/glucose/latest  — Leitura mais recente
GET /api/glucose/range   — Leituras em intervalo de datas
```

### Analytics
```
GET /api/analytics               — Relatório completo (stats + TIR + padrões)
GET /api/analytics/stats         — Estatísticas de glicose
GET /api/analytics/tir           — Time in Range
GET /api/analytics/patterns      — Padrões diários por hora (P5/P25/P75/P95)
GET /api/analytics/detect        — Detecção de padrões glicêmicos
```

**Parâmetros:** todos os endpoints de analytics aceitam `startDate` e `endDate` (ISO 8601).

```bash
# Exemplo: analytics das últimas 24h
curl "http://10.0.0.229:3001/api/analytics?startDate=2025-01-01T00:00:00Z&endDate=2025-01-02T00:00:00Z"

# Última leitura
curl http://10.0.0.229:3001/api/glucose/latest
```

---

## Zonas TIR (Time in Range)

| Zona | Faixa | Cor | Meta Internacional |
|------|-------|-----|-------------------|
| Muito Alto | > 250 mg/dL | Vermelho | < 5% |
| Alto | 180–250 mg/dL | Âmbar | < 25% |
| **Alvo** | **70–180 mg/dL** | **Verde** | **> 70%** |
| Baixo | 54–70 mg/dL | Laranja | < 4% |
| Muito Baixo | < 54 mg/dL | Vermelho | < 1% |

---

## Stack Tecnológica

### Backend
| | |
|-|-|
| Runtime | Node.js 20 |
| Framework | Express.js |
| Linguagem | TypeScript |
| Banco de Dados | MongoDB (driver nativo) |
| Validação | Zod |

### Frontend
| | |
|-|-|
| Framework | React 18 |
| Build | Vite 5 |
| Linguagem | TypeScript |
| Estilos | Tailwind CSS + shadcn/ui |
| Gráficos | Recharts 2 |
| Estado Global | Zustand (com persist) |
| HTTP | Axios |
| Datas | date-fns (pt-BR) |
| PWA | vite-plugin-pwa |

### DevOps
| | |
|-|-|
| Containerização | Docker |
| Orquestração | Docker Compose |
| Web Server | Nginx (frontend) |
| Rede | MacVLAN |

---

## Roadmap

### Fase 1 — Fundação ✅
- Backend + API REST
- MongoDB integration
- Analytics engine

### Fase 2 — Dashboard Core ✅
- Gráfico de glicose (AreaChart com gradiente TIR)
- Time in Range (barra + tabela)
- Padrão Diário AGP (bandas de percentil)
- Cards de métricas (Média, GMI, A1c, CV%)
- Seletor de período (1h a 30d)
- Dark mode persistido
- PWA / Service Worker
- Detecção de padrões (alertas)
- Auto-refresh a 5 min

### Fase 3 — Notificações (próximo)
- Alarmes sonoros (hipo/hiper)
- Push Notifications via PWA
- Thresholds configuráveis

### Fase 4 — Configurações
- Página de settings (targets, unidades, perfil)
- Suporte mmol/L

### Fase 5 — Relatórios
- PDF estilo AGP
- Resumo semanal
- Export CSV

### Fase 6 — Integrações
- Claude AI via MCP LibreLink
- Dados de loop (AndroidAPS / Loop)

---

## Licença

MIT — Diego Castilho

## Links

- [Nightscout Project](https://nightscout.github.io/)
- [GitHub](https://github.com/diego-castilho/nightscout-modern)
