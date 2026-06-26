# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

# Install dependencies for CGO and building
RUN apk add --no-cache git ca-certificates

# Copy module files first for caching
COPY services/nexus-ai-worker/go.mod services/nexus-ai-worker/go.sum ./services/nexus-ai-worker/
WORKDIR /app/services/nexus-ai-worker
RUN go mod download

# Copy source code
WORKDIR /app
COPY services/nexus-ai-worker/ services/nexus-ai-worker/

# Build the binary
WORKDIR /app/services/nexus-ai-worker
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /go/bin/worker ./cmd/worker

# Final Stage
FROM gcr.io/distroless/static:nonroot

WORKDIR /

# Copy binary from builder
COPY --from=builder /go/bin/worker /worker

USER nonroot:nonroot

# Run the binary
ENTRYPOINT ["/worker"]
