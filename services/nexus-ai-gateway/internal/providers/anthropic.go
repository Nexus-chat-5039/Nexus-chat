package providers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"nexus/services/nexus-ai-gateway/internal/config"
)

// AnthropicProvider implements the Provider interface for Anthropic Claude.
// Anthropic uses a distinct Messages API (not OpenAI-compatible).
type AnthropicProvider struct {
	cfg    config.ProviderConfig
	client *http.Client
}

func NewAnthropicProvider(cfg config.ProviderConfig) *AnthropicProvider {
	return &AnthropicProvider{
		cfg:    cfg,
		client: &http.Client{},
	}
}

func (a *AnthropicProvider) Name() string        { return a.cfg.Name }
func (a *AnthropicProvider) DefaultModel() string {
	if len(a.cfg.Models) == 0 {
		return ""
	}
	return a.cfg.Models[0]
}
func (a *AnthropicProvider) Available() bool { return a.cfg.APIKey != "" && len(a.cfg.Models) > 0 }
func (a *AnthropicProvider) SupportsModel(m string) bool {
	for _, model := range a.cfg.Models {
		if model == m {
			return true
		}
	}
	return false
}

// --- Anthropic Messages API structures ---

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	System    string             `json:"system,omitempty"`
	Messages  []anthropicMessage `json:"messages"`
	Stream    bool               `json:"stream,omitempty"`
}

type anthropicResponse struct {
	Content []struct {
		Text string `json:"text"`
	} `json:"content"`
	Model string `json:"model"`
	Usage struct {
		InputTokens  int32 `json:"input_tokens"`
		OutputTokens int32 `json:"output_tokens"`
	} `json:"usage"`
}

type anthropicStreamEvent struct {
	Type  string `json:"type"`
	Delta struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"delta,omitempty"`
}

func (a *AnthropicProvider) Generate(ctx context.Context, model, prompt, ragContext string) (*CompletionResult, error) {
	if model == "" {
		model = a.DefaultModel()
	}

	reqBody := anthropicRequest{
		Model:     model,
		MaxTokens: 4096,
		Messages:  []anthropicMessage{{Role: "user", Content: prompt}},
		Stream:    false,
	}

	if ragContext != "" {
		reqBody.System = fmt.Sprintf("Use the following context to answer the user's question.\n\nContext:\n%s", ragContext)
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("anthropic: marshal error: %w", err)
	}

	url := strings.TrimRight(a.cfg.BaseURL, "/") + "/v1/messages"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("anthropic: request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", a.cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("anthropic: http error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("anthropic: status %d: %s", resp.StatusCode, string(b))
	}

	var anthResp anthropicResponse
	if err := json.NewDecoder(resp.Body).Decode(&anthResp); err != nil {
		return nil, fmt.Errorf("anthropic: decode error: %w", err)
	}

	if len(anthResp.Content) == 0 {
		return nil, fmt.Errorf("anthropic: empty response")
	}

	return &CompletionResult{
		Content:          anthResp.Content[0].Text,
		Model:            anthResp.Model,
		PromptTokens:     anthResp.Usage.InputTokens,
		CompletionTokens: anthResp.Usage.OutputTokens,
	}, nil
}

func (a *AnthropicProvider) StreamGenerate(ctx context.Context, model, prompt, ragContext string, out chan<- StreamChunk) error {
	defer close(out)

	if model == "" {
		model = a.DefaultModel()
	}

	reqBody := anthropicRequest{
		Model:     model,
		MaxTokens: 4096,
		Messages:  []anthropicMessage{{Role: "user", Content: prompt}},
		Stream:    true,
	}

	if ragContext != "" {
		reqBody.System = fmt.Sprintf("Use the following context to answer the user's question.\n\nContext:\n%s", ragContext)
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("anthropic: marshal error: %w", err)
	}

	url := strings.TrimRight(a.cfg.BaseURL, "/") + "/v1/messages"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("anthropic: request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", a.cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := a.client.Do(req)
	if err != nil {
		return fmt.Errorf("anthropic: http error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("anthropic: status %d: %s", resp.StatusCode, string(b))
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		jsonData := strings.TrimPrefix(line, "data: ")
		if jsonData == "" {
			continue
		}

		var event anthropicStreamEvent
		if err := json.Unmarshal([]byte(jsonData), &event); err != nil {
			log.Printf("anthropic: stream parse error: %v", err)
			continue
		}

		switch event.Type {
		case "content_block_delta":
			if event.Delta.Text != "" {
				out <- StreamChunk{
					Delta:   event.Delta.Text,
					IsFinal: false,
					Model:   model,
				}
			}
		case "message_stop":
			out <- StreamChunk{IsFinal: true, Model: model}
			return nil
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("anthropic: scanner error: %w", err)
	}

	out <- StreamChunk{IsFinal: true, Model: model}
	return nil
}
