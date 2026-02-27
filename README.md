# Nightscout Modern

[![Versão](https://img.shields.io/badge/versão-v1.0-blue?style=flat-square)](https://github.com/diego-castilho/nightscout-modern/releases/tag/v1.0)
[![Licença](https://img.shields.io/badge/licença-MIT-22c55e?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-compatível-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![PWA](https://img.shields.io/badge/PWA-instalável-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

Interface moderna, responsiva e rica em recursos para monitoramento contínuo de glicose (CGM), construída sobre o banco de dados MongoDB do Nightscout existente — **sem migração de dados**.

---

## Objetivo

O **Nightscout Modern** é uma interface alternativa ao Nightscout clássico com compatibilidade total com os dados existentes (coleções `entries`, `treatments`, `devicestatus`). Oferece um dashboard em tempo real, suite completa de relatórios clínicos e careportal avançado — tudo autenticado via JWT, instalável como PWA e operando diretamente sobre o MongoDB do seu Nightscout atual.

---

## Funcionalidades

### Dashboard & Visualização
- Gráfico de glicose interativo com **zoom/pan** e gradiente dinâmico por zona TIR
- **Previsão AR2** — algoritmo idêntico ao NS original (coeficientes `[-0.723, 1.716]`, espaço log)
- **Setas de tendência** (12 direções NS) + delta com bucket averaging estilo NS
- Cartão de glicose atual com IOB, COB e status em tempo real
- **Padrão Diário (AGP clínico)**: bandas P5/P25/P75/P95 + mediana, eixo fixo 00h–23h
- **Comparação de períodos**: sobrepõe médias horárias atual × período anterior
- Alertas de padrões detectados: alvorecer, hipo noturna, alta variabilidade, pico pós-prandial

### Careportal & Tratamentos
- **15 tipos de evento**: Meal/Snack/Correction/Combo Bolus, Carb Correction, BG Check, Sensor/Site/Insulin/Pen Change, Temp Basal, Exercise, Note, Basal Insulin
- **Combo Bolus** (imediata + estendida + duração), proteína e gordura em refeições
- **Campo preBolus** (Carb Time −60 a +60 min), compatível com NS
- **Calculadora de Bolus** com algoritmo BWP (correção + carbos − IOB)
- **Histórico de tratamentos** com filtro, paginação e exclusão inline
- **Idades de dispositivos**: SAGE, CAGE, IAGE, Caneta Rápida/Lenta
- **IOB/COB**: modelo biexponencial configurável via DIA e taxa de absorção

### Relatórios Clínicos

| Relatório | Descrição |
|-----------|-----------|
| **Calendário Mensal** | Heatmap com média glicêmica por dia, colorido por zona TIR, badges de hipoglicemia; painel de detalhe ao clicar |
| **Resumo Semanal** | Sparklines diários + totais de insulina e carboidratos por semana; navegação por semanas anteriores |
| **Stats Horárias** | Box plots hora a hora (00h–23h) com heatmap de variação; TIR e contagem por hora |
| **Distribuição** | Histograma, roda TIR, GVI, PGS e flutuação glicêmica |
| **Log Diário** | Gráfico 24h + grade numérica de leituras a cada 5 min + marcadores de tratamentos |
| **Padrões de Refeição** | Correlação pré/+1h/+2h/pico por período do dia (café, almoço, lanche, jantar) |
| **Relatório AGP** | Formato clínico ADA — percentis, TIR bar, GMI, mini-gráficos por dia, CSS print |
| **Spaghetti Semanal** | Sobreposição de traçados diários em eixo 24h; toggle de visibilidade por dia |

### Segurança & Configurações
- **Autenticação JWT** com expiração configurável, rate limiting (5 tentativas/15 min), middleware em todas as rotas
- **Configurações persistidas no servidor** (compartilhadas entre dispositivos): unidade, thresholds, DIA, ISF, ICR, taxa basal, absorção de carbos
- Suporte a **mg/dL e mmol/L** com conversão automática em toda a interface
- **2 temas**: Modo Claro e Modo Escuro

---

## Comparativo: Nightscout Original vs. NS Modernizado

| Funcionalidade | NS Original | NS Modernizado |
|----------------|:-----------:|:--------------:|
| Interface | Server-rendered (Jade) | SPA React 18 |
| PWA instalável | ❌ | ✅ |
| Autenticação JWT | ❌ (api_secret na URL) | ✅ |
| Rate limiting no login | ❌ | ✅ |
| Gráfico interativo (zoom/pan) | ❌ | ✅ |
| Previsão AR2 | ✅ | ✅ (idêntico) |
| Setas de tendência (12 dir.) | ✅ | ✅ (idêntico) |
| IOB / COB | Plugin | ✅ Nativo |
| Calculadora de Bolus (BWP) | Plugin | ✅ Nativa |
| Combo Bolus + preBolus | ✅ | ✅ |
| Comparação de períodos | ❌ | ✅ |
| Config multi-dispositivo | ❌ | ✅ (server-side) |
| Tema claro / escuro | Parcial | ✅ |
| Calendário Mensal (heatmap) | ✅ | ✅ |
| Resumo Semanal (sparklines) | ✅ | ✅ |
| Stats Horárias (box plots) | ✅ | ✅ |
| Distribuição (GVI, PGS) | ✅ | ✅ |
| Log Diário | ✅ | ✅ |
| Padrões de Refeição | ❌ | ✅ |
| AGP Imprimível | ❌ (externo) | ✅ |
| Spaghetti Semanal | ✅ | ✅ |

---

## Roadmap

| Fase | Nome | Entregáveis | Status |
|------|------|-------------|--------|
| 1 | Fundação | Backend Node.js, API REST, conexão MongoDB, analytics engine | ✅ |
| 2 | Dashboard Core | AreaChart com gradiente TIR, AGP clínico, TIR bar, métricas, dark mode, PWA | ✅ |
| 3 | Notificações | Alertas visuais por zona com cooldown; ⚠️ alarmes sonoros (pendente) | ⚠️ |
| 4 | Configurações | Settings completo, mg/dL ↔ mmol/L, thresholds, persistência server-side | ✅ |
| 5 | UX Avançado | Zoom/pan, comparação de períodos sobrepostos, seletor multi-período | ✅ |
| 6 | Careportal & Calculadora | IOB/COB biexponencial, AR2, Calculadora BWP, idades de dispositivos, Temp Basal | ✅ |
| 7 | Fidelidade NS | Setas de tendência (12 dir.), delta bucket averaging | ✅ |
| 8 | Careportal Avançado | Combo Bolus, preBolus, proteína/gordura, BG Check, Exercise, Basal Insulin | ✅ |
| 9 | Segurança | JWT, rate limiting, middleware de proteção em todas as rotas, tela de login | ✅ |
| 10 | Relatórios Clínicos | Calendário · Semanal · Horárias · Distribuição · Log · Refeições · AGP · Spaghetti | ✅ |
| 11 | Integrações | Claude AI via MCP LibreLink; dados de loop (AndroidAPS / Loop) | 🔜 |

---

## Documentação

| | |
|-|-|
| 🏗️ [Arquitetura](docs/ARCHITECTURE.md) | Diagrama macro e micro com detalhes de componentes frontend e backend |
| 🚀 [Implementação](docs/IMPLEMENTATION.md) | Guia completo passo a passo — do zero ao deploy em produção |
| 📡 [API Reference](docs/API.md) | Documentação completa de todos os endpoints REST |

---

## Quick Start

```bash
git clone https://github.com/diego-castilho/nightscout-modern.git
cd nightscout-modern
cp .env.example .env          # edite com MONGO_URI, API_SECRET, JWT_SECRET
docker compose build
docker compose -f docker-compose.yml -f docker-compose.macvlan.yml up -d
```

Acesse `http://<frontend-ip>` → redireciona para `/login`.

> Veja o [Guia de Implementação](docs/IMPLEMENTATION.md) para configuração detalhada, variáveis de ambiente e troubleshooting.

---

## Licença

MIT — Diego Castilho · [Nightscout Project](https://nightscout.github.io/) · [GitHub](https://github.com/diego-castilho/nightscout-modern)
