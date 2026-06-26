package consumer

import (
	"context"
	"encoding/json"
	"log"

	"cloud.google.com/go/pubsub"

	"nexus/services/nexus-ai-worker/internal/orchestrator"
)

type PubSubConsumer struct {
	client       *pubsub.Client
	subID        string
	orchestrator *orchestrator.Orchestrator
}

func NewPubSubConsumer(ctx context.Context, projectID, subID string, orch *orchestrator.Orchestrator) (*PubSubConsumer, error) {
	client, err := pubsub.NewClient(ctx, projectID)
	if err != nil {
		return nil, err
	}

	return &PubSubConsumer{
		client:       client,
		subID:        subID,
		orchestrator: orch,
	}, nil
}

func (c *PubSubConsumer) Start(ctx context.Context) error {
	sub := c.client.Subscription(c.subID)

	log.Printf("Starting Pub/Sub consumer on subscription: %s", c.subID)

	err := sub.Receive(ctx, func(ctx context.Context, msg *pubsub.Message) {
		var job orchestrator.InferenceJob
		if err := json.Unmarshal(msg.Data, &job); err != nil {
			log.Printf("Failed to unmarshal message: %v", err)
			msg.Nack()
			return
		}

		if err := c.orchestrator.ProcessInference(ctx, job); err != nil {
			log.Printf("Failed to process inference job: %v", err)
			msg.Nack()
			return
		}

		msg.Ack()
	})

	return err
}

func (c *PubSubConsumer) Close() error {
	return c.client.Close()
}
