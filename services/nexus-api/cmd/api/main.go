package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"nexus/services/nexus-api/internal/config"
	"nexus/services/nexus-api/internal/database"
	"nexus/services/nexus-api/internal/handlers"
	"nexus/services/nexus-api/internal/middleware"
)

func main() {
	cfg := config.LoadConfig()
	ctx := context.Background()

	log.Println("Starting nexus-api...")

	// ---- Database ----
	pool, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Println("Connected to PostgreSQL.")

	queries := database.New(pool)

	// ---- Firebase Auth ----
	middleware.InitFirebase(ctx, cfg.FirebaseProjectID)

	// ---- Gin Router ----
	router := gin.Default()

	// CORS
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", cfg.CORSOrigin)
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Health
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "nexus-api"})
	})

	// ---- API Routes ----
	api := router.Group("/api")
	api.Use(middleware.FirebaseAuthMiddleware())

	// Auth
	authHandler := handlers.NewAuthHandler(queries)
	api.POST("/auth/session", authHandler.CreateSession)
	api.GET("/auth/me", authHandler.GetMe)

	// Workspaces
	wsHandler := handlers.NewWorkspaceHandler(queries)
	api.POST("/workspaces", wsHandler.Create)
	api.GET("/workspaces", wsHandler.List)
	api.GET("/workspaces/:id", wsHandler.Get)
	api.GET("/workspaces/:id/members", wsHandler.ListMembers)
	api.POST("/workspaces/:id/members", wsHandler.AddMember)

	// Groups
	groupHandler := handlers.NewGroupHandler(queries)
	api.POST("/groups", groupHandler.Create)
	api.GET("/groups", groupHandler.List)

	// Chats
	chatHandler := handlers.NewChatHandler(queries)
	api.POST("/chats", chatHandler.Create)
	api.GET("/chats", chatHandler.List)
	api.GET("/chats/:id/messages", chatHandler.ListMessages)

	// ---- HTTP Server ----
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: router,
	}

	go func() {
		log.Printf("nexus-api listening on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// ---- Graceful Shutdown ----
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit

	log.Printf("Received %s, shutting down...", sig)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Forced shutdown: %v", err)
	}
	log.Println("Shutdown complete.")
}
