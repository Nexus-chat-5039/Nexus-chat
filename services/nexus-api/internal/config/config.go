package config

import "os"

type Config struct {
	Port              string
	DatabaseURL       string
	FirebaseProjectID string
	CORSOrigin        string
}

func LoadConfig() *Config {
	return &Config{
		Port:              getEnv("PORT", "8080"),
		DatabaseURL:       getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/nexus?sslmode=disable"),
		FirebaseProjectID: getEnv("FIREBASE_PROJECT_ID", ""),
		CORSOrigin:        getEnv("CORS_ORIGIN", "http://localhost:5173"),
	}
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok {
		return v
	}
	return fallback
}
