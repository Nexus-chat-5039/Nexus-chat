package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Client struct {
	Pool    *pgxpool.Pool
	Queries *Queries
}

func NewClient(ctx context.Context, databaseURL string) (*Client, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	config.MaxConns = 10
	config.MinConns = 2
	config.MaxConnLifetime = time.Hour

	var pool *pgxpool.Pool
	maxRetries := 10
	for attempt := 1; attempt <= maxRetries; attempt++ {
		var err error
		pool, err = pgxpool.NewWithConfig(ctx, config)
		if err == nil {
			pingCtx, pingCancel := context.WithTimeout(ctx, 3*time.Second)
			err = pool.Ping(pingCtx)
			pingCancel()
			if err == nil {
				break
			}
			pool.Close()
		}

		if attempt == maxRetries {
			return nil, fmt.Errorf("failed to ping database after %d attempts: %w", maxRetries, err)
		}
		time.Sleep(2 * time.Second)
	}


	queries := New(pool)

	return &Client{
		Pool:    pool,
		Queries: queries,
	}, nil
}

func (c *Client) Close() {
	if c.Pool != nil {
		c.Pool.Close()
	}
}
