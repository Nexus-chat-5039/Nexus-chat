.PHONY: all build build-all up down test clean logs

# Default target
all: build-all

# Build all Go binaries
build-all:
	@echo "Building all Go services..."
	cd services/nexus-api && go build -o bin/api ./cmd/api
	cd services/nexus-ai-gateway && go build -o bin/gateway ./cmd/gateway
	cd services/nexus-ai-worker && go build -o bin/worker ./cmd/worker
	cd services/nexus-billing && go build -o bin/billing ./cmd/billing
	@echo "Build complete."

# Build production docker images locally
build-prod:
	@echo "Building production Docker images..."
	docker compose -f docker-compose.prod.yml build

# Run docker-compose up for development
up:
	docker compose up -d

# Run production docker-compose
prod-up:
	docker compose -f docker-compose.prod.yml up -d

# Run docker-compose down
down:
	docker compose down
	docker compose -f docker-compose.prod.yml down

# Run tests
test:
	@echo "Running Go tests..."
	cd services/nexus-api && go test ./...
	cd services/nexus-ai-gateway && go test ./...
	cd services/nexus-ai-worker && go test ./...
	cd services/nexus-billing && go test ./...
	@echo "Tests complete."

# Run Load Tests (Usage: make test-load-api USERS=500 DURATION=20)
test-load-api:
	USERS=$(or $(USERS),100) DURATION=$(or $(DURATION),15) RAMP=$(or $(RAMP),3) node tests/load/api_load_test.js

test-load-socket:
	USERS=$(or $(USERS),100) DURATION=$(or $(DURATION),15) RAMP=$(or $(RAMP),3) node tests/load/socket_load_test.js

# Run 10,000 Requests Stress Test
test-10k:
	REQUESTS=10000 CONCURRENCY=300 node tests/load/api_10k_test.js


# Clean binaries
clean:
	rm -rf services/nexus-*/bin

# Show logs
logs:
	docker compose logs -f

