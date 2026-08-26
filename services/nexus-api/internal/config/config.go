package config

import (
	"log"
	"os"
	"strings"
)

type Config struct {
	Env         string
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
	JWTExpiry   string
	CORSOrigin  string
}

func LoadConfig() *Config {
	env := getEnv("ENV", "development")
	isProd := env == "production"

	return &Config{
		Env:         env,
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: requireEnvIfProd(isProd, "DATABASE_URL", "postgres://root:rootpassword@localhost:5432/nexus?sslmode=disable"),
		RedisURL:    getEnv("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:   requireEnvIfProd(isProd, "JWT_SECRET", "supersecret-dev-key"),
		JWTExpiry:   getEnv("JWT_EXPIRY", "24h"),
		CORSOrigin:  requireEnvIfProd(isProd, "CORS_ORIGIN", "http://localhost:5173"),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func requireEnvIfProd(isProd bool, key, fallback string) string {
	v, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(v) == "" {
		if isProd {
			log.Fatalf("FATAL: Required environment variable %q is not set in production", key)
		}
		return fallback
	}
	return v
}
