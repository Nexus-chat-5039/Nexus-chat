package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
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

	log.Printf("Starting nexus-api in %s mode...", cfg.Env)

	// ---- Database Connection Pool with Concurrency Tuning ----
	dbConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Fatal: Failed to parse DatabaseURL: %v", err)
	}

	// Performance tuning: prevent connection starvation under 300+ concurrent workers
	dbConfig.MaxConns = 80
	dbConfig.MinConns = 15
	dbConfig.MaxConnLifetime = 30 * time.Minute
	dbConfig.MaxConnIdleTime = 5 * time.Minute
	dbConfig.HealthCheckPeriod = 1 * time.Minute

	var pool *pgxpool.Pool
	maxRetries := 10
	for attempt := 1; attempt <= maxRetries; attempt++ {
		log.Printf("Connecting to PostgreSQL (attempt %d/%d)...", attempt, maxRetries)
		pool, err = pgxpool.NewWithConfig(ctx, dbConfig)
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
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.Default()

	// CORS with Multi-Origin Whitelist
	corsOrigins := strings.Split(cfg.CORSOrigin, ",")
	for i := range corsOrigins {
		corsOrigins[i] = strings.TrimSpace(corsOrigins[i])
	}

	isAllowedOrigin := func(origin string) bool {
		if origin == "" {
			return false
		}
		for _, o := range corsOrigins {
			if o != "" && (o == "*" || o == origin) {
				return true
			}
		}
		// Whitelist verified production domains and dev origins
		if origin == "https://www.nexusainow.online" ||
			origin == "https://nexusainow.online" ||
			origin == "https://nexuschat.app" ||
			strings.HasSuffix(origin, ".nexusainow.online") ||
			strings.HasSuffix(origin, ".web.app") ||
			strings.HasSuffix(origin, ".firebaseapp.com") ||
			strings.HasPrefix(origin, "http://localhost:") ||
			strings.HasPrefix(origin, "http://127.0.0.1:") {
			return true
		}
		return false
	}

	router.Use(func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if isAllowedOrigin(origin) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
		} else if origin == "" && len(corsOrigins) > 0 && corsOrigins[0] != "" {
			c.Header("Access-Control-Allow-Origin", corsOrigins[0])
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, Accept, X-Requested-With")

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

	// Favicon (Avoids 404 in logs when visited directly in browser)
	router.GET("/favicon.ico", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	// ---- Health & Readiness Probes ----
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "nexus-api"})
	})

	router.GET("/live", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "alive"})
	})

	router.GET("/ready", func(c *gin.Context) {
		pingCtx, pingCancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer pingCancel()

		if err := pool.Ping(pingCtx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"status": "unready",
				"error":  "database ping failed: " + err.Error(),
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready", "database": "connected"})
	})

	// ---- API Routes ----
	api := router.Group("/api")

	// Public Auth Routes
	authHandler := handlers.NewAuthHandler(pool, queries, cfg.JWTSecret, jwtExpiry)
	api.POST("/auth/register", authHandler.Register)
	api.POST("/auth/login", authHandler.Login)

	// Protected Routes (Require JWT)
	protected := api.Group("/")
	protected.Use(middleware.JWTAuthMiddleware(cfg.JWTSecret))

	// Protected Auth
	protected.GET("/auth/me", authHandler.GetMe)

	// Profile Routes
	protected.PUT("/auth/profile", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Profile updated"})
	})
	protected.POST("/auth/profile/avatar", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Avatar uploaded"})
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

	// ---- HTTP Server with Hardened Timeouts ----
	srv := &http.Server{
		Addr:              fmt.Sprintf(":%s", cfg.Port),
		Handler:           router,
		ReadHeaderTimeout: 3 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1 MB
	}

	serverErrors := make(chan error, 1)
	go func() {
		log.Printf("nexus-api listening on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			serverErrors <- err
		}
	}()

	// ---- Graceful Shutdown ----
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		log.Fatalf("Server error: %v", err)
	case sig := <-quit:
		log.Printf("Received signal %s, initiating graceful shutdown...", sig)
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("Forced server shutdown: %v", err)
			_ = srv.Close()
		}
		log.Println("Server gracefully stopped.")
	}
}
