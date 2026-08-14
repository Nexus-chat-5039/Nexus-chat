package config

import (
	"os"
	"strconv"
	"strings"
)

// ProviderConfig holds API keys and model mappings for a single LLM provider.
type ProviderConfig struct {
	Name    string
	APIKey  string
	BaseURL string
	Models  []string // Models available from this provider
}

// Config holds all service configuration.
type Config struct {
	GRPCPort int
	HTTPPort int
	RedisURL string

	// Response cache TTL in seconds (default: 3600 = 1 hour)
	CacheTTLSeconds int

	// Circuit breaker settings
	CBMaxFailures   uint32
	CBTimeoutSec    int

	// Provider configurations
	Gemini    ProviderConfig
	OpenAI    ProviderConfig
	Anthropic ProviderConfig
	DeepSeek  ProviderConfig
	Groq      ProviderConfig
}

func LoadConfig() *Config {
	return &Config{
		GRPCPort:        getEnvInt("GRPC_PORT", 50052),
		HTTPPort:        getEnvInt("HTTP_PORT", 8081),
		RedisURL:        getEnv("REDIS_URL", "redis://localhost:6379/0"),

		CacheTTLSeconds: getEnvInt("CACHE_TTL_SECONDS", 3600),
		CBMaxFailures:   uint32(getEnvInt("CB_MAX_FAILURES", 5)),
		CBTimeoutSec:    getEnvInt("CB_TIMEOUT_SEC", 30),

		Gemini: ProviderConfig{
			Name:    "gemini",
			APIKey:  getEnv("GEMINI_API_KEY", ""),
			BaseURL: getEnv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com"),
			Models:  getEnvSlice("GEMINI_MODELS", "gemini-2.0-flash,gemini-1.5-pro"),
		},
		OpenAI: ProviderConfig{
			Name:    "openai",
			APIKey:  getEnv("OPENAI_API_KEY", ""),
			BaseURL: getEnv("OPENAI_BASE_URL", "https://api.openai.com"),
			Models:  getEnvSlice("OPENAI_MODELS", "gpt-4o,gpt-4o-mini"),
		},
		Anthropic: ProviderConfig{
			Name:    "anthropic",
			APIKey:  getEnv("ANTHROPIC_API_KEY", ""),
			BaseURL: getEnv("ANTHROPIC_BASE_URL", "https://api.anthropic.com"),
			Models:  getEnvSlice("ANTHROPIC_MODELS", "claude-sonnet-4-20250514,claude-3-5-haiku-20241022"),
		},
		DeepSeek: ProviderConfig{
			Name:    "deepseek",
			APIKey:  getEnv("DEEPSEEK_API_KEY", ""),
			BaseURL: getEnv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
			Models:  getEnvSlice("DEEPSEEK_MODELS", "deepseek-chat,deepseek-coder"),
		},
		Groq: ProviderConfig{
			Name:    "groq",
			APIKey:  getEnv("GROQ_API_KEY", ""),
			BaseURL: getEnv("GROQ_BASE_URL", "https://api.groq.com/openai"),
			Models:  getEnvSlice("GROQ_MODELS", getEnv("GROQ_MODEL", "llama-3.3-70b-versatile,llama-3.1-8b-instant,mixtral-8x7b-32768")),
		},
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

func getEnvSlice(key, fallback string) []string {
	raw := getEnv(key, fallback)
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			result = append(result, t)
		}
	}
	return result
}
