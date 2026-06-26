package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"nexus/services/nexus-ai-worker/internal/config"
	"nexus/services/nexus-ai-worker/internal/consumer"
	"nexus/services/nexus-ai-worker/internal/db/postgres"
	"nexus/services/nexus-ai-worker/internal/db/redis"
	"nexus/services/nexus-ai-worker/internal/orchestrator"
)

func main() {
	cfg := config.LoadConfig()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	log.Println("Starting nexus-ai-worker...")

	// 1. Initialize Postgres
	dbClient, err := postgres.NewClient(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to Postgres: %v", err)
	}
	defer dbClient.Close()
	log.Println("Connected to Postgres.")

	// 2. Initialize Redis
	redisClient, err := redis.NewClient(ctx, cfg.RedisURL)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()
	log.Println("Connected to Redis.")

	// 3. Initialize Orchestrator
	orch, err := orchestrator.NewOrchestrator(cfg.RAGServiceURL, cfg.GatewayURL, cfg.BillingURL, dbClient, redisClient)
	if err != nil {
		log.Fatalf("Failed to initialize orchestrator: %v", err)
	}
	defer orch.Close()

	// 4. Initialize Pub/Sub Consumer
	pubsubConsumer, err := consumer.NewPubSubConsumer(ctx, cfg.GCPProjectID, cfg.PubSubSubID, orch)
	if err != nil {
		log.Fatalf("Failed to initialize Pub/Sub consumer: %v", err)
	}
	defer pubsubConsumer.Close()

	// 5. Start Consumer in a goroutine
	go func() {
		if err := pubsubConsumer.Start(ctx); err != nil {
			log.Fatalf("Pub/Sub consumer error: %v", err)
		}
	}()

	// 6. Wait for Termination Signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigChan

	log.Printf("Received signal %s, shutting down...", sig)
	cancel() // Cancels context, stopping the Pub/Sub consumer
}
