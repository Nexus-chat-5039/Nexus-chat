package config

import (
	"os"
)

type Config struct {
	// Infrastructure
	GCPProjectID     string
	PubSubSubID      string
	PubSubEmbedSubID string
	DatabaseURL      string
	RedisURL         string

	// Downstream Services
	RAGServiceURL string
	GatewayURL    string
	BillingURL    string
}


func LoadConfig() *Config {
	env := getEnv("ENV", "development")
	if env != "production" && os.Getenv("PUBSUB_EMULATOR_HOST") == "" && os.Getenv("GOOGLE_APPLICATION_CREDENTIALS") == "" {
		// Default to local pubsub emulator host for local development
		_ = os.Setenv("PUBSUB_EMULATOR_HOST", "localhost:8085")
	}

	return &Config{
		GCPProjectID:     getEnv("GCP_PROJECT_ID", "nexus-local"),
		PubSubSubID:      getEnv("PUBSUB_SUB_ID", "ai-inference-sub"),
		PubSubEmbedSubID: getEnv("PUBSUB_EMBED_SUB_ID", "embed-messages-sub"),
		DatabaseURL:      getEnv("DATABASE_URL", "postgres://root:rootpassword@localhost:5432/nexus?sslmode=disable"),
		RedisURL:         getEnv("REDIS_URL", "redis://localhost:6379/0"),
		RAGServiceURL:    getEnv("RAG_SERVICE_URL", "localhost:50051"),
		GatewayURL:       getEnv("GATEWAY_URL", "localhost:50052"),
		BillingURL:       getEnv("BILLING_URL", "localhost:50053"),
	}
}



func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
