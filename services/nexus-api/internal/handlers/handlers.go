package handlers

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"nexus/services/nexus-api/internal/database"
	"nexus/services/nexus-api/internal/middleware"
)

// ────────────────────────────────────────────────────────────────
// Helper Functions: Safe Context & UUID Parsing
// ────────────────────────────────────────────────────────────────

// getUserIDFromContext safely extracts and validates the authenticated user ID.
func getUserIDFromContext(c *gin.Context) (pgtype.UUID, error) {
	val, exists := c.Get("user_id")
	if !exists {
		return pgtype.UUID{}, errors.New("user_id not found in context")
	}
	strVal, ok := val.(string)
	if !ok || strVal == "" {
		return pgtype.UUID{}, errors.New("invalid user_id in context")
	}
	return parseUUID(strVal)
}

// parseUUID validates and converts a string into pgtype.UUID.
func parseUUID(s string) (pgtype.UUID, error) {
	var uid pgtype.UUID
	if err := uid.Scan(strings.TrimSpace(s)); err != nil || !uid.Valid {
		return pgtype.UUID{}, fmt.Errorf("invalid UUID format: %s", s)
	}
	return uid, nil
}

// parseUUIDParam extracts a URL param and returns a validated pgtype.UUID.
func parseUUIDParam(c *gin.Context, paramName string) (pgtype.UUID, bool) {
	raw := c.Param(paramName)
	uid, err := parseUUID(raw)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid UUID for parameter '%s'", paramName)})
		return pgtype.UUID{}, false
	}
	return uid, true
}

// ────────────────────────────────────────────────────────────────
// Invite Code Generator (Crockford Base32, NX7K-Q2R9 format)
// ────────────────────────────────────────────────────────────────

const crockfordAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

func generateInviteCode() (string, error) {
	code := make([]byte, 8)
	for i := range code {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(crockfordAlphabet))))
		if err != nil {
			return "", err
		}
		code[i] = crockfordAlphabet[n.Int64()]
	}
	return string(code[:4]) + "-" + string(code[4:]), nil
}

// ────────────────────────────────────────────────────────────────
// Auth Handler
// ────────────────────────────────────────────────────────────────

type AuthHandler struct {
	pool      *pgxpool.Pool
	db        *database.Queries
	jwtSecret string
	jwtExpiry time.Duration
}

func NewAuthHandler(pool *pgxpool.Pool, db *database.Queries, jwtSecret string, jwtExpiry time.Duration) *AuthHandler {
	return &AuthHandler{
		pool:      pool,
		db:        db,
		jwtSecret: jwtSecret,
		jwtExpiry: jwtExpiry,
	}
}

// POST /api/auth/register — Create a new user account with atomic workspace provisioning
func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Email       string `json:"email" binding:"required,email"`
		Password    string `json:"password" binding:"required,min=6"`
		DisplayName string `json:"display_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Hash password (cost 10 for optimal security & CPU efficiency)
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	displayName := req.DisplayName
	if displayName == "" {
		displayName = req.Email
	}

	// Begin atomic database transaction for registration and onboarding
	tx, err := h.pool.Begin(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to begin transaction"})
		return
	}
	defer tx.Rollback(c.Request.Context())

	qtx := h.db.WithTx(tx)

	// 1. Create user in DB
	user, err := qtx.CreateUser(c.Request.Context(), database.CreateUserParams{
		Email:        req.Email,
		PasswordHash: string(hash),
		DisplayName:  displayName,
	})
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	// 2. Create tenant organization
	tenant, err := qtx.CreateTenant(c.Request.Context(), database.CreateTenantParams{
		Name: displayName + "'s Organization",
		Plan: "free",
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create organization"})
		return
	}

	// 3. Create collision-resistant workspace slug
	code, err := generateInviteCode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate unique identifier"})
		return
	}
	suffix := strings.ToLower(strings.ReplaceAll(code, "-", "")[:4])
	slugBase := strings.ToLower(strings.ReplaceAll(displayName, " ", "-"))
	wsSlug := fmt.Sprintf("%s-%s-workspace", slugBase, suffix)

	ws, err := qtx.CreateWorkspace(c.Request.Context(), database.CreateWorkspaceParams{
		TenantID: tenant.ID,
		Name:     displayName + "'s Workspace",
		Slug:     wsSlug,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create workspace"})
		return
	}

	// 4. Add creator as workspace owner
	if err := qtx.AddWorkspaceMember(c.Request.Context(), database.AddWorkspaceMemberParams{
		WorkspaceID: ws.ID,
		UserID:      user.ID,
		Role:        "owner",
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to assign workspace owner"})
		return
	}

	// 5. Create default General group
	var inviteCodePg pgtype.Text
	_ = inviteCodePg.Scan(code)
	grp, err := qtx.CreateGroup(c.Request.Context(), database.CreateGroupParams{
		TenantID:    tenant.ID,
		WorkspaceID: ws.ID,
		Name:        "General",
		OwnerID:     user.ID,
		AiEnabled:   true,
		InviteCode:  inviteCodePg,
		Visibility:  "private",
		JoinPolicy:  "invite_only",
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create default group"})
		return
	}

	// 6. Add creator as group owner
	if err := qtx.AddGroupMember(c.Request.Context(), database.AddGroupMemberParams{
		GroupID: grp.ID,
		UserID:  user.ID,
		Role:    "owner",
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to assign group owner"})
		return
	}

	// 7. Create default General chat
	if _, err := qtx.CreateChat(c.Request.Context(), database.CreateChatParams{
		TenantID:    tenant.ID,
		WorkspaceID: ws.ID,
		GroupID:     grp.ID,
		Title:       "general",
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create default chat"})
		return
	}

	// Commit transaction
	if err := tx.Commit(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete registration"})
		return
	}

	// Generate JWT
	userID := formatUUID(user.ID)
	token, err := middleware.GenerateJWT(userID, user.Email, h.jwtSecret, h.jwtExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"user":  sanitizeUser(user),
		"token": token,
	})
}

// POST /api/auth/login — Authenticate with email + password
func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Look up user
	user, err := h.db.GetUserByEmail(c.Request.Context(), req.Email)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	// Compare password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
		return
	}

	// Update last seen
	_ = h.db.UpdateLastSeen(c.Request.Context(), user.ID)

	// Generate JWT
	userID := formatUUID(user.ID)
	token, err := middleware.GenerateJWT(userID, user.Email, h.jwtSecret, h.jwtExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user":  sanitizeUser(user),
		"token": token,
	})
}

// GET /api/auth/me — Get current user profile
func (h *AuthHandler) GetMe(c *gin.Context) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	user, err := h.db.GetUserByID(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"user": sanitizeUser(user)})
}

// sanitizeUser strips the password_hash from the response.
func sanitizeUser(u database.User) gin.H {
	return gin.H{
		"id":           u.ID,
		"email":        u.Email,
		"display_name": u.DisplayName,
		"avatar_url":   u.AvatarUrl,
		"system_role":  u.SystemRole,
		"created_at":   u.CreatedAt,
		"last_seen":    u.LastSeen,
	}
}

// formatUUID converts pgtype.UUID to a standard UUID string.
func formatUUID(id pgtype.UUID) string {
	return fmt.Sprintf("%x-%x-%x-%x-%x",
		id.Bytes[0:4], id.Bytes[4:6], id.Bytes[6:8],
		id.Bytes[8:10], id.Bytes[10:16])
}

// ────────────────────────────────────────────────────────────────
// Workspace Handler
// ────────────────────────────────────────────────────────────────

type WorkspaceHandler struct {
	db database.Querier
}

func NewWorkspaceHandler(db database.Querier) *WorkspaceHandler {
	return &WorkspaceHandler{db: db}
}

// POST /api/workspaces
func (h *WorkspaceHandler) Create(c *gin.Context) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		TenantID string `json:"tenant_id" binding:"required"`
		Name     string `json:"name" binding:"required"`
		Slug     string `json:"slug" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tenantID, err := parseUUID(req.TenantID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant_id"})
		return
	}

	ws, err := h.db.CreateWorkspace(c.Request.Context(), database.CreateWorkspaceParams{
		TenantID: tenantID,
		Name:     req.Name,
		Slug:     req.Slug,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create workspace"})
		return
	}

	// Add creator as owner
	_ = h.db.AddWorkspaceMember(c.Request.Context(), database.AddWorkspaceMemberParams{
		WorkspaceID: ws.ID,
		UserID:      uid,
		Role:        "owner",
	})

	c.JSON(http.StatusCreated, gin.H{"workspace": ws})
}

// GET /api/workspaces
func (h *WorkspaceHandler) List(c *gin.Context) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	tenantIDStr := c.Query("tenant_id")
	if tenantIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id query param required"})
		return
	}

	tid, err := parseUUID(tenantIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant_id"})
		return
	}

	workspaces, err := h.db.ListWorkspacesByTenant(c.Request.Context(), database.ListWorkspacesByTenantParams{
		TenantID: tid,
		UserID:   uid,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list workspaces"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"workspaces": workspaces})
}

// GET /api/workspaces/:id
func (h *WorkspaceHandler) Get(c *gin.Context) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	wsID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	// Authorization check: caller must be a member
	_, err = h.db.GetWorkspaceMember(c.Request.Context(), database.GetWorkspaceMemberParams{
		WorkspaceID: wsID,
		UserID:      uid,
	})
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied to this workspace"})
		return
	}

	ws, err := h.db.GetWorkspaceByID(c.Request.Context(), wsID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workspace not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"workspace": ws})
}

// GET /api/workspaces/:id/members
func (h *WorkspaceHandler) ListMembers(c *gin.Context) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	wsID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	// Authorization check: caller must be a member
	_, err = h.db.GetWorkspaceMember(c.Request.Context(), database.GetWorkspaceMemberParams{
		WorkspaceID: wsID,
		UserID:      uid,
	})
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied to workspace members"})
		return
	}

	members, err := h.db.ListWorkspaceMembers(c.Request.Context(), wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list members"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"members": members})
}

// POST /api/workspaces/:id/members
func (h *WorkspaceHandler) AddMember(c *gin.Context) {
	callerUID, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	wsID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	// Authorization check: caller must be owner or admin
	callerMember, err := h.db.GetWorkspaceMember(c.Request.Context(), database.GetWorkspaceMemberParams{
		WorkspaceID: wsID,
		UserID:      callerUID,
	})
	if err != nil || (callerMember.Role != "owner" && callerMember.Role != "admin") {
		c.JSON(http.StatusForbidden, gin.H{"error": "only workspace owners or admins can add members"})
		return
	}

	var req struct {
		UserID string `json:"user_id" binding:"required"`
		Role   string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	targetUID, err := parseUUID(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user_id"})
		return
	}

	err = h.db.AddWorkspaceMember(c.Request.Context(), database.AddWorkspaceMemberParams{
		WorkspaceID: wsID,
		UserID:      targetUID,
		Role:        req.Role,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ────────────────────────────────────────────────────────────────
// Group Handler (Enterprise)
// ────────────────────────────────────────────────────────────────

type GroupHandler struct {
	db database.Querier
}

func NewGroupHandler(db database.Querier) *GroupHandler {
	return &GroupHandler{db: db}
}

// POST /api/groups — Create a new group with invite code
func (h *GroupHandler) Create(c *gin.Context) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		TenantID    string `json:"tenant_id"`
		WorkspaceID string `json:"workspace_id"`
		Name        string `json:"name" binding:"required"`
		AIEnabled   bool   `json:"ai_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var tenantID, wsID pgtype.UUID
	if req.TenantID != "" && req.WorkspaceID != "" {
		var tErr, wErr error
		tenantID, tErr = parseUUID(req.TenantID)
		wsID, wErr = parseUUID(req.WorkspaceID)
		if tErr != nil || wErr != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid tenant_id or workspace_id"})
			return
		}
	} else {
		// Fallback to the user's first available workspace
		workspaces, err := h.db.ListWorkspacesByUser(c.Request.Context(), uid)
		if err != nil || len(workspaces) == 0 {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no workspace available to create group"})
			return
		}
		tenantID = workspaces[0].TenantID
		wsID = workspaces[0].ID
	}

	// Generate unique invite code
	inviteCode, err := generateInviteCode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate invite code"})
		return
	}

	var inviteCodePg pgtype.Text
	_ = inviteCodePg.Scan(inviteCode)

	group, err := h.db.CreateGroup(c.Request.Context(), database.CreateGroupParams{
		TenantID:    tenantID,
		WorkspaceID: wsID,
		Name:        req.Name,
		OwnerID:     uid,
		AiEnabled:   req.AIEnabled,
		InviteCode:  inviteCodePg,
		Visibility:  "private",
		JoinPolicy:  "invite_only",
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create group"})
		return
	}

	// Add creator as owner in group_members
	_ = h.db.AddGroupMember(c.Request.Context(), database.AddGroupMemberParams{
		GroupID: group.ID,
		UserID:  uid,
		Role:    "owner",
	})

	// Create a default "General" chat for the new group
	chat, err := h.db.CreateChat(c.Request.Context(), database.CreateChatParams{
		TenantID:    tenantID,
		WorkspaceID: wsID,
		GroupID:     group.ID,
		Title:       "General",
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create default chat"})
		return
	}

	// Audit log
	_ = h.db.InsertAuditLog(c.Request.Context(), database.InsertAuditLogParams{
		GroupID: group.ID,
		ActorID: uid,
		Action:  "group.created",
		Metadata: mustJSON(map[string]string{
			"name":        req.Name,
			"invite_code": inviteCode,
		}),
	})

	members, _ := h.db.ListGroupMembers(c.Request.Context(), group.ID)

	c.JSON(http.StatusCreated, gin.H{
		"group": serializeGroup(group, []database.Chat{chat}, members),
	})
}

// GET /api/groups — List groups the authenticated user belongs to
func (h *GroupHandler) List(c *gin.Context) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	groups, err := h.db.ListGroupsByUser(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list groups"})
		return
	}

	// Auto-provision default group if empty
	if len(groups) == 0 {
		workspaces, err := h.db.ListWorkspacesByUser(c.Request.Context(), uid)
		if err == nil && len(workspaces) > 0 {
			ws := workspaces[0]
			code, _ := generateInviteCode()
			var inviteCodePg pgtype.Text
			_ = inviteCodePg.Scan(code)

			newGrp, err := h.db.CreateGroup(c.Request.Context(), database.CreateGroupParams{
				TenantID:    ws.TenantID,
				WorkspaceID: ws.ID,
				Name:        "General",
				OwnerID:     uid,
				AiEnabled:   true,
				InviteCode:  inviteCodePg,
				Visibility:  "private",
				JoinPolicy:  "invite_only",
			})
			if err == nil {
				_ = h.db.AddGroupMember(c.Request.Context(), database.AddGroupMemberParams{
					GroupID: newGrp.ID,
					UserID:  uid,
					Role:    "owner",
				})
				_, _ = h.db.CreateChat(c.Request.Context(), database.CreateChatParams{
					TenantID:    ws.TenantID,
					WorkspaceID: ws.ID,
					GroupID:     newGrp.ID,
					Title:       "general",
				})
				groups = []database.Group{newGrp}
			}
		}
	}

	var result []gin.H
	for _, g := range groups {
		chats, err := h.db.ListChatsByGroup(c.Request.Context(), g.ID)
		if err != nil {
			chats = []database.Chat{}
		}
		members, err := h.db.ListGroupMembers(c.Request.Context(), g.ID)
		if err != nil {
			members = []database.ListGroupMembersRow{}
		}
		result = append(result, serializeGroup(g, chats, members))
	}

	c.JSON(http.StatusOK, gin.H{"groups": result})
}

// POST /api/groups/join — Join a group via invite code
func (h *GroupHandler) Join(c *gin.Context) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	code := strings.ToUpper(strings.TrimSpace(req.Code))
	var inviteCodePg pgtype.Text
	_ = inviteCodePg.Scan(code)

	group, err := h.db.GetGroupByInviteCode(c.Request.Context(), inviteCodePg)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invalid invite code"})
		return
	}

	// Check if already a member
	_, err = h.db.GetGroupMember(c.Request.Context(), database.GetGroupMemberParams{
		GroupID: group.ID,
		UserID:  uid,
	})
	if err == nil {
		chats, _ := h.db.ListChatsByGroup(c.Request.Context(), group.ID)
		members, _ := h.db.ListGroupMembers(c.Request.Context(), group.ID)
		c.JSON(http.StatusOK, gin.H{"group": serializeGroup(group, chats, members)})
		return
	}

	// Add as member
	_ = h.db.AddGroupMember(c.Request.Context(), database.AddGroupMemberParams{
		GroupID: group.ID,
		UserID:  uid,
		Role:    "member",
	})
	_ = h.db.AddWorkspaceMember(c.Request.Context(), database.AddWorkspaceMemberParams{
		WorkspaceID: group.WorkspaceID,
		UserID:      uid,
		Role:        "member",
	})

	_ = h.db.InsertAuditLog(c.Request.Context(), database.InsertAuditLogParams{
		GroupID: group.ID,
		ActorID: uid,
		Action:  "member.joined",
		Metadata: mustJSON(map[string]string{
			"method": "invite_code",
			"code":   code,
		}),
	})

	chats, _ := h.db.ListChatsByGroup(c.Request.Context(), group.ID)
	members, _ := h.db.ListGroupMembers(c.Request.Context(), group.ID)
	c.JSON(http.StatusOK, gin.H{"group": serializeGroup(group, chats, members)})
}

// DELETE /api/groups/:id — Soft delete a group
func (h *GroupHandler) Delete(c *gin.Context) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	groupID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	group, err := h.db.GetGroupByID(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}

	if group.OwnerID != uid {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the group owner can delete this group"})
		return
	}

	var reason pgtype.Text
	_ = reason.Scan("deleted by owner")

	err = h.db.SoftDeleteGroup(c.Request.Context(), database.SoftDeleteGroupParams{
		ID:             groupID,
		DeletionReason: reason,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete group"})
		return
	}

	_ = h.db.InsertAuditLog(c.Request.Context(), database.InsertAuditLogParams{
		GroupID:  groupID,
		ActorID:  uid,
		Action:   "group.deleted",
		Metadata: mustJSON(map[string]string{"reason": "deleted by owner"}),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ────────────────────────────────────────────────────────────────
// Chat Handler
// ────────────────────────────────────────────────────────────────

type ChatHandler struct {
	db database.Querier
}

func NewChatHandler(db database.Querier) *ChatHandler {
	return &ChatHandler{db: db}
}

// POST /api/chats
func (h *ChatHandler) Create(c *gin.Context) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		GroupID string `json:"group_id" binding:"required"`
		Title   string `json:"title" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	groupID, err := parseUUID(req.GroupID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group_id"})
		return
	}

	group, err := h.db.GetGroupByID(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
		return
	}

	// Verify membership
	_, err = h.db.GetGroupMember(c.Request.Context(), database.GetGroupMemberParams{
		GroupID: group.ID,
		UserID:  uid,
	})
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "must be a group member to create a chat"})
		return
	}

	chat, err := h.db.CreateChat(c.Request.Context(), database.CreateChatParams{
		TenantID:    group.TenantID,
		WorkspaceID: group.WorkspaceID,
		GroupID:     group.ID,
		Title:       req.Title,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create chat"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"chat": chat})
}

// GET /api/chats
func (h *ChatHandler) List(c *gin.Context) {
	uid, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	groupIDStr := c.Query("group_id")
	if groupIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "group_id query param required"})
		return
	}

	gid, err := parseUUID(groupIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group_id"})
		return
	}

	// Check group membership
	_, err = h.db.GetGroupMember(c.Request.Context(), database.GetGroupMemberParams{
		GroupID: gid,
		UserID:  uid,
	})
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied to this group's chats"})
		return
	}

	chats, err := h.db.ListChatsByGroup(c.Request.Context(), gid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list chats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"chats": chats})
}

// GET /api/chats/:id/messages
func (h *ChatHandler) ListMessages(c *gin.Context) {
	_, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	chatID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, _ := strconv.ParseInt(limitStr, 10, 32)
	offset, _ := strconv.ParseInt(offsetStr, 10, 32)

	if limit <= 0 || limit > 200 {
		limit = 50
	}

	messages, err := h.db.ListMessagesByChat(c.Request.Context(), database.ListMessagesByChatParams{
		ChatID: chatID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		log.Printf("[ERROR] failed to list messages for chat %s: %v", c.Param("id"), err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list messages"})
		return
	}

	var formattedMessages []gin.H
	for _, m := range messages {
		var reactionsMap map[string][]string
		if len(m.Reactions) > 0 {
			_ = json.Unmarshal(m.Reactions, &reactionsMap)
		}
		if reactionsMap == nil {
			reactionsMap = make(map[string][]string)
		}

		var replyToObj interface{}
		if len(m.ReplyTo) > 0 {
			_ = json.Unmarshal(m.ReplyTo, &replyToObj)
		}

		userEmail := ""
		if m.UserEmail.Valid {
			userEmail = m.UserEmail.String
		}
		displayName := ""
		if m.DisplayName.Valid {
			displayName = m.DisplayName.String
		}
		avatarUrl := ""
		if m.AvatarUrl.Valid {
			avatarUrl = m.AvatarUrl.String
		}

		var threadLastReplyAt *time.Time
		if m.ThreadLastReplyAt.Valid {
			threadLastReplyAt = &m.ThreadLastReplyAt.Time
		}

		formattedMessages = append(formattedMessages, gin.H{
			"id":                   formatUUID(m.ID),
			"tenant_id":            formatUUID(m.TenantID),
			"workspace_id":         formatUUID(m.WorkspaceID),
			"group_id":             formatUUID(m.GroupID),
			"chat_id":              formatUUID(m.ChatID),
			"user_id":              formatUUID(m.UserID),
			"user_email":           userEmail,
			"display_name":         displayName,
			"avatar_url":           avatarUrl,
			"role":                 m.Role,
			"content":              m.Content,
			"reply_to":             replyToObj,
			"reactions":            reactionsMap,
			"thread_count":         m.ThreadCount,
			"thread_last_reply_at": threadLastReplyAt,
			"is_deleted":           m.IsDeleted,
			"is_edited":            m.IsEdited,
			"created_at":           m.CreatedAt.Time,
			"updated_at":           m.UpdatedAt.Time,
		})
	}

	if formattedMessages == nil {
		formattedMessages = []gin.H{}
	}

	c.JSON(http.StatusOK, gin.H{"messages": formattedMessages})
}

// GET /api/messages/:id/thread
func (h *ChatHandler) GetMessageThread(c *gin.Context) {
	_, err := getUserIDFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	messageID, ok := parseUUIDParam(c, "id")
	if !ok {
		return
	}

	replies, err := h.db.ListThreadMessages(c.Request.Context(), messageID)
	if err != nil {
		log.Printf("[ERROR] failed to list thread messages for %s: %v", c.Param("id"), err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list thread messages"})
		return
	}

	var formattedReplies []gin.H
	for _, r := range replies {
		var avatar *string
		if r.UserAvatar != "" {
			avatar = &r.UserAvatar
		}
		formattedReplies = append(formattedReplies, gin.H{
			"id":          formatUUID(r.ID),
			"content":     r.Content,
			"user_email":  r.UserEmail,
			"user_name":   r.UserName,
			"user_avatar": avatar,
			"created_at":  r.CreatedAt.Time,
		})
	}
	if formattedReplies == nil {
		formattedReplies = []gin.H{}
	}

	c.JSON(http.StatusOK, gin.H{
		"parent_message_id": formatUUID(messageID),
		"replies":           formattedReplies,
	})
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

// serializeGroup builds a consistent JSON response for a group
func serializeGroup(g database.Group, chats []database.Chat, members []database.ListGroupMembersRow) gin.H {
	memberEmails := make([]string, len(members))
	for i, m := range members {
		memberEmails[i] = m.Email
	}

	inviteCode := ""
	if g.InviteCode.Valid {
		inviteCode = g.InviteCode.String
	}

	return gin.H{
		"id":           g.ID,
		"tenant_id":    g.TenantID,
		"workspace_id": g.WorkspaceID,
		"name":         g.Name,
		"owner_id":     g.OwnerID,
		"ai_enabled":   g.AiEnabled,
		"invite_code":  inviteCode,
		"visibility":   g.Visibility,
		"join_policy":  g.JoinPolicy,
		"created_at":   g.CreatedAt,
		"chats":        chats,
		"members":      memberEmails,
	}
}

// mustJSON marshals a value to JSON bytes, returning empty JSON object on error.
func mustJSON(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("{}")
	}
	return b
}
