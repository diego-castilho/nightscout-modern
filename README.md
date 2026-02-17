# Nightscout Modern

Interface moderna, responsiva e rica em recursos para monitoramento contínuo de glicose (CGM), construída sobre o banco de dados MongoDB do Nightscout existente.

> **v0.4** — Dashboard completo com configurações, alertas visuais, conversão de unidades e thresholds configuráveis.

---

## Características

### Implementado ✅

**Backend**
- Node.js 20 + Express + TypeScript
- Acesso direto ao MongoDB do Nightscout (banco `test`)
- API REST completa (glucose, analytics, patterns, settings)
- Persistência de configurações no servidor (compartilhada entre dispositivos)
- Analytics engine:
  - Estatísticas: média, mediana, desvio padrão, mín/máx
  - GMI (Glucose Management Indicator)
  - Estimativa de HbA1c
  - Coeficiente de Variação (CV%)
  - Time in Range — 5 faixas com thresholds configuráveis
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
- Auto-refresh configurável (1 · 2 · 5 · 10 · 15 · 30 min)
- Suporte a mg/dL e mmol/L com conversão em tempo real
- Página de configurações completa
- Alertas visuais com cooldown de 15 min por zona

**Gráficos**

| Gráfico | Descrição |
|---------|-----------|
| **Leituras de Glicose** | AreaChart com gradiente dinâmico por zona TIR. Eixo X com ticks configurados por período. Tooltip com valor, seta de tendência e horário. Linhas de referência nos thresholds configurados. |
| **Tempo no Alvo (TIR)** | Barra horizontal empilhada + tabela com metas internacionais, tempo/dia real e indicadores ✓/✗. Cálculo usa thresholds configurados pelo usuário. |
| **Padrão Diário (AGP)** | Bandas de percentil P5–P25–P75–P95 + linha de mediana. Para ≤ 24h: timeline das últimas 24h com horas fora do período sombreadas. Para 7d+: padrão AGP clássico (00:00–23:00) com dados do período selecionado. Linhas de referência dinâmicas. |
| **Cartão de Glicose Atual** | Valor em destaque (7xl) com cor por zona, seta de tendência, delta, badge de status e alerta de dados antigos. Suporte a mg/dL e mmol/L. |
| **Grid de Estatísticas** | 4 cards: Média · GMI · A1c Estimada · CV% com semáforo verde/amarelo/vermelho. |
| **Alertas de Padrões** | Cards de alerta para padrões detectados com severidade (baixa/média/alta). |

**Configurações**

| Configuração | Descrição |
|-------------|-----------|
| Nome do paciente | Exibido no cabeçalho do dashboard |
| Unidade de glicose | mg/dL ou mmol/L com conversão automática |
| Auto-refresh | Intervalo configurável de 1 a 30 minutos |
| Faixas limites | Thresholds de Muito Baixo / Baixo / Alto / Muito Alto (afeta todos os gráficos e alertas) |

---

### Em Desenvolvimento 🚧

- Alarmes sonoros / Push Notifications (PWA)
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
│  - Gráficos Recharts                │
│  - PWA / Service Worker             │
│  Nginx  →  http://10.0.0.231        │
└────────────┬────────────────────────┘
             │ REST API
┌────────────▼────────────────────────┐
│  Backend (Node.js + Express)        │
│  - API REST endpoints               │
│  - Analytics engine                 │
│  - Persistência de settings         │
│  Node.js  →  http://10.0.0.229:3001 │
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  MongoDB  10.0.0.225:27017          │
│  database: test (Nightscout)        │
│  - entries (glucose readings)       │
│  - treatments                       │
│  - devicestatus                     │
│  - nightscout_modern_settings       │
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

Todos os endpoints aceitam `startDate` e `endDate` (ISO 8601).
Os endpoints de analytics também aceitam thresholds opcionais: `veryLow`, `low`, `high`, `veryHigh` (mg/dL).

```
GET /api/analytics               — Relatório completo (stats + TIR + padrões)
GET /api/analytics/stats         — Estatísticas de glicose
GET /api/analytics/tir           — Time in Range
GET /api/analytics/patterns      — Padrões diários por hora (P5/P25/P75/P95)
GET /api/analytics/detect        — Detecção de padrões glicêmicos
```

### Configurações
```
GET /api/settings        — Carregar configurações salvas
PUT /api/settings        — Salvar configurações (unit, patientName, refreshInterval, alarmThresholds)
```

```bash
# Exemplo: analytics com thresholds customizados
curl "http://10.0.0.229:3001/api/analytics?startDate=2025-01-01T00:00:00Z&endDate=2025-01-02T00:00:00Z&veryLow=60&low=80&high=160&veryHigh=240"

# Última leitura
curl http://10.0.0.229:3001/api/glucose/latest

# Salvar configurações
curl -X PUT http://10.0.0.229:3001/api/settings \
  -H "Content-Type: application/json" \
  -d '{"unit":"mmol","patientName":"Diego","refreshInterval":5}'
```

---

## Zonas TIR (Time in Range)

Os limiares abaixo são os padrões internacionais. Todos são configuráveis na página de Configurações.

| Zona | Faixa padrão | Cor | Meta Internacional |
|------|-------------|-----|-------------------|
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
- Auto-refresh configurável

### Fase 3 — Notificações ⚠️ (parcial)
- Alertas visuais com banner (hipo/hiper) ✅
- Thresholds configuráveis ✅
- Alarmes sonoros / Push Notifications (pendente)

### Fase 4 — Configurações ✅
- Página de settings completa
- Suporte mg/dL e mmol/L com conversão em tempo real
- Thresholds configuráveis (afetam todos os gráficos e cálculos TIR)
- Nome do paciente exibido no header
- Intervalo de auto-refresh configurável
- Persistência no servidor (compartilhado entre dispositivos)

### Fase 5 — Relatórios (próximo)
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
