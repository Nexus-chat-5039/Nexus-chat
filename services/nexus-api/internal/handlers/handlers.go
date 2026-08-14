package handlers

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"nexus/services/nexus-api/internal/database"
	"nexus/services/nexus-api/internal/middleware"
)

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
	// Format as XXXX-XXXX
	return string(code[:4]) + "-" + string(code[4:]), nil
}

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
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}

	// Create default tenant and workspace
	tenant, err := h.db.CreateTenant(c.Request.Context(), database.CreateTenantParams{
		Name: displayName + "'s Organization",
		Plan: "free",
	})
	if err == nil {
		ws, err := h.db.CreateWorkspace(c.Request.Context(), database.CreateWorkspaceParams{
			TenantID: tenant.ID,
			Name:     displayName + "'s Workspace",
			Slug:     strings.ToLower(strings.ReplaceAll(displayName, " ", "-")) + "-workspace",
		})
		if err == nil {
			h.db.AddWorkspaceMember(c.Request.Context(), database.AddWorkspaceMemberParams{
				WorkspaceID: ws.ID,
				UserID:      user.ID,
				Role:        "owner",
			})

			code, _ := generateInviteCode()
			var inviteCodePg pgtype.Text
			inviteCodePg.Scan(code)
			grp, err := h.db.CreateGroup(c.Request.Context(), database.CreateGroupParams{
				TenantID:    tenant.ID,
				WorkspaceID: ws.ID,
				Name:        "General",
				OwnerID:     user.ID,
				AiEnabled:   true,
				InviteCode:  inviteCodePg,
				Visibility:  "private",
				JoinPolicy:  "invite_only",
			})
			if err == nil {
				h.db.AddGroupMember(c.Request.Context(), database.AddGroupMemberParams{
					GroupID: grp.ID,
					UserID:  user.ID,
					Role:    "owner",
				})
				h.db.CreateChat(c.Request.Context(), database.CreateChatParams{
					TenantID:    tenant.ID,
					WorkspaceID: ws.ID,
					GroupID:     grp.ID,
					Title:       "general",
				})
			}
		}

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
	h.db.UpdateLastSeen(c.Request.Context(), user.ID)

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
// Group Handler (Enterprise)
// ────────────────────────────────────────────────────────────────

type GroupHandler struct {
	db *database.Queries
}

func NewGroupHandler(db *database.Queries) *GroupHandler {
	return &GroupHandler{db: db}
}

// POST /api/groups — Create a new group with invite code
func (h *GroupHandler) Create(c *gin.Context) {
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

	userID, _ := c.Get("user_id")
	var uid pgtype.UUID
	uid.Scan(userID.(string))

	var tenantID, wsID pgtype.UUID
	
	if req.TenantID != "" && req.WorkspaceID != "" {
		tenantID.Scan(req.TenantID)
		wsID.Scan(req.WorkspaceID)
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

	// Generate unique invite code with retry
	var inviteCode string
	for i := 0; i < 5; i++ {
		code, err := generateInviteCode()
		if err != nil {
			continue
		}
		inviteCode = code
		break
	}
	if inviteCode == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate invite code"})
		return
	}

	var inviteCodePg pgtype.Text
	inviteCodePg.Scan(inviteCode)

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
	h.db.AddGroupMember(c.Request.Context(), database.AddGroupMemberParams{
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
	h.db.InsertAuditLog(c.Request.Context(), database.InsertAuditLogParams{
		GroupID: group.ID,
		ActorID: uid,
		Action:  "group.created",
		Metadata: mustJSON(map[string]string{
			"name":        req.Name,
			"invite_code": inviteCode,
		}),
	})

	// Fetch members for response
	members, _ := h.db.ListGroupMembers(c.Request.Context(), group.ID)

	c.JSON(http.StatusCreated, gin.H{
		"group": serializeGroup(group, []database.Chat{chat}, members),
	})
}

// GET /api/groups — List groups the authenticated user belongs to
func (h *GroupHandler) List(c *gin.Context) {
	userID, _ := c.Get("user_id")
	var uid pgtype.UUID
	uid.Scan(userID.(string))

	groups, err := h.db.ListGroupsByUser(c.Request.Context(), uid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list groups"})
		return
	}

	// Auto-provision a default group and chat if user has none in their workspace
	if len(groups) == 0 {
		workspaces, err := h.db.ListWorkspacesByUser(c.Request.Context(), uid)
		if err == nil && len(workspaces) > 0 {
			ws := workspaces[0]
			code, _ := generateInviteCode()
			var inviteCodePg pgtype.Text
			inviteCodePg.Scan(code)

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
				h.db.AddGroupMember(c.Request.Context(), database.AddGroupMemberParams{
					GroupID: newGrp.ID,
					UserID:  uid,
					Role:    "owner",
				})
				h.db.CreateChat(c.Request.Context(), database.CreateChatParams{
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
		members, _ := h.db.ListGroupMembers(c.Request.Context(), g.ID)
		result = append(result, serializeGroup(g, chats, members))
	}

	c.JSON(http.StatusOK, gin.H{"groups": result})
}

// POST /api/groups/join — Join a group via invite code
func (h *GroupHandler) Join(c *gin.Context) {
	var req struct {
		Code string `json:"code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")
	var uid pgtype.UUID
	uid.Scan(userID.(string))

	// Normalize: uppercase and trim
	code := strings.ToUpper(strings.TrimSpace(req.Code))

	// Look up group by invite_code on the groups table
	var inviteCodePg pgtype.Text
	inviteCodePg.Scan(code)

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
		// Already a member, just return the group
		chats, _ := h.db.ListChatsByGroup(c.Request.Context(), group.ID)
		members, _ := h.db.ListGroupMembers(c.Request.Context(), group.ID)
		c.JSON(http.StatusOK, gin.H{"group": serializeGroup(group, chats, members)})
		return
	}

	// Add as member
	h.db.AddGroupMember(c.Request.Context(), database.AddGroupMemberParams{
		GroupID: group.ID,
		UserID:  uid,
		Role:    "member",
	})

	// Also add to workspace_members so message send works
	h.db.AddWorkspaceMember(c.Request.Context(), database.AddWorkspaceMemberParams{
		WorkspaceID: group.WorkspaceID,
		UserID:      uid,
		Role:        "member",
	})

	// Audit log
	h.db.InsertAuditLog(c.Request.Context(), database.InsertAuditLogParams{
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
	var groupID pgtype.UUID
	groupID.Scan(c.Param("id"))

	userID, _ := c.Get("user_id")
	var uid pgtype.UUID
	uid.Scan(userID.(string))

	// Verify ownership
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
	reason.Scan("deleted by owner")

	err = h.db.SoftDeleteGroup(c.Request.Context(), database.SoftDeleteGroupParams{
		ID:             groupID,
		DeletionReason: reason,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete group"})
		return
	}

	// Audit log
	h.db.InsertAuditLog(c.Request.Context(), database.InsertAuditLogParams{
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
	db *database.Queries
}

func NewChatHandler(db *database.Queries) *ChatHandler {
	return &ChatHandler{db: db}
}

// POST /api/chats
func (h *ChatHandler) Create(c *gin.Context) {
	var req struct {
		TenantID    string `json:"tenant_id"`
		WorkspaceID string `json:"workspace_id"`
		GroupID     string `json:"group_id" binding:"required"`
		Title       string `json:"title" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var groupID pgtype.UUID
	groupID.Scan(req.GroupID)

	// Get the group to inherit tenant/workspace
	group, err := h.db.GetGroupByID(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "group not found"})
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
	groupID := c.Query("group_id")
	if groupID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "group_id query param required"})
		return
	}

	var gid pgtype.UUID
	gid.Scan(groupID)

	chats, err := h.db.ListChatsByGroup(c.Request.Context(), gid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list chats"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"chats": chats})
}

// GET /api/chats/:id/messages
func (h *ChatHandler) ListMessages(c *gin.Context) {
	var chatID pgtype.UUID
	if err := chatID.Scan(c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
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
	var messageID pgtype.UUID
	if err := messageID.Scan(c.Param("id")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
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
	// Build member list with emails
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

// mustJSON marshals a value to JSON bytes, panicking on error (safe for known types).
func mustJSON(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("{}")
	}
	return b
}
