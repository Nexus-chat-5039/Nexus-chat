package router

import (
	"context"
	"fmt"
	"log"

	"github.com/sony/gobreaker/v2"

	"nexus/services/nexus-ai-gateway/internal/cache"
	"nexus/services/nexus-ai-gateway/internal/circuit"
	"nexus/services/nexus-ai-gateway/internal/config"
	"nexus/services/nexus-ai-gateway/internal/providers"
)

// FallbackChain defines the ordered list of providers to try for a given model hint.
type FallbackChain struct {
	Model    string             // Which model to request from this provider
	Provider providers.Provider // The LLM provider adapter
	Breaker  *gobreaker.CircuitBreaker[any]
}

// ModelRouter routes requests to the appropriate LLM provider based on model_hint,
// applies circuit breakers, checks the response cache, and handles fallback.
type ModelRouter struct {
	chains map[string][]FallbackChain // model_hint → ordered list of (provider, model)
	cache  *cache.ResponseCache
}

// NewModelRouter constructs the router with providers, circuit breakers, and routing rules.
func NewModelRouter(cfg *config.Config, responseCache *cache.ResponseCache) *ModelRouter {
	// Initialize providers
	groq := providers.NewOpenAICompatProvider(cfg.Groq)
	gemini := providers.NewGeminiProvider(cfg.Gemini)
	openai := providers.NewOpenAICompatProvider(cfg.OpenAI)
	anthropic := providers.NewAnthropicProvider(cfg.Anthropic)
	deepseek := providers.NewOpenAICompatProvider(cfg.DeepSeek)

	// Create circuit breakers
	cbGroq := circuit.NewBreaker("groq", cfg.CBMaxFailures, cfg.CBTimeoutSec)
	cbGemini := circuit.NewBreaker("gemini", cfg.CBMaxFailures, cfg.CBTimeoutSec)
	cbOpenAI := circuit.NewBreaker("openai", cfg.CBMaxFailures, cfg.CBTimeoutSec)
	cbAnthropic := circuit.NewBreaker("anthropic", cfg.CBMaxFailures, cfg.CBTimeoutSec)
	cbDeepSeek := circuit.NewBreaker("deepseek", cfg.CBMaxFailures, cfg.CBTimeoutSec)

	// Build fallback chains per model_hint (Groq prioritized)
	chains := map[string][]FallbackChain{
		// Default / "fast" — cheap and quick
		"": {
			{Model: "llama-3.3-70b-versatile", Provider: groq, Breaker: cbGroq},
			{Model: "gemini-2.0-flash", Provider: gemini, Breaker: cbGemini},
			{Model: "deepseek-chat", Provider: deepseek, Breaker: cbDeepSeek},
			{Model: "gpt-4o-mini", Provider: openai, Breaker: cbOpenAI},
		},
		"fast": {
			{Model: "llama-3.3-70b-versatile", Provider: groq, Breaker: cbGroq},
			{Model: "gemini-2.0-flash", Provider: gemini, Breaker: cbGemini},
			{Model: "deepseek-chat", Provider: deepseek, Breaker: cbDeepSeek},
			{Model: "gpt-4o-mini", Provider: openai, Breaker: cbOpenAI},
		},
		// "quality" — high reasoning
		"quality": {
			{Model: "llama-3.3-70b-versatile", Provider: groq, Breaker: cbGroq},
			{Model: "gemini-1.5-pro", Provider: gemini, Breaker: cbGemini},
			{Model: "claude-sonnet-4-20250514", Provider: anthropic, Breaker: cbAnthropic},
			{Model: "gpt-4o", Provider: openai, Breaker: cbOpenAI},
		},
		// "code" — specialized for code generation
		"code": {
			{Model: "llama-3.3-70b-versatile", Provider: groq, Breaker: cbGroq},
			{Model: "deepseek-coder", Provider: deepseek, Breaker: cbDeepSeek},
			{Model: "gpt-4o", Provider: openai, Breaker: cbOpenAI},
			{Model: "gemini-1.5-pro", Provider: gemini, Breaker: cbGemini},
		},
		// "summarize" — speed + cost optimized
		"summarize": {
			{Model: "llama-3.3-70b-versatile", Provider: groq, Breaker: cbGroq},
			{Model: "gemini-2.0-flash", Provider: gemini, Breaker: cbGemini},
			{Model: "claude-3-5-haiku-20241022", Provider: anthropic, Breaker: cbAnthropic},
		},
		// "enterprise" — safety-focused
		"enterprise": {
			{Model: "llama-3.3-70b-versatile", Provider: groq, Breaker: cbGroq},
			{Model: "claude-sonnet-4-20250514", Provider: anthropic, Breaker: cbAnthropic},
			{Model: "gpt-4o", Provider: openai, Breaker: cbOpenAI},
			{Model: "gemini-1.5-pro", Provider: gemini, Breaker: cbGemini},
		},
	}


	// Filter out unavailable providers
	for hint, chain := range chains {
		filtered := make([]FallbackChain, 0, len(chain))
		for _, fc := range chain {
			if fc.Provider.Available() {
				filtered = append(filtered, fc)
			}
		}
		chains[hint] = filtered
	}

	return &ModelRouter{
		chains: chains,
		cache:  responseCache,
	}
}

// Generate performs a non-streaming completion, trying each provider in the fallback chain.
// It checks the cache first and populates it on a miss.
func (r *ModelRouter) Generate(ctx context.Context, prompt, ragContext, modelHint, tenantID string) (*providers.CompletionResult, error) {
	// 1. Check cache
	cacheKey := cache.HashKey(prompt, ragContext, modelHint)
	if r.cache != nil {
		if cached := r.cache.Get(ctx, cacheKey); cached != nil {
			log.Printf("[router] Cache HIT for tenant=%s hint=%s", tenantID, modelHint)
			return &providers.CompletionResult{
				Content:          cached.Content,
				Model:            cached.Model,
				PromptTokens:     cached.PromptTokens,
				CompletionTokens: cached.CompletionTokens,
			}, nil
		}
	}

	// 2. Get fallback chain
	chain, ok := r.chains[modelHint]
	if !ok || len(chain) == 0 {
		chain = r.chains[""]
	}
	if len(chain) == 0 {
		return nil, fmt.Errorf("no available providers for hint=%s", modelHint)
	}

	// 3. Try each provider in order
	var lastErr error
	for _, fc := range chain {
		log.Printf("[router] Trying %s/%s for tenant=%s", fc.Provider.Name(), fc.Model, tenantID)

		result, err := fc.Breaker.Execute(func() (any, error) {
			return fc.Provider.Generate(ctx, fc.Model, prompt, ragContext)
		})

		if err != nil {
			log.Printf("[router] %s/%s failed: %v", fc.Provider.Name(), fc.Model, err)
			lastErr = err
			continue
		}

		completionResult := result.(*providers.CompletionResult)

		// Populate cache
		if r.cache != nil {
			r.cache.Set(ctx, cacheKey, &cache.CachedResponse{
				Content:          completionResult.Content,
				Model:            completionResult.Model,
				PromptTokens:     completionResult.PromptTokens,
				CompletionTokens: completionResult.CompletionTokens,
			})
		}

		return completionResult, nil
	}

	return nil, fmt.Errorf("all providers failed for hint=%s: %w", modelHint, lastErr)
}

// StreamGenerate performs a streaming completion with fallback.
// Cache is NOT used for streaming (by design — streaming is latency-sensitive).
func (r *ModelRouter) StreamGenerate(ctx context.Context, prompt, ragContext, modelHint, tenantID string, out chan<- providers.StreamChunk) error {
	chain, ok := r.chains[modelHint]
	if !ok || len(chain) == 0 {
		chain = r.chains[""]
	}
	if len(chain) == 0 {
		close(out)
		return fmt.Errorf("no available providers for hint=%s", modelHint)
	}

	var lastErr error
	for _, fc := range chain {
		log.Printf("[router] Stream: trying %s/%s for tenant=%s", fc.Provider.Name(), fc.Model, tenantID)

		// Use the circuit breaker to check if the provider is available
		_, err := fc.Breaker.Execute(func() (any, error) {
			return nil, fc.Provider.StreamGenerate(ctx, fc.Model, prompt, ragContext, out)
		})

		if err != nil {
			log.Printf("[router] Stream: %s/%s failed: %v", fc.Provider.Name(), fc.Model, err)
			lastErr = err
			// [DESIGN LIMITATION] Fallback chain is dead code for streaming.
			// For streaming, the channel may already be closed by the failed provider.
			// We need a fresh channel for the next attempt — but the gRPC caller owns the channel.
			// So we can only try the first provider for streaming. If it fails, return error.
			break
		}

		return nil
	}

	return fmt.Errorf("stream: provider failed for hint=%s: %w", modelHint, lastErr)
}
