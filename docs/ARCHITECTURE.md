# Arquitetura — Nightscout Modern

## Visão Macro

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENTE (Browser / PWA)                                     │
│                                                              │
│  React 18 SPA  →  http://<frontend-ip>  (Nginx, porta 80)   │
└──────────────────────────┬───────────────────────────────────┘
                           │  REST API  /api/*
                           │  Authorization: Bearer <JWT>
┌──────────────────────────▼───────────────────────────────────┐
│  BACKEND                                                     │
│                                                              │
│  Node.js 20 + Express  →  http://<backend-ip>:3001           │
│  • Auth middleware (JWT)                                     │
│  • Analytics engine                                          │
│  • CRUD de tratamentos                                       │
│  • Persistência de settings                                  │
└──────────────────────────┬───────────────────────────────────┘
                           │  MongoDB native driver
                           │  mongodb://<mongo-ip>:27017
┌──────────────────────────▼───────────────────────────────────┐
│  BANCO DE DADOS (Nightscout existente)                       │
│                                                              │
│  MongoDB  —  database: nightscout                            │
│  • entries           — leituras CGM                          │
│  • treatments        — bolus, carbos, eventos                │
│  • devicestatus      — IOB/COB do loop, status do sensor     │
│  • nightscout_modern_settings  — configurações da interface  │
└──────────────────────────────────────────────────────────────┘
```

**Rede:** MacVLAN — cada container recebe um IP fixo na LAN local.
O host Docker **não consegue** acessar os containers diretamente via MacVLAN (limitação do driver). Acesse de outro dispositivo na rede ou via Cloudflare Tunnel.

---

## Infraestrutura Docker

```
docker-compose.yml                 — Serviços: backend + frontend
docker-compose.macvlan.yml         — Override: IPs fixos MacVLAN

docker/
  Dockerfile.backend               — Multi-stage: build TypeScript → runtime Node
  Dockerfile.frontend              — Multi-stage: build Vite → Nginx alpine
```

**Comando de deploy (obrigatório usar o override MacVLAN):**
```bash
docker compose -f docker-compose.yml -f docker-compose.macvlan.yml up -d
```

### Por que MacVLAN?

Containers na rede bridge padrão do Docker não alcançam o MongoDB externo na LAN. O MacVLAN cria uma interface de rede virtual com IP próprio na LAN, permitindo comunicação direta com qualquer host da rede local — inclusive o MongoDB do Nightscout.

---

## Frontend

### Stack
| Biblioteca | Versão | Papel |
|------------|--------|-------|
| React | 18 | Framework de UI |
| Vite | 5 | Build tool + dev server |
| TypeScript | 5 | Tipagem estática |
| Tailwind CSS | 3 | Utilitários CSS |
| shadcn/ui | — | Componentes acessíveis (Radix UI) |
| Recharts | 2 | Gráficos declarativos (SVG) |
| Zustand | — | Estado global |
| Axios | — | HTTP client |
| date-fns | — | Manipulação de datas (pt-BR) |
| vite-plugin-pwa | — | Service Worker + manifesto PWA |

### Estrutura de arquivos

```
frontend/src/
├── pages/                    — Uma página por rota
│   ├── DashboardPage.tsx     — / (dashboard em tempo real)
│   ├── CalendarPage.tsx      — /calendar
│   ├── WeeklyPage.tsx        — /weekly
│   ├── HourlyStatsPage.tsx   — /hourly
│   ├── DistributionPage.tsx  — /distribution
│   ├── DailyLogPage.tsx      — /daily
│   ├── MealPatternsPage.tsx  — /meals
│   ├── AGPPage.tsx           — /agp
│   ├── SpaghettiPage.tsx     — /spaghetti
│   ├── ComparisonsPage.tsx   — /comparisons
│   ├── TreatmentsPage.tsx    — /treatments
│   ├── SettingsPage.tsx      — /settings
│   └── LoginPage.tsx         — /login
│
├── components/
│   ├── layout/
│   │   └── Header.tsx        — Barra de navegação superior (menu, tema, careportal)
│   ├── dashboard/            — Gráficos e cards do dashboard
│   │   ├── GlucoseAreaChart.tsx   — Gráfico principal com gradiente TIR + zoom/pan + AR2
│   │   ├── DailyPatternChart.tsx  — AGP clínico (bandas P5/P25/P75/P95)
│   │   ├── TIRChart.tsx           — Barra TIR empilhada + tabela com metas
│   │   ├── StatsGrid.tsx          — Cards: Média, GMI, A1c, CV%
│   │   ├── CurrentGlucoseCard.tsx — Valor atual, seta, delta, IOB/COB
│   │   └── PatternsAlert.tsx      — Cards de padrões detectados
│   ├── careportal/
│   │   ├── TreatmentModal.tsx     — Modal de registro de tratamentos (15 tipos)
│   │   └── BolusCalculatorModal.tsx — Calculadora BWP
│   └── ui/                   — Componentes shadcn/ui (Button, Card, etc.)
│
├── stores/
│   ├── dashboardStore.ts     — Estado global: unit, thresholds, patientName, refresh
│   └── authStore.ts          — Token JWT, estado de autenticação
│
├── hooks/
│   ├── useGlucoseData.ts     — Polling de glicose + auto-refresh
│   └── useTheme.ts           — Ciclo de temas (4 temas)
│
├── lib/
│   ├── api.ts                — Funções de acesso à API (Axios) + interfaces TypeScript
│   └── glucose.ts            — Utilitários: formatGlucose(), unitLabel(), conversão mmol/L
│
└── App.tsx                   — Roteamento + AuthenticatedLayout
```

### Fluxo de autenticação (frontend)

```
LoginPage → POST /api/auth/login → JWT salvo em authStore (Zustand)
         → Zustand persiste em localStorage (persist middleware)

Toda requisição Axios: interceptor adiciona Authorization: Bearer <token>
Resposta 401: authStore.logout() + navigate('/login')
```

### Gerenciamento de estado

| Store | Dados |
|-------|-------|
| `authStore` | `token`, `isAuthenticated`, `logout()` |
| `dashboardStore` | `unit`, `alarmThresholds`, `patientName`, `refreshInterval`, `triggerRefresh()`, `initFromServer()` |

---

## Backend

### Stack
| Biblioteca | Papel |
|------------|-------|
| Express.js | Framework HTTP |
| TypeScript | Tipagem estática |
| jsonwebtoken | Geração e verificação de JWT |
| express-rate-limit | Rate limiting no login |
| mongodb (driver nativo) | Acesso ao MongoDB |
| Zod | Validação de entrada |

### Estrutura de arquivos

```
backend/src/
├── index.ts              — Entry point: Express app, CORS, rotas, health check
├── middleware/
│   └── auth.ts           — Verificação JWT, extração de Bearer token
├── routes/
│   ├── auth.ts           — POST /auth/login (rate limit)
│   ├── glucose.ts        — GET /glucose, /glucose/latest, /glucose/range
│   ├── analytics.ts      — GET /analytics/* (stats, TIR, padrões, relatórios)
│   ├── treatments.ts     — GET/POST/DELETE /treatments
│   └── settings.ts       — GET/PUT /settings
├── services/
│   └── analytics.ts      — Analytics engine: cálculos de TIR, stats, padrões, AGP,
│                           calendário, semanal, horárias, distribuição, correlateMeals
├── db/
│   ├── connection.ts     — Conexão MongoDB com retry automático
│   └── queries.ts        — getGlucoseByDateRange(), getTreatments(), upsertSettings(), etc.
└── types/
    └── index.ts          — Interfaces: GlucoseEntry, Treatment, Settings, TIR, etc.
```

### Analytics Engine (`services/analytics.ts`)

Funções expostas:

| Função | Descrição |
|--------|-----------|
| `calculateStats()` | Média, mediana, desvio padrão, mín/máx, GMI, HbA1c, CV% |
| `calculateTIR()` | Time in Range (5 zonas, thresholds configuráveis) |
| `calculatePatterns()` | Padrão diário por hora: P5/P25/P50/P75/P95 |
| `detectPatterns()` | Detecção: alvorecer, hipo noturna, alta variabilidade, pico pós-prandial |
| `calculateCalendarData()` | Média + zona + hipos por dia (para calendário) |
| `calculateWeeklyData()` | Stats por dia da semana + totais de insulina/carbos |
| `calculateHourlyStats()` | Box plots hora a hora + heatmap |
| `calculateDistributionStats()` | Histograma + GVI + PGS + flutuação |
| `correlateMeals()` | Correlação pré/+1h/+2h/pico por período do dia |

### Coleções MongoDB utilizadas

| Coleção | Leitura | Escrita |
|---------|---------|---------|
| `entries` | ✅ | ❌ (somente leitura) |
| `treatments` | ✅ | ✅ (CRUD) |
| `devicestatus` | ✅ | ❌ |
| `nightscout_modern_settings` | ✅ | ✅ |

> O backend **nunca modifica** as coleções nativas do Nightscout (`entries`, `treatments`).
> Tratamentos criados pelo NS Modern são escritos na coleção `treatments` no mesmo formato do NS original.

### Índice automático

Na primeira inicialização, o backend cria o índice `{ type: 1, date: -1 }` na coleção `entries` para acelerar as queries de analytics. Operação idempotente.

---

## Fluxo de dados — Dashboard em tempo real

```
useGlucoseData (hook)
  └── polling a cada <refreshInterval> minutos
      ├── GET /api/glucose/latest    → CurrentGlucoseCard (valor, seta, delta, IOB, COB)
      ├── GET /api/glucose/range     → GlucoseAreaChart (gráfico principal)
      └── GET /api/analytics         → TIRChart, StatsGrid, PatternsAlert, DailyPatternChart
```

**Delta com bucket averaging** (estilo NS):
- Leituras dos últimos 2.5 min → bucket s0; últimos 7.5 min → bucket s1
- Seta calculada sobre médias dos buckets, não sobre leituras individuais

**Previsão AR2:**
- Algoritmo idêntico ao `ar2.js` do NS original
- Espaço logarítmico, coeficientes `[-0.723, 1.716]`
- Passos fixos de 5 min, cobertura ~60 min, clamping `[36, 400]` mg/dL

---

## Segurança

| Camada | Mecanismo |
|--------|-----------|
| Login | Rate limiting: 5 req / 15 min por IP |
| Senha | `timingSafeEqual` (proteção contra timing attacks) |
| Token | JWT assinado com `JWT_SECRET`, expiração configurável via `JWT_EXPIRES_IN` |
| Rotas | Middleware `auth.ts` em todas as rotas exceto `/api/health` e `/api/auth/login` |
| CORS | `CORS_ORIGIN` configurável no `.env` |

---

## Variáveis de Ambiente

### `backend/.env`

| Variável | Obrigatória | Descrição |
|----------|:-----------:|-----------|
| `MONGODB_URI` | ✅ | URI completa: `mongodb://<ip>:27017` |
| `MONGODB_DB_NAME` | ✅ | Nome do banco (padrão: `nightscout`) |
| `MONGODB_USER` | — | Usuário MongoDB (vazio se sem auth) |
| `MONGODB_PASSWORD` | — | Senha MongoDB |
| `API_SECRET` | ✅ | Senha de acesso ao dashboard |
| `JWT_SECRET` | ✅ | String aleatória para assinar JWTs |
| `JWT_EXPIRES_IN` | — | Expiração do token (padrão: `7d`) |
| `CORS_ORIGIN` | ✅ | IP/domínio do frontend: `http://<frontend-ip>` |
| `PORT` | — | Porta do backend (padrão: `3001`) |

### `docker-compose.yml` (build args do frontend)

| Arg | Descrição |
|-----|-----------|
| `VITE_API_URL` | URL base da API: `http://<backend-ip>:3001/api` |
