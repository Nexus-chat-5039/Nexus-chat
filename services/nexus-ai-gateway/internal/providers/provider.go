package providers

import "context"

// StreamChunk represents a single token/chunk from an LLM streaming response.
type StreamChunk struct {
	Delta    string // Incremental text
	IsFinal  bool   // True on the last chunk
	Model    string // Which model produced this
}

// CompletionResult is the full response from a non-streaming call.
type CompletionResult struct {
	Content          string
	Model            string
	PromptTokens     int32
	CompletionTokens int32
}

// Provider is the interface every LLM adapter must implement.
type Provider interface {
	// Name returns the provider identifier (e.g. "gemini", "openai").
	Name() string

	// Generate performs a non-streaming completion.
	Generate(ctx context.Context, model, prompt, ragContext string) (*CompletionResult, error)

	// StreamGenerate performs a streaming completion and sends chunks to the channel.
	// The channel is closed by the provider when the stream ends.
	StreamGenerate(ctx context.Context, model, prompt, ragContext string, out chan<- StreamChunk) error

	// SupportsModel returns true if this provider can serve the given model name.
	SupportsModel(model string) bool

	// DefaultModel returns the primary model for this provider.
	DefaultModel() string

	// Available returns true if the provider has an API key configured.
	Available() bool
}
