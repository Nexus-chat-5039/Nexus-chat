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

	// ---- Database with Cloud SQL Startup Retry Loop ----
	var pool *pgxpool.Pool
	maxRetries := 10
	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Printf("Connecting to PostgreSQL (attempt %d/%d)...", attempt, maxRetries)
		var err error
		pool, err = pgxpool.New(ctx, cfg.DatabaseURL)
		if err == nil {
			pingCtx, pingCancel := context.WithTimeout(ctx, 3*time.Second)
			err = pool.Ping(pingCtx)
			pingCancel()
			if err == nil {
				log.Println("✅ Successfully connected and pinged PostgreSQL.")
				break
			}
			pool.Close()
		}

		log.Printf("Database connection attempt %d failed: %v", attempt, err)
		if attempt == maxRetries {
			log.Fatalf("Fatal: Failed to connect to database after %d attempts: %v", maxRetries, err)
		}
		time.Sleep(2 * time.Second)
	}
	defer pool.Close()


	queries := database.New(pool)

	// ---- Auth Settings ----
	jwtExpiry, err := time.ParseDuration(cfg.JWTExpiry)
	if err != nil {
		jwtExpiry = 24 * time.Hour
	}

	// ---- Gin Router ----
	router := gin.Default()

	// CORS
	router.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" {
			c.Header("Access-Control-Allow-Origin", origin)
		} else if cfg.CORSOrigin != "" {
			c.Header("Access-Control-Allow-Origin", cfg.CORSOrigin)
		} else {
			c.Header("Access-Control-Allow-Origin", "*")
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, Accept, X-Requested-With")
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

	// Public Auth Routes
	authHandler := handlers.NewAuthHandler(queries, cfg.JWTSecret, jwtExpiry)
	api.POST("/auth/register", authHandler.Register)
	api.POST("/auth/login", authHandler.Login)

	// Protected Routes (Require JWT)
	protected := api.Group("/")
	protected.Use(middleware.JWTAuthMiddleware(cfg.JWTSecret))

	// Protected Auth
	protected.GET("/auth/me", authHandler.GetMe)
	
	// Mock Profile Routes (For minimal architecture onboarding)
	protected.PUT("/auth/profile", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Profile updated (mock)"})
	})
	protected.POST("/auth/profile/avatar", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Avatar uploaded (mock)"})
	})

	// Workspaces
	wsHandler := handlers.NewWorkspaceHandler(queries)
	protected.POST("/workspaces", wsHandler.Create)
	protected.GET("/workspaces", wsHandler.List)
	protected.GET("/workspaces/:id", wsHandler.Get)
	protected.GET("/workspaces/:id/members", wsHandler.ListMembers)
	protected.POST("/workspaces/:id/members", wsHandler.AddMember)

	// Groups (Enterprise)
	groupHandler := handlers.NewGroupHandler(queries)
	protected.POST("/groups", groupHandler.Create)
	protected.GET("/groups", groupHandler.List)
	protected.POST("/groups/join", groupHandler.Join)
	protected.DELETE("/groups/:id", groupHandler.Delete)

	// Chats & Messages
	chatHandler := handlers.NewChatHandler(queries)
	protected.POST("/chats", chatHandler.Create)
	protected.GET("/chats", chatHandler.List)
	protected.GET("/chats/:id/messages", chatHandler.ListMessages)
	protected.GET("/messages/:id/thread", chatHandler.GetMessageThread)


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
