# API Reference — Nightscout Modern

Base URL: `http://<backend-ip>:3001/api`

---

## Autenticação

### Login

```
POST /api/auth/login
```

Corpo (JSON):
```json
{ "password": "sua_api_secret" }
```

Resposta de sucesso (`200`):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "7d"
}
```

Erros:
- `401` — senha incorreta
- `429` — rate limit excedido (5 tentativas / 15 min por IP)

**Todos os demais endpoints** exigem o header:
```
Authorization: Bearer <token>
```

---

## Health & Stats

### Health check (público)

```
GET /api/health
```

Resposta:
```json
{ "status": "ok", "timestamp": "2026-02-20T12:00:00.000Z" }
```

### Database stats

```
GET /api/stats
```

Resposta:
```json
{
  "success": true,
  "data": {
    "totalEntries": 125430,
    "totalTreatments": 3210,
    "oldestEntry": "2023-01-01T00:00:00.000Z",
    "newestEntry": "2026-02-20T11:55:00.000Z"
  }
}
```

---

## Glicose

### Última leitura

```
GET /api/glucose/latest
```

Resposta:
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "sgv": 120,
    "date": 1708430100000,
    "direction": "Flat",
    "type": "sgv",
    "device": "share2"
  }
}
```

### Leituras com filtros

```
GET /api/glucose?startDate=<ISO>&endDate=<ISO>&limit=<n>
```

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `startDate` | ISO 8601 | Data de início (opcional) |
| `endDate` | ISO 8601 | Data de fim (opcional) |
| `limit` | número | Máximo de registros (padrão: 1440) |

### Leituras em intervalo

```
GET /api/glucose/range?startDate=<ISO>&endDate=<ISO>
```

Retorna todas as leituras no intervalo, sem limite de quantidade.

Resposta (ambos):
```json
{
  "success": true,
  "data": [
    { "sgv": 120, "date": 1708430100000, "direction": "Flat", ... },
    ...
  ]
}
```

---

## Analytics

Todos os endpoints de analytics aceitam os parâmetros comuns:

| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `startDate` | ISO 8601 | **Obrigatório** — início do período |
| `endDate` | ISO 8601 | **Obrigatório** — fim do período |
| `veryLow` | número (mg/dL) | Threshold Muito Baixo (padrão: 54) |
| `low` | número (mg/dL) | Threshold Baixo (padrão: 70) |
| `high` | número (mg/dL) | Threshold Alto (padrão: 180) |
| `veryHigh` | número (mg/dL) | Threshold Muito Alto (padrão: 250) |

### Relatório completo

```
GET /api/analytics?startDate=<ISO>&endDate=<ISO>[&veryLow=&low=&high=&veryHigh=]
```

Retorna `stats + tir + patterns + detect` numa única chamada.

### Estatísticas

```
GET /api/analytics/stats?startDate=<ISO>&endDate=<ISO>
```

Resposta:
```json
{
  "success": true,
  "data": {
    "count": 288,
    "mean": 145.2,
    "median": 138.0,
    "stdDev": 42.5,
    "cv": 29.3,
    "min": 62,
    "max": 298,
    "gmi": 7.1,
    "a1cEstimate": 7.0
  }
}
```

### Time in Range

```
GET /api/analytics/tir?startDate=<ISO>&endDate=<ISO>
```

Resposta:
```json
{
  "success": true,
  "data": {
    "veryLow":  { "count": 5,   "percentage": 1.7,  "minutesPerDay": 24  },
    "low":      { "count": 12,  "percentage": 4.2,  "minutesPerDay": 60  },
    "inRange":  { "count": 218, "percentage": 75.7, "minutesPerDay": 1090 },
    "high":     { "count": 45,  "percentage": 15.6, "minutesPerDay": 225 },
    "veryHigh": { "count": 8,   "percentage": 2.8,  "minutesPerDay": 40  }
  }
}
```

### Padrão Diário por Hora (AGP)

```
GET /api/analytics/patterns?startDate=<ISO>&endDate=<ISO>
```

Retorna estatísticas de percentis para cada hora do dia (0–23).

Resposta:
```json
{
  "success": true,
  "data": [
    {
      "hour": 0,
      "p5": 82, "p25": 98, "p50": 115, "p75": 142, "p95": 178,
      "count": 35
    },
    ...
  ]
}
```

### Detecção de Padrões

```
GET /api/analytics/detect?startDate=<ISO>&endDate=<ISO>
```

Resposta:
```json
{
  "success": true,
  "data": [
    {
      "type": "dawn_phenomenon",
      "severity": "medium",
      "title": "Fenômeno do Alvorecer",
      "description": "Elevação glicêmica nas primeiras horas da manhã (4h–8h).",
      "recommendation": "Considere ajuste da basal noturna."
    }
  ]
}
```

Tipos de padrão: `dawn_phenomenon`, `nocturnal_hypoglycemia`, `high_variability`, `postprandial_spike`.
Severidades: `low`, `medium`, `high`.

### Comparações de Períodos

```
GET /api/analytics/comparisons?startDate=<ISO>&endDate=<ISO>
```

Retorna médias horárias do período atual e do período anterior equivalente para sobreposição.

### Calendário Mensal

```
GET /api/analytics/calendar?startDate=<ISO>&endDate=<ISO>[&veryLow=&low=&high=&veryHigh=]
```

Retorna um objeto por dia no intervalo.

Resposta:
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-02-01",
      "avgGlucose": 138,
      "minGlucose": 68,
      "maxGlucose": 245,
      "readings": 285,
      "hypoCount": 3,
      "hypoSevere": 0,
      "zone": "inRange"
    },
    ...
  ]
}
```

Zonas: `veryLow`, `low`, `inRange`, `high`, `veryHigh`, `noData`.

### Resumo Semanal

```
GET /api/analytics/weekly?startDate=<ISO>&endDate=<ISO>
```

Resposta:
```json
{
  "success": true,
  "data": {
    "weeks": [
      {
        "startDate": "2026-02-03",
        "endDate": "2026-02-09",
        "days": [
          {
            "date": "2026-02-03",
            "avgGlucose": 142,
            "tirPct": 74,
            "totalInsulin": 28.5,
            "totalCarbs": 180,
            "readings": 288
          }
        ],
        "weekAvg": 138,
        "weekTir": 76
      }
    ]
  }
}
```

### Stats Horárias

```
GET /api/analytics/hourly?startDate=<ISO>&endDate=<ISO>
```

Resposta:
```json
{
  "success": true,
  "data": [
    {
      "hour": 8,
      "avg": 145,
      "p25": 118,
      "p75": 172,
      "count": 120,
      "hypoCount": 2,
      "hyperCount": 15
    },
    ...
  ]
}
```

### Distribuição Avançada

```
GET /api/analytics/distribution?startDate=<ISO>&endDate=<ISO>
```

Resposta:
```json
{
  "success": true,
  "data": {
    "histogram": [
      { "rangeMin": 60, "rangeMax": 70, "count": 15, "percentage": 2.1 },
      ...
    ],
    "gvi": 1.42,
    "pgs": 38.5,
    "fluctuation": {
      "avgHourlyDelta": 12.3,
      "maxHourlyDelta": 45.0
    },
    "tir": { ... }
  }
}
```

### Padrões de Refeição

```
GET /api/analytics/mealtime?startDate=<ISO>&endDate=<ISO>
```

Correlaciona tratamentos do tipo Meal/Snack Bolus com a resposta glicêmica (pré, +1h, +2h, pico).

Resposta:
```json
{
  "success": true,
  "data": {
    "totalEvents": 42,
    "periods": [
      {
        "period": "cafe_manha",
        "label": "Café da Manhã",
        "count": 14,
        "avgPreMeal": 112,
        "avgAt1h": 168,
        "avgAt2h": 145,
        "avgPeak": 182,
        "avgDelta": 70,
        "avgCarbs": 35,
        "avgInsulin": 4.2,
        "events": [
          {
            "treatmentId": "...",
            "timestamp": "2026-02-10T07:30:00.000Z",
            "carbs": 40,
            "insulin": 4.5,
            "mealType": "cafe_manha",
            "preMealGlucose": 108,
            "glucoseAt1h": 175,
            "glucoseAt2h": 148,
            "peakGlucose": 190,
            "peakDelta": 82
          }
        ]
      },
      ...
    ]
  }
}
```

Períodos: `cafe_manha`, `almoco`, `lanche`, `jantar`, `outro`.

---

## Tratamentos

### Listar tratamentos

```
GET /api/treatments?startDate=<ISO>&endDate=<ISO>&limit=<n>&skip=<n>&eventType=<tipo>
```

| Parâmetro | Descrição |
|-----------|-----------|
| `startDate` | Data de início (opcional) |
| `endDate` | Data de fim (opcional) |
| `limit` | Itens por página (padrão: 50) |
| `skip` | Offset para paginação |
| `eventType` | Filtrar por tipo de evento |

### Registrar tratamento

```
POST /api/treatments
Content-Type: application/json
```

Corpo (todos os campos são opcionais, exceto `eventType`):
```json
{
  "eventType": "Meal Bolus",
  "created_at": "2026-02-20T12:00:00.000Z",
  "insulin": 4.5,
  "carbs": 45,
  "protein": 10,
  "fat": 15,
  "glucose": 140,
  "preBolus": -15,
  "immediateInsulin": 2.0,
  "extendedInsulin": 2.5,
  "duration": 120,
  "rate": 0.8,
  "rateMode": "absolute",
  "exerciseType": "aeróbico",
  "intensity": "moderada",
  "mealType": "almoco",
  "notes": "Almoço"
}
```

Tipos de evento aceitos:
```
Meal Bolus · Snack Bolus · Correction Bolus · Combo Bolus · Carb Correction
BG Check · Sensor Change · Site Change · Insulin Change
Rapid Pen Change · Slow Pen Change · Temp Basal · Exercise · Note · Basal Insulin
```

Valores de `mealType`: `almoco`, `jantar`, `cafe_manha`, `lanche`
(disponível apenas em Meal Bolus e Snack Bolus)

Resposta (`201`):
```json
{
  "success": true,
  "data": { "_id": "...", "eventType": "Meal Bolus", "insulin": 4.5, ... }
}
```

### Excluir tratamento

```
DELETE /api/treatments/:id
```

Resposta (`200`):
```json
{ "success": true }
```

---

## Configurações

### Carregar configurações

```
GET /api/settings
```

Resposta:
```json
{
  "success": true,
  "data": {
    "unit": "mgdl",
    "patientName": "João",
    "refreshInterval": 5,
    "alarmThresholds": {
      "veryLow": 54,
      "low": 70,
      "high": 180,
      "veryHigh": 250
    },
    "dia": 4,
    "carbAbsorptionRate": 30,
    "scheduledBasalRate": 0.8,
    "isf": 50,
    "icr": 12,
    "targetGlucoseMin": 80,
    "targetGlucoseMax": 140,
    "penIncrementFast": 1,
    "showAR2ByDefault": true,
    "deviceAges": {
      "sensor": { "warnDays": 11, "urgentDays": 14 },
      "cannula": { "warnDays": 3,  "urgentDays": 4  },
      "insulin": { "warnDays": 29, "urgentDays": 30 }
    }
  }
}
```

### Salvar configurações

```
PUT /api/settings
Content-Type: application/json
```

Corpo: qualquer subconjunto dos campos acima. Campos não enviados são preservados (merge).

Resposta (`200`):
```json
{ "success": true, "data": { /* configurações atualizadas */ } }
```

---

## Exemplo — curl completo

```bash
# 1. Obter token
TOKEN=$(curl -s -X POST http://192.168.1.10:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"sua_senha"}' | jq -r '.token')

# 2. Buscar TIR das últimas 14 dias
START=$(date -u -d '14 days ago' +%FT%TZ)
END=$(date -u +%FT%TZ)

curl -s "http://192.168.1.10:3001/api/analytics/tir?startDate=$START&endDate=$END" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 3. Registrar bolus
curl -s -X POST http://192.168.1.10:3001/api/treatments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"Meal Bolus","insulin":4.5,"carbs":45,"glucose":130,"mealType":"almoco"}'
```

---

## Códigos de status

| Código | Significado |
|--------|-------------|
| `200` | Sucesso |
| `201` | Criado com sucesso |
| `400` | Requisição inválida (parâmetros ausentes ou malformados) |
| `401` | Não autenticado (token ausente, inválido ou expirado) |
| `404` | Recurso não encontrado |
| `429` | Rate limit excedido |
| `500` | Erro interno do servidor |

Formato de erro:
```json
{
  "success": false,
  "error": "Descrição do erro"
}
```
