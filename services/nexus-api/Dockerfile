# Build Stage
FROM golang:1.24-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY services/nexus-api/go.mod services/nexus-api/go.sum ./services/nexus-api/
WORKDIR /app/services/nexus-api
RUN go mod download

WORKDIR /app
COPY services/nexus-api/ services/nexus-api/

WORKDIR /app/services/nexus-api
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /go/bin/api ./cmd/api

# Final Stage
FROM gcr.io/distroless/static:nonroot

COPY --from=builder /go/bin/api /api

USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/api"]
