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

# Run docker-compose up
up:
	docker compose up -d

# Run docker-compose down
down:
	docker compose down

# Run tests
test:
	@echo "Running Go tests..."
	cd services/nexus-api && go test ./...
	cd services/nexus-ai-gateway && go test ./...
	cd services/nexus-ai-worker && go test ./...
	cd services/nexus-billing && go test ./...
	@echo "Tests complete."

# Clean binaries
clean:
	rm -rf services/nexus-*/bin

# Show logs
logs:
	docker compose logs -f
