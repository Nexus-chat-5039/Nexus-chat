package metering

import (
	"context"
	"fmt"
	"time"

	"cloud.google.com/go/bigquery"

	"nexus/services/nexus-billing/internal/config"
)

// UsageRecord represents a single token usage event to be inserted into BigQuery.
type UsageRecord struct {
	TenantID  string    `bigquery:"tenant_id"`
	Tokens    int32     `bigquery:"tokens"`
	Timestamp time.Time `bigquery:"timestamp"`
}

// Save implements the ValueSaver interface for streaming inserts.
func (u *UsageRecord) Save() (map[string]bigquery.Value, string, error) {
	return map[string]bigquery.Value{
		"tenant_id": u.TenantID,
		"tokens":    u.Tokens,
		"timestamp": u.Timestamp,
	}, "", nil
}

type BigQueryClient struct {
	client   *bigquery.Client
	inserter *bigquery.Inserter
}

func NewBigQueryClient(ctx context.Context, cfg *config.Config) (*BigQueryClient, error) {
	client, err := bigquery.NewClient(ctx, cfg.GCPProjectID)
	if err != nil {
		return nil, fmt.Errorf("failed to create bigquery client: %w", err)
	}

	inserter := client.Dataset(cfg.BQDatasetID).Table(cfg.BQTableID).Inserter()

	return &BigQueryClient{
		client:   client,
		inserter: inserter,
	}, nil
}

func (b *BigQueryClient) RecordUsage(ctx context.Context, tenantID string, tokens int32) error {
	record := &UsageRecord{
		TenantID:  tenantID,
		Tokens:    tokens,
		Timestamp: time.Now().UTC(),
	}

	if err := b.inserter.Put(ctx, []*UsageRecord{record}); err != nil {
		return fmt.Errorf("bigquery insert error: %w", err)
	}

	return nil
}

func (b *BigQueryClient) Close() error {
	return b.client.Close()
}
