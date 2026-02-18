# Nightscout Modern

Interface moderna, responsiva e rica em recursos para monitoramento contínuo de glicose (CGM), construída sobre o banco de dados MongoDB do Nightscout existente.

> **v0.4-beta** — Dashboard completo com IOB/COB em tempo real, Careportal, Calculadora de Bolus, marcadores de tratamento no gráfico, idades de dispositivos e previsão AR2.

---

## Características

### Implementado ✅

**Backend**
- Node.js 20 + Express + TypeScript
- Acesso direto ao MongoDB do Nightscout (banco `nightscout`)
- API REST completa (glucose, analytics, patterns, settings, treatments)
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
- CRUD completo de tratamentos (com filtros de data e paginação)

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
- Página de histórico de tratamentos (`/treatments`) com filtro e exclusão

**Gráficos**

| Gráfico | Descrição |
|---------|-----------|
| **Leituras de Glicose** | AreaChart com gradiente dinâmico por zona TIR. Zoom via drag horizontal, double-click para resetar. Eixo X e Y adaptam ao intervalo visível. Tooltip com valor, seta de tendência e horário. |
| **Previsão AR2** | Extensão preditiva no gráfico principal baseada no algoritmo AR2 (autoregressivo de ordem 2), com 20–30 min de horizonte. Exibida como linha tracejada com tom mais claro da cor da zona atual. |
| **Marcadores de Tratamento** | Ícones sobre o gráfico de glicose indicando bolus de refeição (🍽️), correção (💉), insulina lenta (🔵), carboidratos (🌾), sensor/cateter/caneta novos (📌) e outros. Tooltip ao passar o mouse. |
| **Tempo no Alvo (TIR)** | Barra empilhada (Muito Baixo → Muito Alto) + tabela com metas internacionais, tempo/dia real e indicadores ✓/✗. Ordem e cores refletem a progressão de risco. |
| **Padrão Diário (AGP)** | Eixo fixo 00:00–23:00 (padrão clínico AGP). Bandas P5–P25–P75–P95 + mediana. Estatísticas inline: Média, GMI, CV%, % no Alvo com semáforo. |
| **Comparação de Períodos** | Sobrepõe a média horária do período atual (verde) com o período anterior equivalente (cinza tracejado). Grade de estatísticas com delta arrows (↑↓→). Disponível para 24h/7d/14d/30d. Colapsável. |
| **Cartão de Glicose Atual** | Valor em destaque com cor por zona, seta de tendência, delta, badge de status e alerta de dados antigos. Suporte a mg/dL e mmol/L. IOB e COB exibidos em tempo real. |
| **Grid de Estatísticas** | 4 cards: Média · GMI · A1c Estimada · CV% com semáforo verde/amarelo/vermelho. |
| **Alertas de Padrões** | Cards de alerta para padrões detectados com severidade (baixa/média/alta). |

**IOB & COB (Insulina e Carboidratos Ativos)**

| Indicador | Descrição |
|-----------|-----------|
| **IOB** | Calcula a Insulina Ativa (Insulin on Board) a partir do histórico de bolus e da taxa basal programada. Usa modelo de ação biexponencial configurável via DIA (Duration of Insulin Action). Exibido no cartão de glicose atual. |
| **COB** | Calcula os Carboidratos Ativos (Carbs on Board) aplicando taxa de absorção configurável (padrão 30 g/h). Exibido no cartão de glicose atual. |

**Careportal — Registro de Tratamentos**

| Tipo de Evento | Campos |
|----------------|--------|
| Meal Bolus | Insulina (U) · Carboidratos (g) · Glicose (mg/dL) · Notas |
| Correction Bolus | Insulina (U) · Glicose (mg/dL) · Notas |
| Slow Bolus | Insulina (U) · Notas |
| Slow Pen Change | Notas |
| Rapid Pen Change | Notas · **Incremento de dose (1 U / 0,5 U)** |
| Sensor Change | Notas |
| Cannula Change | Notas |
| Temp Basal | Taxa (U/h) · Duração (min) · Notas |
| Carb Correction | Carboidratos (g) · Notas |
| Exercise | Notas |
| Note | Texto livre |

**Calculadora de Bolus**

Acessível pelo ícone de calculadora (🧮) no header. Calcula a dose sugerida com base em:

- Glicose atual (preenchida automaticamente pelo sensor, editável)
- Carboidratos da refeição
- IOB atual (calculado automaticamente)
- ISF, ICR e glicose alvo (configuráveis globalmente e ajustáveis por-cálculo)

**Fórmula:**
```
Correção  = (BG_atual − Alvo) / ISF
Carbos    = gramas / ICR
Sugerido  = max(0, Carbos + Correção − IOB)
Dose      = arredondar(Sugerido, passo da caneta)
```

A dose final é arredondada para o passo da caneta rápida configurada (1 U ou 0,5 U). O breakdown detalhado é exibido em tempo real:

```
Carbos:     +3,3 U
Correção:   +0,8 U
IOB:        −0,5 U
─────────────────
Calculado:  3,60 U
Dose:       3,5 U  (0,5 U/dose)
```

Ao confirmar, abre o TreatmentModal pré-preenchido como **Meal Bolus** ou **Correction Bolus**.

**Idades de Dispositivos**

Indicadores de idade exibidos no dashboard para:

| Dispositivo | Limite Padrão | Cores |
|-------------|--------------|-------|
| SAGE (Sensor) | ≤ 10 dias OK · 11 dias atenção · 14 dias alerta |  🟢 🟡 🔴 |
| CAGE (Cateter) | ≤ 2 dias OK · 3 dias atenção · 4 dias alerta | 🟢 🟡 🔴 |
| IAGE (Insulina) | ≤ 28 dias OK · 29 dias atenção · 30+ dias alerta | 🟢 🟡 🔴 |
| Caneta Rápida | ≤ 28 dias OK · 29 dias atenção · 30+ dias alerta | 🟢 🟡 🔴 |
| Caneta Lenta | ≤ 28 dias OK · 29 dias atenção · 30+ dias alerta | 🟢 🟡 🔴 |

Thresholds configuráveis na página de Configurações.

**Configurações**

| Configuração | Descrição |
|-------------|-----------|
| Nome do paciente | Exibido no cabeçalho do dashboard |
| Unidade de glicose | mg/dL ou mmol/L com conversão automática |
| Auto-refresh | Intervalo configurável de 1 a 30 minutos |
| Faixas limites | Thresholds de Muito Baixo / Baixo / Alto / Muito Alto |
| DIA | Duration of Insulin Action em horas (cálculo de IOB) |
| Taxa de absorção de carbos | g/hora para cálculo de COB (padrão 30 g/h) |
| Taxa basal programada | U/h da bomba (0 = usuário de caneta / MDI) |
| ISF | Insulin Sensitivity Factor — mg/dL por unidade (para calculadora) |
| ICR | Insulin-to-Carb Ratio — gramas por unidade (para calculadora) |
| Glicose Alvo | Alvo para cálculo de dose de correção (para calculadora) |
| Passo da caneta rápida | Incremento da caneta: 1 U ou 0,5 U (arredondamento da dose) |
| Idades de dispositivos | Thresholds de atenção/alerta para cada tipo de dispositivo |

---

### Em Desenvolvimento 🚧

- Alarmes sonoros / Push Notifications (PWA)
- Relatório PDF estilo AGP
- Integração Claude AI via MCP LibreLink

---

## Arquitetura

```
┌─────────────────────────────────────┐
│  Frontend (React + TypeScript)      │
│  - Dashboard em tempo real          │
│  - IOB/COB calculado no cliente     │
│  - Calculadora de Bolus             │
│  - Careportal + histórico           │
│  - Gráficos Recharts (AR2, markers) │
│  - PWA / Service Worker             │
│  Nginx  →  http://<frontend-ip>      │
└────────────┬────────────────────────┘
             │ REST API
┌────────────▼────────────────────────┐
│  Backend (Node.js + Express)        │
│  - API REST endpoints               │
│  - Analytics engine                 │
│  - CRUD de tratamentos              │
│  - Persistência de settings         │
│  Node.js  →  http://<backend-ip>:3001│
└────────────┬────────────────────────┘
             │
┌────────────▼────────────────────────┐
│  MongoDB  <mongo-ip>:27017          │
│  database: nightscout               │
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

# 3. Build e start (com MacVLAN para IPs fixos na rede local)
docker compose build
docker compose -f docker-compose.yml -f docker-compose.macvlan.yml up -d

# 4. Verifique os logs
docker compose logs -f
```

> **MacVLAN:** Se sua rede usa MacVLAN para atribuir IPs fixos aos containers,
> use sempre o override `docker-compose.macvlan.yml` no comando `up`.

**Acesso** (ajuste os IPs adequadamente para seu ambiente):
- Frontend: `http://<frontend-ip>`
- Backend API: `http://<backend-ip>:3001/api`
- Health check: `http://<backend-ip>:3001/api/health`

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
PUT /api/settings        — Salvar configurações
```

Campos suportados em `PUT /api/settings`:
```json
{
  "unit": "mgdl",
  "patientName": "Nome",
  "refreshInterval": 5,
  "alarmThresholds": { "veryLow": 54, "low": 70, "high": 180, "veryHigh": 250 },
  "dia": 3,
  "carbAbsorptionRate": 30,
  "scheduledBasalRate": 0,
  "isf": 50,
  "icr": 15,
  "targetBG": 100,
  "rapidPenStep": 1,
  "deviceAgeThresholds": { ... }
}
```

### Tratamentos
```
GET  /api/treatments        — Listar tratamentos (startDate, endDate, limit, skip, eventType)
POST /api/treatments        — Registrar novo tratamento
DELETE /api/treatments/:id  — Excluir tratamento
```

Campos suportados em `POST /api/treatments`:
```json
{
  "eventType": "Meal Bolus",
  "insulin": 3.5,
  "carbs": 45,
  "glucose": 140,
  "duration": 0,
  "notes": "Almoço"
}
```

Tipos de evento aceitos: `Meal Bolus`, `Correction Bolus`, `Slow Bolus`, `Rapid Pen Change`, `Slow Pen Change`, `Sensor Change`, `Cannula Change`, `Temp Basal`, `Carb Correction`, `Exercise`, `Note`.

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

### Fase 5 — UX Avançado ✅
- Zoom/pan interativo no gráfico de glicose (drag + double-click reset)
- AGP clínico com estatísticas inline (Média, GMI, CV%, TIR%)
- Comparação de períodos (atual vs anterior, overlay AGP)
- TIR reordenado de menor para maior risco

### Fase 6 — Careportal & Calculadora ✅
- Registro de tratamentos (Meal Bolus, Correction Bolus, Sensor/Cannula/Pen Change, Temp Basal, etc.)
- Histórico de tratamentos com exclusão (`/treatments`)
- Marcadores de tratamento sobrepostos no gráfico de glicose
- IOB — Insulina Ativa em tempo real (modelo biexponencial, DIA configurável)
- COB — Carboidratos Ativos em tempo real (taxa de absorção configurável)
- IOB e COB exibidos no cartão de glicose atual
- Previsão AR2 (algoritmo autoregressivo de ordem 2) no gráfico de glicose
- Calculadora de Bolus com breakdown detalhado (ISF, ICR, alvo, arredondamento por passo de caneta)
- Idades de dispositivos (SAGE, CAGE, IAGE, canetas) com alertas por thresholds configuráveis
- Passo da caneta rápida (1 U / 0,5 U) registrado via careportal e usado na calculadora
- Suporte a Temp Basal (taxa e duração) para usuários de bomba de insulina

### Fase 7 — Relatórios (próximo)
- PDF estilo AGP
- Resumo semanal
- Export CSV

### Fase 8 — Integrações
- Claude AI via MCP LibreLink
- Dados de loop (AndroidAPS / Loop)

---

## Licença

MIT — Diego Castilho

## Links

- [Nightscout Project](https://nightscout.github.io/)
- [GitHub](https://github.com/diego-castilho/nightscout-modern)
