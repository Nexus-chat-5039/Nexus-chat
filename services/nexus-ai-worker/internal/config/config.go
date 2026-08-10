package config

import (
	"os"
)

type Config struct {
	// Infrastructure
	GCPProjectID string
	PubSubSubID  string
	DatabaseURL  string
	RedisURL     string

	// Downstream Services
	RAGServiceURL string
	GatewayURL    string
	BillingURL    string
}

func LoadConfig() *Config {
	return &Config{
		GCPProjectID:  getEnv("GCP_PROJECT_ID", "nexus-local"),
		PubSubSubID:   getEnv("PUBSUB_SUB_ID", "ai-inference-sub"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/nexus?sslmode=disable"),
		RedisURL:      getEnv("REDIS_URL", "redis://localhost:6379/0"),
		RAGServiceURL: getEnv("RAG_SERVICE_URL", "localhost:50051"),
		GatewayURL:    getEnv("GATEWAY_URL", "localhost:50052"),
		BillingURL:    getEnv("BILLING_URL", "localhost:50053"),
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
