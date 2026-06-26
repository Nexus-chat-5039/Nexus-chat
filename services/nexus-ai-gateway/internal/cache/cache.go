package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// CachedResponse is the structure stored in Redis for a cache hit.
type CachedResponse struct {
	Content          string `json:"content"`
	Model            string `json:"model"`
	PromptTokens     int32  `json:"prompt_tokens"`
	CompletionTokens int32  `json:"completion_tokens"`
}

// ResponseCache provides SHA-256-based prompt caching backed by Redis.
type ResponseCache struct {
	client *redis.Client
	ttl    time.Duration
}

// NewResponseCache creates a new cache connected to the given Redis URL.
func NewResponseCache(ctx context.Context, redisURL string, ttlSeconds int) (*ResponseCache, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("cache: parse redis url: %w", err)
	}

	client := redis.NewClient(opts)
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("cache: redis ping: %w", err)
	}

	return &ResponseCache{
		client: client,
		ttl:    time.Duration(ttlSeconds) * time.Second,
	}, nil
}

// HashKey generates a deterministic SHA-256 cache key from the prompt + context + model hint.
func HashKey(prompt, ragContext, modelHint string) string {
	h := sha256.New()
	h.Write([]byte(prompt))
	h.Write([]byte("|"))
	h.Write([]byte(ragContext))
	h.Write([]byte("|"))
	h.Write([]byte(modelHint))
	return "ai_cache:" + hex.EncodeToString(h.Sum(nil))
}

// Get attempts to retrieve a cached response. Returns nil if not found.
func (c *ResponseCache) Get(ctx context.Context, key string) *CachedResponse {
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		return nil
	}

	var cached CachedResponse
	if err := json.Unmarshal(data, &cached); err != nil {
		log.Printf("cache: unmarshal error for key %s: %v", key, err)
		return nil
	}

	return &cached
}

// Set stores a response in the cache with the configured TTL.
func (c *ResponseCache) Set(ctx context.Context, key string, resp *CachedResponse) {
	data, err := json.Marshal(resp)
	if err != nil {
		log.Printf("cache: marshal error: %v", err)
		return
	}

	if err := c.client.Set(ctx, key, data, c.ttl).Err(); err != nil {
		log.Printf("cache: set error: %v", err)
	}
}

// Close closes the Redis connection.
func (c *ResponseCache) Close() error {
	return c.client.Close()
}
