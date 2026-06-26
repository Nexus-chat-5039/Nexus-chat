package middleware

import (
	"context"
	"log"
	"net/http"
	"strings"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"github.com/gin-gonic/gin"
)

var firebaseAuth *auth.Client

// InitFirebase initializes the Firebase Admin SDK.
func InitFirebase(ctx context.Context, projectID string) {
	conf := &firebase.Config{ProjectID: projectID}
	app, err := firebase.NewApp(ctx, conf)
	if err != nil {
		log.Printf("[auth] Firebase init failed — running without auth: %v", err)
		return
	}

	client, err := app.Auth(ctx)
	if err != nil {
		log.Printf("[auth] Firebase auth client failed: %v", err)
		return
	}

	firebaseAuth = client
	log.Println("[auth] Firebase Admin initialized")
}

// FirebaseAuthMiddleware verifies Firebase ID tokens from the Authorization header.
// On success, sets "firebase_uid", "user_email", "user_name" in the Gin context.
func FirebaseAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if token == authHeader {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}

		// Dev mode: skip Firebase if not initialized
		if firebaseAuth == nil {
			log.Println("[auth] Dev mode — skipping token verification")
			c.Set("firebase_uid", "dev-user")
			c.Set("user_email", "dev@nexus.local")
			c.Set("user_name", "Dev User")
			c.Next()
			return
		}

		decoded, err := firebaseAuth.VerifyIDToken(c.Request.Context(), token)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		c.Set("firebase_uid", decoded.UID)
		if email, ok := decoded.Claims["email"].(string); ok {
			c.Set("user_email", email)
		}
		if name, ok := decoded.Claims["name"].(string); ok {
			c.Set("user_name", name)
		}

		c.Next()
	}
}
