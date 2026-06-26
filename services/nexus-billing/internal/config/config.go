package config

import (
	"os"
	"strconv"
)

type Config struct {
	GRPCPort       int
	HTTPPort       int
	GCPProjectID   string
	BQDatasetID    string
	BQTableID      string
}

func LoadConfig() *Config {
	return &Config{
		GRPCPort:     getEnvInt("GRPC_PORT", 50053),
		HTTPPort:     getEnvInt("HTTP_PORT", 8003),
		GCPProjectID: getEnv("GCP_PROJECT_ID", "nexus-local"),
		BQDatasetID:  getEnv("BQ_DATASET_ID", "nexus_billing"),
		BQTableID:    getEnv("BQ_TABLE_ID", "token_usage"),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}
