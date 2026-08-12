# Build Stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /go/bin/api ./cmd/api

# Final Stage
FROM gcr.io/distroless/static:nonroot

COPY --from=builder /go/bin/api /api

USER nonroot:nonroot

EXPOSE 8080

ENTRYPOINT ["/api"]
