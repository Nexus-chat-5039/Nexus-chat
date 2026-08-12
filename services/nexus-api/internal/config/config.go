package config

import "os"

type Config struct {
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
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnvOrFallback(isProd, "DATABASE_URL", "postgres://root:rootpassword@localhost:5432/nexus?sslmode=disable"),
		RedisURL:    getEnvOrFallback(isProd, "REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:   getEnvOrFallback(isProd, "JWT_SECRET", "supersecret-dev-key"),
		JWTExpiry:   getEnv("JWT_EXPIRY", "24h"),
		CORSOrigin:  getEnvOrFallback(isProd, "CORS_ORIGIN", "http://localhost:5173"),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}

func getEnvOrFallback(isProd bool, key, fallback string) string {
	v, ok := os.LookupEnv(key)
	if !ok || v == "" {
		if isProd && fallback == "" {
			panic("Missing required environment variable in production: " + key)
		}
		return fallback
	}
	return v
}
