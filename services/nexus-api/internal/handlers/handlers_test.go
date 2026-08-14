package handlers

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"nexus/services/nexus-api/internal/database"
	"nexus/services/nexus-api/internal/middleware"
)

func TestGenerateInviteCode(t *testing.T) {
	code, err := generateInviteCode()
	if err != nil {
		t.Fatalf("unexpected error generating invite code: %v", err)
	}

	if len(code) != 9 {
		t.Errorf("expected invite code length 9 (XXXX-XXXX), got %d (%s)", len(code), code)
	}

	if code[4] != '-' {
		t.Errorf("expected hyphen at index 4, got %c (%s)", code[4], code)
	}
}

func TestJWTGenerationAndValidation(t *testing.T) {
	secret := "test-secret-key-12345"
	userID := "018f3a2b-7c8d-4e5f-9a0b-1c2d3e4f5a6b"
	email := "alice@example.com"
	expiry := time.Hour

	token, err := middleware.GenerateJWT(userID, email, secret, expiry)
	if err != nil {
		t.Fatalf("failed to generate JWT: %v", err)
	}

	if token == "" {
		t.Fatalf("expected non-empty token")
	}

	claims, err := middleware.VerifyJWT(token, secret)

	if err != nil {
		t.Fatalf("failed to validate JWT: %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("expected user_id %s, got %s", userID, claims.UserID)
	}

	if claims.Email != email {
		t.Errorf("expected email %s, got %s", email, claims.Email)
	}
}

func TestSanitizeUser(t *testing.T) {
	var uid pgtype.UUID
	_ = uid.Scan("018f3a2b-7c8d-4e5f-9a0b-1c2d3e4f5a6b")

	u := database.User{
		ID:           uid,
		Email:        "bob@example.com",
		PasswordHash: "$2a$12$somehashthatshouldnotbeleaked",
		DisplayName:  "Bob",
		AvatarUrl:    "https://avatar.png",
		SystemRole:   "user",
	}

	sanitized := sanitizeUser(u)

	if _, exists := sanitized["password_hash"]; exists {
		t.Errorf("password_hash must NOT be present in sanitized user map")
	}

	if sanitized["email"] != "bob@example.com" {
		t.Errorf("expected email bob@example.com, got %v", sanitized["email"])
	}
}
