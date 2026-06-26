package providers

import (
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

// GeminiProvider implements the Provider interface for Google Gemini.
type GeminiProvider struct {
	cfg    config.ProviderConfig
	client *http.Client
}

func NewGeminiProvider(cfg config.ProviderConfig) *GeminiProvider {
	return &GeminiProvider{
		cfg:    cfg,
		client: &http.Client{},
	}
}

func (g *GeminiProvider) Name() string        { return g.cfg.Name }
func (g *GeminiProvider) DefaultModel() string {
	if len(g.cfg.Models) == 0 {
		return ""
	}
	return g.cfg.Models[0]
}
func (g *GeminiProvider) Available() bool { return g.cfg.APIKey != "" && len(g.cfg.Models) > 0 }
func (g *GeminiProvider) SupportsModel(m string) bool {
	for _, model := range g.cfg.Models {
		if model == m {
			return true
		}
	}
	return false
}

// --- Gemini REST API structures ---

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
	Role  string       `json:"role,omitempty"`
}

type geminiPart struct {
	Text string `json:"text"`
}

type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []geminiPart `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	UsageMetadata struct {
		PromptTokenCount     int32 `json:"promptTokenCount"`
		CandidatesTokenCount int32 `json:"candidatesTokenCount"`
	} `json:"usageMetadata"`
}

type geminiStreamResponse struct {
	Candidates []struct {
		Content struct {
			Parts []geminiPart `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason"`
	} `json:"candidates"`
	UsageMetadata struct {
		PromptTokenCount     int32 `json:"promptTokenCount"`
		CandidatesTokenCount int32 `json:"candidatesTokenCount"`
	} `json:"usageMetadata"`
}

func (g *GeminiProvider) buildPrompt(prompt, ragContext string) geminiRequest {
	var fullPrompt string
	if ragContext != "" {
		fullPrompt = fmt.Sprintf("Use the following context to answer the question.\n\nContext:\n%s\n\nQuestion: %s", ragContext, prompt)
	} else {
		fullPrompt = prompt
	}

	return geminiRequest{
		Contents: []geminiContent{
			{Parts: []geminiPart{{Text: fullPrompt}}},
		},
	}
}

func (g *GeminiProvider) Generate(ctx context.Context, model, prompt, ragContext string) (*CompletionResult, error) {
	if model == "" {
		model = g.DefaultModel()
	}

	url := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", g.cfg.BaseURL, model, g.cfg.APIKey)

	body, err := json.Marshal(g.buildPrompt(prompt, ragContext))
	if err != nil {
		return nil, fmt.Errorf("gemini: marshal error: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("gemini: request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gemini: http error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("gemini: status %d: %s", resp.StatusCode, string(b))
	}

	var gemResp geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&gemResp); err != nil {
		return nil, fmt.Errorf("gemini: decode error: %w", err)
	}

	if len(gemResp.Candidates) == 0 || len(gemResp.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("gemini: empty response")
	}

	return &CompletionResult{
		Content:          gemResp.Candidates[0].Content.Parts[0].Text,
		Model:            model,
		PromptTokens:     gemResp.UsageMetadata.PromptTokenCount,
		CompletionTokens: gemResp.UsageMetadata.CandidatesTokenCount,
	}, nil
}

func (g *GeminiProvider) StreamGenerate(ctx context.Context, model, prompt, ragContext string, out chan<- StreamChunk) error {
	defer close(out)

	if model == "" {
		model = g.DefaultModel()
	}

	url := fmt.Sprintf("%s/v1beta/models/%s:streamGenerateContent?alt=sse&key=%s", g.cfg.BaseURL, model, g.cfg.APIKey)

	body, err := json.Marshal(g.buildPrompt(prompt, ragContext))
	if err != nil {
		return fmt.Errorf("gemini: marshal error: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("gemini: request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.client.Do(req)
	if err != nil {
		return fmt.Errorf("gemini: http error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("gemini: status %d: %s", resp.StatusCode, string(b))
	}

	// Parse SSE stream
	buf := make([]byte, 4096)
	reader := resp.Body
	var leftover string

	for {
		n, readErr := reader.Read(buf)
		if n > 0 {
			data := leftover + string(buf[:n])
			leftover = ""

			lines := strings.Split(data, "\n")
			for i, line := range lines {
				// If this is the last segment and doesn't end with newline, it's incomplete
				if i == len(lines)-1 && !strings.HasSuffix(data, "\n") {
					leftover = line
					continue
				}

				line = strings.TrimSpace(line)
				if !strings.HasPrefix(line, "data: ") {
					continue
				}

				jsonData := strings.TrimPrefix(line, "data: ")
				if jsonData == "" {
					continue
				}

				var chunk geminiStreamResponse
				if err := json.Unmarshal([]byte(jsonData), &chunk); err != nil {
					log.Printf("gemini: stream parse error: %v", err)
					continue
				}

				if len(chunk.Candidates) > 0 && len(chunk.Candidates[0].Content.Parts) > 0 {
					isFinal := chunk.Candidates[0].FinishReason == "STOP"
					out <- StreamChunk{
						Delta:   chunk.Candidates[0].Content.Parts[0].Text,
						IsFinal: isFinal,
						Model:   model,
					}
					if isFinal {
						return nil
					}
				}
			}
		}
		if readErr != nil {
			if readErr == io.EOF {
				// Send final if we haven't yet
				out <- StreamChunk{IsFinal: true, Model: model}
				return nil
			}
			return fmt.Errorf("gemini: stream read error: %w", readErr)
		}
	}
}
