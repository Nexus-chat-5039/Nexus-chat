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

// OpenAICompatProvider is a unified adapter for any provider that implements
// the OpenAI chat completions API (OpenAI, DeepSeek, and others).
type OpenAICompatProvider struct {
	cfg    config.ProviderConfig
	client *http.Client
}

func NewOpenAICompatProvider(cfg config.ProviderConfig) *OpenAICompatProvider {
	return &OpenAICompatProvider{
		cfg:    cfg,
		client: &http.Client{},
	}
}

func (o *OpenAICompatProvider) Name() string        { return o.cfg.Name }
func (o *OpenAICompatProvider) DefaultModel() string {
	if len(o.cfg.Models) == 0 {
		return ""
	}
	return o.cfg.Models[0]
}
func (o *OpenAICompatProvider) Available() bool { return o.cfg.APIKey != "" && len(o.cfg.Models) > 0 }
func (o *OpenAICompatProvider) SupportsModel(m string) bool {
	for _, model := range o.cfg.Models {
		if model == m {
			return true
		}
	}
	return false
}

// --- OpenAI Chat Completions structures ---

type oaiMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type oaiRequest struct {
	Model    string       `json:"model"`
	Messages []oaiMessage `json:"messages"`
	Stream   bool         `json:"stream,omitempty"`
}

type oaiResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int32 `json:"prompt_tokens"`
		CompletionTokens int32 `json:"completion_tokens"`
	} `json:"usage"`
	Model string `json:"model"`
}

type oaiStreamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
	Model string `json:"model"`
}

func (o *OpenAICompatProvider) buildMessages(prompt, ragContext string) []oaiMessage {
	msgs := make([]oaiMessage, 0, 2)
	systemPrompt := "You are Nexus AI assistant, an intelligent pair programmer and workspace collaborator in a team chat channel. You have direct access to the recent conversation history in this channel and relevant knowledge context. When the user asks to summarize, explain, or answer questions about previous messages or what was discussed, reference and summarize the provided conversation history accurately."
	if ragContext != "" {
		systemPrompt += fmt.Sprintf("\n\n%s", ragContext)
	}
	msgs = append(msgs, oaiMessage{
		Role:    "system",
		Content: systemPrompt,
	})
	msgs = append(msgs, oaiMessage{Role: "user", Content: prompt})
	return msgs
}


func (o *OpenAICompatProvider) apiURL() string {
	base := strings.TrimRight(o.cfg.BaseURL, "/")
	return base + "/v1/chat/completions"
}

func (o *OpenAICompatProvider) Generate(ctx context.Context, model, prompt, ragContext string) (*CompletionResult, error) {
	if model == "" {
		model = o.DefaultModel()
	}

	reqBody := oaiRequest{
		Model:    model,
		Messages: o.buildMessages(prompt, ragContext),
		Stream:   false,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("%s: marshal error: %w", o.cfg.Name, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, o.apiURL(), bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%s: request error: %w", o.cfg.Name, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+o.cfg.APIKey)

	resp, err := o.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%s: http error: %w", o.cfg.Name, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("%s: status %d: %s", o.cfg.Name, resp.StatusCode, string(b))
	}

	var oaiResp oaiResponse
	if err := json.NewDecoder(resp.Body).Decode(&oaiResp); err != nil {
		return nil, fmt.Errorf("%s: decode error: %w", o.cfg.Name, err)
	}

	if len(oaiResp.Choices) == 0 {
		return nil, fmt.Errorf("%s: empty response", o.cfg.Name)
	}

	return &CompletionResult{
		Content:          oaiResp.Choices[0].Message.Content,
		Model:            oaiResp.Model,
		PromptTokens:     oaiResp.Usage.PromptTokens,
		CompletionTokens: oaiResp.Usage.CompletionTokens,
	}, nil
}

func (o *OpenAICompatProvider) StreamGenerate(ctx context.Context, model, prompt, ragContext string, out chan<- StreamChunk) error {
	defer close(out)

	if model == "" {
		model = o.DefaultModel()
	}

	reqBody := oaiRequest{
		Model:    model,
		Messages: o.buildMessages(prompt, ragContext),
		Stream:   true,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("%s: marshal error: %w", o.cfg.Name, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, o.apiURL(), bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("%s: request error: %w", o.cfg.Name, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+o.cfg.APIKey)

	resp, err := o.client.Do(req)
	if err != nil {
		return fmt.Errorf("%s: http error: %w", o.cfg.Name, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%s: status %d: %s", o.cfg.Name, resp.StatusCode, string(b))
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || line == "data: [DONE]" {
			if line == "data: [DONE]" {
				out <- StreamChunk{IsFinal: true, Model: model}
				return nil
			}
			continue
		}

		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		jsonData := strings.TrimPrefix(line, "data: ")

		var chunk oaiStreamChunk
		if err := json.Unmarshal([]byte(jsonData), &chunk); err != nil {
			log.Printf("%s: stream parse error: %v", o.cfg.Name, err)
			continue
		}

		if len(chunk.Choices) > 0 {
			delta := chunk.Choices[0].Delta.Content
			isFinal := chunk.Choices[0].FinishReason != nil && *chunk.Choices[0].FinishReason == "stop"

			if delta != "" || isFinal {
				out <- StreamChunk{
					Delta:   delta,
					IsFinal: isFinal,
					Model:   model,
				}
			}
			if isFinal {
				return nil
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("%s: scanner error: %w", o.cfg.Name, err)
	}

	// Stream ended without explicit [DONE]
	out <- StreamChunk{IsFinal: true, Model: model}
	return nil
}
