# Nightscout Modern

Interface moderna, responsiva e rica em recursos para monitoramento contínuo de glicose (CGM), construída sobre o banco de dados MongoDB do Nightscout existente.

> **v0.6-beta** — Controle de acesso com autenticação JWT (senha única via `API_SECRET`), Combo Bolus, campo preBolus (Carb Time estilo NS), correção de alinhamento de gradiente TIR e início do roadmap de relatórios clínicos.

---

## Características

### Implementado ✅

**Segurança & Autenticação**
- Autenticação por senha única via variável de ambiente `API_SECRET`
- JWT com expiração configurável (padrão 7 dias)
- Rate limiting no login: 5 tentativas por 15 minutos por IP
- Comparação timing-safe (proteção contra timing attacks)
- Middleware Bearer token em todas as rotas protegidas
- Tela de login dedicada com feedback de erro por tipo (401/429/rede)
- Botão "Sair" no menu do header
- Redirecionamento automático para `/login` em qualquer resposta 401

**Backend**
- Node.js 20 + Express + TypeScript
- Acesso direto ao MongoDB do Nightscout (banco `nightscout`)
- API REST completa (glucose, analytics, patterns, settings, treatments, auth)
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
| **Leituras de Glicose** | AreaChart com gradiente dinâmico por zona TIR. Gradiente de preenchimento e traçado calculados com bounding boxes corretos (fill: minVal→rawMax; stroke: rawMin→rawMax), garantindo alinhamento perfeito com as linhas de threshold. Zoom via drag horizontal, double-click para resetar. |
| **Previsão AR2** | Extensão preditiva no gráfico principal. Algoritmo idêntico ao NS (`ar2.js`): espaço logarítmico, coeficientes [-0.723, 1.716], passos fixos de 5 min (cobertura ~60 min), médias em bucket para s0/s1, clamping [36, 400] mg/dL. |
| **Marcadores de Tratamento** | Ícones sobre o gráfico de glicose para todos os tipos de evento. Tooltip ao passar o mouse com todos os dados + botão de exclusão inline. |
| **Tempo no Alvo (TIR)** | Barra empilhada (Muito Baixo → Muito Alto) + tabela com metas internacionais, tempo/dia real e indicadores ✓/✗. |
| **Padrão Diário (AGP)** | Eixo fixo 00:00–23:00 (padrão clínico AGP). Bandas P5–P25–P75–P95 + mediana. Estatísticas inline: Média, GMI, CV%, % no Alvo com semáforo. |
| **Comparação de Períodos** | Sobrepõe a média horária do período atual (verde) com o período anterior equivalente (cinza tracejado). Grade de estatísticas com delta arrows (↑↓→). Disponível para 24h/7d/14d/30d. Colapsável. |
| **Cartão de Glicose Atual** | Valor em destaque com cor por zona, seta de tendência (12 direções NS), delta com bucket averaging estilo NS, badge de status, IOB e COB em tempo real. |
| **Grid de Estatísticas** | 4 cards: Média · GMI · A1c Estimada · CV% com semáforo verde/amarelo/vermelho. |
| **Alertas de Padrões** | Cards para padrões detectados com severidade (baixa/média/alta). |

**IOB & COB (Insulina e Carboidratos Ativos)**

| Indicador | Descrição |
|-----------|-----------|
| **IOB** | Insulina Ativa calculada a partir do histórico de bolus. Modelo biexponencial configurável via DIA. |
| **COB** | Carboidratos Ativos com taxa de absorção configurável (padrão 30 g/h). |

**Careportal — Registro de Tratamentos**

| Tipo de Evento | Campos |
|----------------|--------|
| Meal Bolus | Insulina (U) · Carboidratos (g) · Proteína (g) · Gordura (g) · Glicose · Momento dos carbos (preBolus) · Notas |
| Snack Bolus | Insulina (U) · Carboidratos (g) · Proteína (g) · Gordura (g) · Glicose · Momento dos carbos (preBolus) · Notas |
| Correction Bolus | Insulina (U) · Glicose · Notas |
| Combo Bolus | Insulina imediata (U) · Insulina estendida (U) · Duração (min) · Carboidratos (g) · Momento dos carbos · Notas |
| Carb Correction | Carboidratos (g) · Notas |
| BG Check | Glicose (mg/dL) · Notas |
| Sensor Change | Notas |
| Site Change | Notas |
| Insulin Change | Notas |
| Rapid Pen Change | Notas · Incremento de dose (1 U / 0,5 U) |
| Slow Pen Change | Notas |
| Temp Basal | Taxa (U/h ou %) · Modo (absoluto/relativo) · Duração (min) · Notas |
| Exercise | Tipo · Intensidade · Duração (min) · Notas |
| Note | Texto livre |
| Basal Insulin | Insulina (U) · Notas |

**Campo preBolus (Carb Time):** compatível com o campo homônimo do NS, registra o tempo dos carboidratos em relação ao bolus (−60 a +60 min). Disponível em Meal Bolus, Snack Bolus e Combo Bolus.

**Calculadora de Bolus**

Acessível pelo ícone de calculadora (🧮) no header. Algoritmo espelho do Bolus Wizard Preview (BWP) do Nightscout:

```
Projetado = BG_atual − IOB × ISF
Correção  = (Projetado − AlvoMáx) / ISF  se acima do alvo
          = (Projetado − AlvoMín) / ISF  se abaixo do alvo
          = 0                            se dentro do alvo
Carbos    = gramas / ICR
Sugerido  = Carbos + Correção
Dose      = arredondar(max(0, Sugerido), passo da caneta)
```

Quando resultado negativo: exibe equivalente em carboidratos e sugestões de basal temporária.

**Idades de Dispositivos**

| Dispositivo | Thresholds padrão |
|-------------|------------------|
| SAGE (Sensor) | ≤10 dias 🟢 · 11 dias 🟡 · 14 dias 🔴 |
| CAGE (Cateter) | ≤2 dias 🟢 · 3 dias 🟡 · 4 dias 🔴 |
| IAGE (Insulina) | ≤28 dias 🟢 · 29 dias 🟡 · 30+ dias 🔴 |
| Caneta Rápida | ≤28 dias 🟢 · 29 dias 🟡 · 30+ dias 🔴 |
| Caneta Lenta | ≤28 dias 🟢 · 29 dias 🟡 · 30+ dias 🔴 |

**Configurações**

| Configuração | Descrição |
|-------------|-----------|
| Nome do paciente | Exibido no cabeçalho do dashboard |
| Unidade de glicose | mg/dL ou mmol/L com conversão automática |
| Auto-refresh | Intervalo configurável de 1 a 30 minutos |
| Faixas limites | Thresholds de Muito Baixo / Baixo / Alto / Muito Alto |
| DIA | Duration of Insulin Action em horas (cálculo de IOB) |
| Taxa de absorção de carbos | g/hora para cálculo de COB (padrão 30 g/h) |
| Taxa basal programada | U/h da bomba (0 = MDI) |
| ISF | Insulin Sensitivity Factor — mg/dL por unidade |
| ICR | Insulin-to-Carb Ratio — gramas por unidade |
| Faixa Alvo (Mín/Máx) | Faixa-alvo para cálculo de correção |
| Passo da caneta rápida | 1 U ou 0,5 U |
| Preditivo AR2 padrão | Exibir previsão AR2 por padrão |
| Idades de dispositivos | Thresholds por tipo de dispositivo |

---

### Em Desenvolvimento 🚧

**Relatórios Clínicos** (roadmap de 8 fases, análise comparativa com NS original e LibreView concluída):

| Fase | Relatório | Status |
|------|-----------|--------|
| 1 | Calendário Mensal (heatmap glicemia média + eventos de hipo por dia) | 🔜 Próximo |
| 2 | Resumo Semanal (sparklines diários + totais insulina/carbos) | Planejado |
| 3 | Stats Horárias (box plots 00h–23h) | Planejado |
| 4 | Distribuição Avançada (GVI, PGS, flutuação) | Planejado |
| 5 | Log Diário detalhado (gráfico + grade numérica + anotações) | Planejado |
| 6 | Padrões de Refeição (pré/pós-meal por período do dia) | Planejado |
| 7 | AGP Imprimível / PDF (formato clínico ADA) | Planejado |
| 8 | Spaghetti Semanal (7 curvas sobrepostas por dia da semana) | Planejado |

**Outros:**
- Alarmes sonoros / Push Notifications (PWA)
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
             │ REST API (JWT Bearer)
┌────────────▼────────────────────────┐
│  Backend (Node.js + Express)        │
│  - Autenticação JWT                 │
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
cp .env.example .env
# edite .env com suas configurações

# 3. Build e start (com MacVLAN para IPs fixos na rede local)
docker compose build
docker compose -f docker-compose.yml -f docker-compose.macvlan.yml up -d

# 4. Verifique os logs
docker compose logs -f
```

> **MacVLAN:** Use sempre o override `docker-compose.macvlan.yml` no comando `up` para garantir IPs fixos na rede local e acesso ao MongoDB.

**Variáveis de ambiente obrigatórias no `.env`:**
```env
MONGO_URI=mongodb://<mongo-ip>:27017/nightscout
API_SECRET=sua_senha_aqui        # senha de acesso ao frontend
JWT_SECRET=string_aleatoria      # segredo para assinatura JWT
JWT_EXPIRES_IN=7d                # duração do token
```

**Acesso:**
- Frontend: `http://<frontend-ip>` → redireciona para `/login`
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

### Autenticação (público)
```
POST /api/auth/login     — { password } → { token, expiresIn }
```

Rate limit: 5 tentativas por 15 minutos por IP.
Todos os demais endpoints exigem header: `Authorization: Bearer <token>`

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

### Tratamentos
```
GET  /api/treatments        — Listar (startDate, endDate, limit, skip, eventType)
POST /api/treatments        — Registrar novo tratamento
DELETE /api/treatments/:id  — Excluir tratamento
```

Campos suportados em `POST /api/treatments`:
```json
{
  "eventType": "Meal Bolus",
  "insulin": 3.5,
  "carbs": 45,
  "protein": 10,
  "fat": 15,
  "glucose": 140,
  "preBolus": -15,
  "immediateInsulin": 2.0,
  "extendedInsulin": 1.5,
  "duration": 120,
  "rate": 0.8,
  "rateMode": "absolute",
  "exerciseType": "aeróbico",
  "intensity": "moderada",
  "notes": "Almoço"
}
```

Tipos de evento aceitos: `Meal Bolus`, `Snack Bolus`, `Correction Bolus`, `Combo Bolus`, `Carb Correction`, `BG Check`, `Sensor Change`, `Site Change`, `Insulin Change`, `Rapid Pen Change`, `Slow Pen Change`, `Temp Basal`, `Exercise`, `Note`, `Basal Insulin`.

---

## Zonas TIR (Time in Range)

| Zona | Faixa padrão | Cor | Meta Internacional |
|------|-------------|-----|-------------------|
| Muito Alto | > 250 mg/dL | Vermelho | < 5% |
| Alto | 180–250 mg/dL | Âmbar | < 25% |
| **Alvo** | **70–180 mg/dL** | **Verde** | **> 70%** |
| Baixo | 54–70 mg/dL | Laranja | < 4% |
| Muito Baixo | < 54 mg/dL | Vermelho | < 1% |

Todos os thresholds são configuráveis na página de Configurações.

---

## Stack Tecnológica

### Backend
| | |
|-|-|
| Runtime | Node.js 20 |
| Framework | Express.js |
| Linguagem | TypeScript |
| Banco de Dados | MongoDB (driver nativo) |
| Autenticação | jsonwebtoken + express-rate-limit |
| Validação | Zod |

### Frontend
| | |
|-|-|
| Framework | React 18 |
| Build | Vite 5 |
| Linguagem | TypeScript |
| Estilos | Tailwind CSS + shadcn/ui |
| Gráficos | Recharts 2 |
| Estado Global | Zustand |
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
- Backend + API REST + MongoDB integration + Analytics engine

### Fase 2 — Dashboard Core ✅
- Gráfico de glicose (AreaChart com gradiente TIR), TIR, AGP, métricas, períodos, dark mode, PWA

### Fase 3 — Notificações ⚠️ (parcial)
- Alertas visuais ✅ · Alarmes sonoros / Push (pendente)

### Fase 4 — Configurações ✅
- Settings completo, mg/dL / mmol/L, thresholds, persistência no servidor

### Fase 5 — UX Avançado ✅
- Zoom/pan, AGP clínico, comparação de períodos, TIR reordenado

### Fase 6 — Careportal & Calculadora ✅
- Registro e histórico de tratamentos, marcadores no gráfico, IOB/COB, AR2, Calculadora de Bolus (BWP), idades de dispositivos, Temp Basal, Insulina Basal

### Fase 7 — Fidelidade ao Nightscout ✅
- Setas de tendência (12 direções), delta com bucket averaging, AR2 idêntico ao NS, Calculadora BWP com faixa alvo, temas Dracula/Padrão

### Fase 8 — Careportal Avançado ✅
- Combo Bolus (imediata + estendida + duração)
- Proteína e gordura em Meal/Snack Bolus
- Campo preBolus (Carb Time −60 a +60 min)
- Alinhamento correto do gradiente TIR com linhas de threshold (bounding boxes separadas fill/stroke)
- Tipos adicionais: BG Check, Exercise (tipo + intensidade), Basal Insulin

### Fase 9 — Segurança ✅
- Autenticação JWT com senha única (API_SECRET)
- Rate limiting no login (5 tentativas / 15 min)
- Middleware de proteção em todas as rotas
- Tela de login + botão Sair

### Fase 10 — Relatórios Clínicos 🔜
- Calendário Mensal (heatmap) → Resumo Semanal → Stats Horárias → Distribuição Avançada → Log Diário → Padrões de Refeição → AGP Imprimível → Spaghetti Semanal

### Fase 11 — Integrações
- Claude AI via MCP LibreLink
- Dados de loop (AndroidAPS / Loop)

---

## Licença

MIT — Diego Castilho

## Links

- [Nightscout Project](https://nightscout.github.io/)
- [GitHub](https://github.com/diego-castilho/nightscout-modern)
