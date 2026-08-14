# Build Stage
FROM golang:alpine AS builder


ENV GOTOOLCHAIN=auto

WORKDIR /app

RUN apk add --no-cache git ca-certificates

# Cache dependencies
COPY services/nexus-billing/go.mod services/nexus-billing/go.sum ./services/nexus-billing/
WORKDIR /app/services/nexus-billing
RUN go mod download

# Copy source + proto stubs
WORKDIR /app
COPY services/nexus-billing/ services/nexus-billing/

# Build static binary
WORKDIR /app/services/nexus-billing
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /go/bin/billing ./cmd/billing


# Final Stage
FROM gcr.io/distroless/static:nonroot

COPY --from=builder /go/bin/billing /billing

USER nonroot:nonroot

EXPOSE 50053 8003

ENTRYPOINT ["/billing"]
