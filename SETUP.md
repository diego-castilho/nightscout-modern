# 🚀 Guia de Setup - Nightscout Modern

Este guia vai te ajudar a colocar o Nightscout Modern rodando em poucos minutos.

## 📋 Pré-requisitos

Você já tem tudo o que precisa! ✅
- ✅ Docker e Docker Compose instalados
- ✅ Nightscout rodando no IP 10.0.0.226
- ✅ MongoDB rodando no IP 10.0.0.225
- ✅ Network MacVLAN configurada

## 🔧 Configuração Rápida

### 1. Configure as Variáveis de Ambiente

```bash
cd /home/dcastilho/nightscout-modern

# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env
nano .env
```

**Variáveis obrigatórias:**
```bash
# Copie o API_SECRET do seu Nightscout existente
NIGHTSCOUT_API_SECRET=app-e708611ec4084fe7

# Gere um novo JWT secret (pode usar qualquer string aleatória longa)
NIGHTSCOUT_MODERN_JWT_SECRET=seu-jwt-secret-super-secreto-aqui-123456789

# MongoDB (use os mesmos valores do seu Nightscout atual)
MONGODB_USER=seu-usuario-mongodb
MONGODB_PASSWORD=sua-senha-mongodb
```

**Variáveis opcionais:**
```bash
# Para integração com LibreLink MCP (fase futura)
LIBRELINK_USERNAME=seu-email-librelink
LIBRELINK_PASSWORD=sua-senha-librelink
```

### 2. Build e Start

```bash
# Build das imagens Docker
docker-compose build

# Start dos containers
docker-compose up -d

# Verifique os logs
docker-compose logs -f
```

### 3. Acesse a Aplicação

- **Frontend**: http://10.0.0.231
- **Backend API**: http://10.0.0.229:3001/api
- **Health Check**: http://10.0.0.229:3001/api/health

## 🧪 Testando a API

```bash
# Health check
curl http://10.0.0.229:3001/api/health

# Latest glucose
curl http://10.0.0.229:3001/api/glucose/latest

# Database stats
curl http://10.0.0.229:3001/api/stats

# 24h analytics (ajuste as datas)
curl "http://10.0.0.229:3001/api/analytics?startDate=2024-01-20T00:00:00Z&endDate=2024-01-21T00:00:00Z"
```

## 🛠️ Desenvolvimento Local (Opcional)

Se você quer desenvolver e testar localmente:

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Configure o .env
nano .env
npm run dev
```

Acesse: http://localhost:3001/api

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Configure o .env
nano .env
npm run dev
```

Acesse: http://localhost:5173

### Helper Script

Use o script helper para facilitar:

```bash
# Setup inicial (instala dependências)
./dev.sh setup

# Start dev servers (backend + frontend em tmux)
./dev.sh start

# Build Docker images
./dev.sh build

# Start containers
./dev.sh up

# View logs
./dev.sh logs
./dev.sh logs nightscout-modern-backend

# Stop containers
./dev.sh down

# Clean everything
./dev.sh clean
```

## 🔍 Troubleshooting

### Container não inicia

```bash
# Verifique os logs
docker-compose logs nightscout-modern-backend
docker-compose logs nightscout-modern-frontend

# Verifique se as portas estão livres
netstat -tulpn | grep -E '3001|80'

# Verifique a rede MacVLAN
docker network inspect docker_macvlan
```

### MongoDB connection error

```bash
# Teste a conexão MongoDB
docker exec -it nightscout-modern-backend sh
# Dentro do container:
wget -O- http://10.0.0.225:27017
```

Verifique se:
- MongoDB está rodando: `docker ps | grep mongodb`
- Credenciais estão corretas no `.env`
- IP 10.0.0.225 está acessível

### Frontend não carrega dados

```bash
# Teste o backend diretamente
curl http://10.0.0.229:3001/api/health

# Verifique as variáveis de ambiente do frontend
docker exec -it nightscout-modern-frontend cat /etc/nginx/conf.d/default.conf

# Verifique os logs do browser
# Abra DevTools (F12) -> Console -> Network
```

### IP addresses conflitam

Se os IPs 10.0.0.229 ou 10.0.0.231 já estão em uso:

1. Edite `docker-compose.yml`
2. Mude os IPs para valores livres na sua rede
3. Atualize o `CORS_ORIGIN` no backend
4. Rebuild: `docker-compose down && docker-compose build && docker-compose up -d`

## 📱 Integrando com Cloudflare Tunnel

Para acessar de fora da sua rede local:

1. Adicione ao seu tunnel Cloudflare existente:

```yaml
ingress:
  - hostname: nightscout-modern.diegocastilho.me
    service: http://10.0.0.231
```

2. Atualize o `CORS_ORIGIN` no `.env`:

```bash
CORS_ORIGIN=http://10.0.0.231,https://nightscout-modern.diegocastilho.me
```

3. Rebuild o backend:

```bash
docker-compose up -d --build nightscout-modern-backend
```

## 🎉 Pronto!

Agora você tem:
- ✅ Backend API rodando em 10.0.0.229:3001
- ✅ Frontend rodando em 10.0.0.231
- ✅ Analytics avançado de glicose
- ✅ WebSocket para updates em tempo real

## 📚 Próximos Passos

1. **Explore a API**: http://10.0.0.229:3001/api
2. **Customize a UI**: Edite os componentes em `frontend/src`
3. **Adicione features**: Veja o [README.md](README.md) para o roadmap

## 💡 Dicas

- Use `docker-compose logs -f` para monitorar em tempo real
- O backend tem hot-reload em modo desenvolvimento
- O frontend é compilado estaticamente (precisa rebuild para mudanças)
- MongoDB change streams permitem updates em tempo real sem polling

## 🆘 Precisa de Ajuda?

- Verifique os logs: `docker-compose logs`
- Teste a conexão MongoDB: `/api/stats`
- Teste a API: `/api/health`
- Veja o código de exemplo no `App.tsx`
