package redis

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	client *redis.Client
}

type AIStreamChunk struct {
	Delta     string `json:"delta"`
	IsFinal   bool   `json:"is_final"`
	MessageID string `json:"message_id,omitempty"`
}

func NewClient(ctx context.Context, redisURL string) (*Client, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse redis url: %w", err)
	}

	client := redis.NewClient(opts)
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to ping redis: %w", err)
	}

	return &Client{client: client}, nil
}

func (c *Client) PublishStreamChunk(ctx context.Context, chatID string, chunk AIStreamChunk) error {
	channel := fmt.Sprintf("room:%s:ai_stream", chatID)
	data, err := json.Marshal(chunk)
	if err != nil {
		return fmt.Errorf("failed to marshal chunk: %w", err)
	}

	return c.client.Publish(ctx, channel, data).Err()
}

func (c *Client) Close() error {
	return c.client.Close()
}
