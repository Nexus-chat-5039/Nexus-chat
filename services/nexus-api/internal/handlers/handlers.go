package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"nexus/services/nexus-api/internal/database"
	"nexus/services/nexus-api/internal/middleware"
)

// ────────────────────────────────────────────────────────────────
// Auth Handler
// ────────────────────────────────────────────────────────────────

type AuthHandler struct {
	db        *database.Queries
	jwtSecret string
	jwtExpiry time.Duration
}

func NewAuthHandler(db *database.Queries, jwtSecret string, jwtExpiry time.Duration) *AuthHandler {
	return &AuthHandler{db: db, jwtSecret: jwtSecret, jwtExpiry: jwtExpiry}
}

// POST /api/auth/register — Create a new user account
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

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	displayName := req.DisplayName
	if displayName == "" {
		displayName = req.Email
	}

	// Create user in DB
	user, err := h.db.CreateUser(c.Request.Context(), database.CreateUserParams{
		Email:        req.Email,
		PasswordHash: string(hash),
		DisplayName:  displayName,
	})
	if err != nil {
		// Check for duplicate email
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	// Generate JWT
	userID := fmt.Sprintf("%x-%x-%x-%x-%x",
		user.ID.Bytes[0:4], user.ID.Bytes[4:6], user.ID.Bytes[6:8],
		user.ID.Bytes[8:10], user.ID.Bytes[10:16])

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
	h.db.UpdateLastSeen(c.Request.Context(), user.ID)

	// Generate JWT
	userID := fmt.Sprintf("%x-%x-%x-%x-%x",
		user.ID.Bytes[0:4], user.ID.Bytes[4:6], user.ID.Bytes[6:8],
		user.ID.Bytes[8:10], user.ID.Bytes[10:16])

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
	userID, _ := c.Get("user_id")

	var uid pgtype.UUID
	uid.Scan(userID.(string))

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

// ────────────────────────────────────────────────────────────────
// Workspace Handler
// ────────────────────────────────────────────────────────────────

type WorkspaceHandler struct {
	db *database.Queries
}

func NewWorkspaceHandler(db *database.Queries) *WorkspaceHandler {
	return &WorkspaceHandler{db: db}
}

// POST /api/workspaces
func (h *WorkspaceHandler) Create(c *gin.Context) {
	var req struct {
		TenantID string `json:"tenant_id" binding:"required"`
		Name     string `json:"name" binding:"required"`
		Slug     string `json:"slug" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var tenantID pgtype.UUID
	tenantID.Scan(req.TenantID)

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
	userID, _ := c.Get("user_id")
	var uid pgtype.UUID
	uid.Scan(userID.(string))

	h.db.AddWorkspaceMember(c.Request.Context(), database.AddWorkspaceMemberParams{
		WorkspaceID: ws.ID,
		UserID:      uid,
		Role:        "owner",
	})

	c.JSON(http.StatusCreated, gin.H{"workspace": ws})
}

// GET /api/workspaces
func (h *WorkspaceHandler) List(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id query param required"})
		return
	}

	userID, _ := c.Get("user_id")
	var uid pgtype.UUID
	uid.Scan(userID.(string))

	var tid pgtype.UUID
	tid.Scan(tenantID)

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
	var wsID pgtype.UUID
	wsID.Scan(c.Param("id"))

	ws, err := h.db.GetWorkspaceByID(c.Request.Context(), wsID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "workspace not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"workspace": ws})
}

// GET /api/workspaces/:id/members
func (h *WorkspaceHandler) ListMembers(c *gin.Context) {
	var wsID pgtype.UUID
	wsID.Scan(c.Param("id"))

	members, err := h.db.ListWorkspaceMembers(c.Request.Context(), wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list members"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"members": members})
}

// POST /api/workspaces/:id/members
func (h *WorkspaceHandler) AddMember(c *gin.Context) {
	var req struct {
		UserID string `json:"user_id" binding:"required"`
		Role   string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var wsID, userID pgtype.UUID
	wsID.Scan(c.Param("id"))
	userID.Scan(req.UserID)

	err := h.db.AddWorkspaceMember(c.Request.Context(), database.AddWorkspaceMemberParams{
		WorkspaceID: wsID,
		UserID:      userID,
		Role:        req.Role,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ────────────────────────────────────────────────────────────────
// Group Handler
// ────────────────────────────────────────────────────────────────

type GroupHandler struct {
	db *database.Queries
}

func NewGroupHandler(db *database.Queries) *GroupHandler {
	return &GroupHandler{db: db}
}

// POST /api/groups
func (h *GroupHandler) Create(c *gin.Context) {
	var req struct {
		TenantID    string `json:"tenant_id" binding:"required"`
		WorkspaceID string `json:"workspace_id" binding:"required"`
		Name        string `json:"name" binding:"required"`
		AIEnabled   bool   `json:"ai_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")
	var uid pgtype.UUID
	uid.Scan(userID.(string))

	var tenantID, wsID pgtype.UUID
	tenantID.Scan(req.TenantID)
	wsID.Scan(req.WorkspaceID)

	group, err := h.db.CreateGroup(c.Request.Context(), database.CreateGroupParams{
		TenantID:    tenantID,
		WorkspaceID: wsID,
		Name:        req.Name,
		OwnerID:     uid,
		AiEnabled:   req.AIEnabled,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create group"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"group": group})
}

// GET /api/groups?tenant_id=...&workspace_id=...
func (h *GroupHandler) List(c *gin.Context) {
	var tenantID, wsID pgtype.UUID
	tenantID.Scan(c.Query("tenant_id"))
	wsID.Scan(c.Query("workspace_id"))

	groups, err := h.db.ListGroupsByWorkspace(c.Request.Context(), database.ListGroupsByWorkspaceParams{
		TenantID:    tenantID,
		WorkspaceID: wsID,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list groups"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"groups": groups})
}

// ────────────────────────────────────────────────────────────────
// Chat Handler
// ────────────────────────────────────────────────────────────────

type ChatHandler struct {
	db *database.Queries
}

func NewChatHandler(db *database.Queries) *ChatHandler {
	return &ChatHandler{db: db}
}

// POST /api/chats
func (h *ChatHandler) Create(c *gin.Context) {
	var req struct {
		TenantID    string `json:"tenant_id" binding:"required"`
		WorkspaceID string `json:"workspace_id" binding:"required"`
		GroupID     string `json:"group_id" binding:"required"`
		Title       string `json:"title"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var tenantID, wsID, groupID pgtype.UUID
	tenantID.Scan(req.TenantID)
	wsID.Scan(req.WorkspaceID)
	groupID.Scan(req.GroupID)

	chat, err := h.db.CreateChat(c.Request.Context(), database.CreateChatParams{
		TenantID:    tenantID,
		WorkspaceID: wsID,
		GroupID:     groupID,
		Title:       req.Title,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create chat"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"chat": chat})
}

// GET /api/chats?group_id=...
func (h *ChatHandler) List(c *gin.Context) {
	var groupID pgtype.UUID
	groupID.Scan(c.Query("group_id"))

	chats, err := h.db.ListChatsByGroup(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list chats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"chats": chats})
}

// GET /api/chats/:id/messages?limit=50&offset=0
func (h *ChatHandler) ListMessages(c *gin.Context) {
	var chatID pgtype.UUID
	chatID.Scan(c.Param("id"))

	limit := int32(50)
	offset := int32(0)

	// Parse query params
	if l := c.Query("limit"); l != "" {
		if v, err := strconv.ParseInt(l, 10, 32); err == nil && v > 0 && v <= 200 {
			limit = int32(v)
		}
	}
	if o := c.Query("offset"); o != "" {
		if v, err := strconv.ParseInt(o, 10, 32); err == nil && v >= 0 {
			offset = int32(v)
		}
	}

	messages, err := h.db.ListMessagesByChat(c.Request.Context(), database.ListMessagesByChatParams{
		ChatID: chatID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list messages"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"messages": messages})
}
