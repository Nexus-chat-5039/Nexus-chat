# Build Stage
FROM golang:alpine AS builder


ENV GOTOOLCHAIN=auto

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Cache dependencies
COPY services/nexus-ai-gateway/go.mod services/nexus-ai-gateway/go.sum ./services/nexus-ai-gateway/
WORKDIR /app/services/nexus-ai-gateway
RUN go mod download

# Copy source + proto stubs
WORKDIR /app
COPY services/nexus-ai-gateway/ services/nexus-ai-gateway/

# Build static binary
WORKDIR /app/services/nexus-ai-gateway
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /go/bin/gateway ./cmd/gateway


# Final Stage
FROM gcr.io/distroless/static:nonroot

COPY --from=builder /go/bin/gateway /gateway

USER nonroot:nonroot

EXPOSE 50052 8001

ENTRYPOINT ["/gateway"]
