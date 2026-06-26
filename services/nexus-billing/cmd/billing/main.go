package main

import (
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	"nexus/services/nexus-billing/internal/config"
	"nexus/services/nexus-billing/internal/metering"
	"nexus/services/nexus-billing/internal/server"
	pb "nexus/services/nexus-billing/pkg/pb/billing"
)

func main() {
	cfg := config.LoadConfig()
	ctx := context.Background()

	log.Println("Starting nexus-billing...")

	// ---- BigQuery ----
	bqClient, err := metering.NewBigQueryClient(ctx, cfg)
	if err != nil {
		log.Printf("Warning: Failed to initialize BigQuery client: %v. Running in log-only mode.", err)
		bqClient = nil // Will fall back to logging
	} else {
		defer bqClient.Close()
		log.Println("BigQuery client initialized.")
	}

	// ---- gRPC Server ----
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.GRPCPort))
	if err != nil {
		log.Fatalf("Failed to listen on port %d: %v", cfg.GRPCPort, err)
	}

	grpcServer := grpc.NewServer()
	billingService := server.NewBillingServer(bqClient)

	pb.RegisterBillingServiceServer(grpcServer, billingService)
	reflection.Register(grpcServer) // Enable reflection for grpcurl

	go func() {
		log.Printf("gRPC server listening on port %d", cfg.GRPCPort)
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("gRPC server error: %v", err)
		}
	}()

	// ---- HTTP Health Check ----
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy","service":"nexus-billing"}`))
	})

	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.HTTPPort),
		Handler: mux,
	}

	go func() {
		log.Printf("HTTP health server listening on port %d", cfg.HTTPPort)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server error: %v", err)
		}
	}()

	// ---- Graceful Shutdown ----
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigChan

	log.Printf("Received signal %s, shutting down...", sig)
	grpcServer.GracefulStop()
	httpServer.Shutdown(ctx)
	log.Println("Shutdown complete.")
}
