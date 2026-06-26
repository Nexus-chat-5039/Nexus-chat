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

	pb "nexus/services/nexus-ai-gateway/pkg/pb/gateway"
	"nexus/services/nexus-ai-gateway/internal/cache"
	"nexus/services/nexus-ai-gateway/internal/config"
	"nexus/services/nexus-ai-gateway/internal/router"
	"nexus/services/nexus-ai-gateway/internal/server"
)

func main() {
	cfg := config.LoadConfig()
	ctx := context.Background()

	log.Println("Starting nexus-ai-gateway...")

	// ---- Response Cache ----
	var responseCache *cache.ResponseCache
	rc, err := cache.NewResponseCache(ctx, cfg.RedisURL, cfg.CacheTTLSeconds)
	if err != nil {
		log.Printf("Warning: Redis cache unavailable (%v). Proceeding without cache.", err)
	} else {
		responseCache = rc
		defer responseCache.Close()
		log.Println("Redis response cache connected.")
	}

	// ---- Model Router ----
	modelRouter := router.NewModelRouter(cfg, responseCache)

	// ---- gRPC Server ----
	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.GRPCPort))
	if err != nil {
		log.Fatalf("Failed to listen on port %d: %v", cfg.GRPCPort, err)
	}

	grpcServer := grpc.NewServer(
		grpc.MaxRecvMsgSize(50*1024*1024),
		grpc.MaxSendMsgSize(50*1024*1024),
	)

	gatewayService := server.NewGatewayServer(modelRouter)
	pb.RegisterAIGatewayServiceServer(grpcServer, gatewayService)
	reflection.Register(grpcServer) // Enable gRPC reflection for debugging

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
		w.Write([]byte(`{"status":"healthy","service":"nexus-ai-gateway"}`))
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
