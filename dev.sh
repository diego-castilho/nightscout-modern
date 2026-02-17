#!/bin/bash
# ============================================================================
# Development Helper Script
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}============================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Commands
case "$1" in
    "setup")
        print_header "Setting up Nightscout Modern"

        # Backend setup
        echo "Setting up backend..."
        cd backend
        if [ ! -f ".env" ]; then
            cp .env.example .env
            print_warning "Created backend/.env - please configure it"
        fi
        npm install
        cd ..
        print_success "Backend setup complete"

        # Frontend setup
        echo "Setting up frontend..."
        cd frontend
        if [ ! -f ".env" ]; then
            cp .env.example .env
            print_warning "Created frontend/.env - please configure it"
        fi
        npm install
        cd ..
        print_success "Frontend setup complete"

        print_success "Setup complete! Configure .env files and run './dev.sh start'"
        ;;

    "start")
        print_header "Starting Development Servers"

        # Check if tmux is available
        if command -v tmux &> /dev/null; then
            tmux new-session -d -s nightscout-modern
            tmux split-window -h
            tmux select-pane -t 0
            tmux send-keys "cd backend && npm run dev" C-m
            tmux select-pane -t 1
            tmux send-keys "cd frontend && npm run dev" C-m
            tmux attach-session -t nightscout-modern
        else
            print_warning "tmux not found. Starting in separate terminals..."
            gnome-terminal -- bash -c "cd backend && npm run dev; exec bash" &
            gnome-terminal -- bash -c "cd frontend && npm run dev; exec bash" &
        fi
        ;;

    "build")
        print_header "Building Docker Images"
        docker-compose build
        print_success "Build complete"
        ;;

    "up")
        print_header "Starting Docker Containers"
        docker-compose up -d
        print_success "Containers started"
        docker-compose ps
        ;;

    "down")
        print_header "Stopping Docker Containers"
        docker-compose down
        print_success "Containers stopped"
        ;;

    "logs")
        print_header "Viewing Logs"
        if [ -z "$2" ]; then
            docker-compose logs -f
        else
            docker-compose logs -f "$2"
        fi
        ;;

    "test")
        print_header "Running Tests"
        print_warning "Tests not implemented yet"
        ;;

    "clean")
        print_header "Cleaning up"
        echo "Removing node_modules and build artifacts..."
        rm -rf backend/node_modules backend/dist
        rm -rf frontend/node_modules frontend/dist
        print_success "Cleanup complete"
        ;;

    *)
        print_header "Nightscout Modern - Development Helper"
        echo ""
        echo "Usage: ./dev.sh [command]"
        echo ""
        echo "Commands:"
        echo "  setup   - Install dependencies and setup .env files"
        echo "  start   - Start development servers (backend + frontend)"
        echo "  build   - Build Docker images"
        echo "  up      - Start Docker containers"
        echo "  down    - Stop Docker containers"
        echo "  logs    - View container logs (use: ./dev.sh logs [service])"
        echo "  test    - Run tests"
        echo "  clean   - Remove node_modules and build artifacts"
        echo ""
        ;;
esac
