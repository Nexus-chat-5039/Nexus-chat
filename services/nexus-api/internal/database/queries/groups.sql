-- ============================================================
-- Group Queries
-- ============================================================

-- name: CreateGroup :one
INSERT INTO groups (tenant_id, workspace_id, name, owner_id, ai_enabled, invite_code, visibility, join_policy)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetGroupByID :one
SELECT * FROM groups WHERE id = $1 AND deleted_at IS NULL;

-- name: ListGroupsByUser :many
SELECT g.* FROM groups g
JOIN group_members gm ON gm.group_id = g.id
WHERE gm.user_id = $1 AND g.deleted_at IS NULL
ORDER BY g.created_at DESC;

-- name: UpdateGroupAI :exec
UPDATE groups SET ai_enabled = $2 WHERE id = $1;

-- name: SoftDeleteGroup :exec
UPDATE groups SET deleted_at = NOW(), deletion_reason = $2 WHERE id = $1;

-- name: GetGroupByInviteCode :one
SELECT * FROM groups WHERE invite_code = $1 AND deleted_at IS NULL;

-- ============================================================
-- Group Members
-- ============================================================

-- name: AddGroupMember :exec
INSERT INTO group_members (group_id, user_id, role)
VALUES ($1, $2, $3)
ON CONFLICT (group_id, user_id) DO NOTHING;

-- name: RemoveGroupMember :exec
DELETE FROM group_members WHERE group_id = $1 AND user_id = $2;

-- name: GetGroupMember :one
SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2;

-- name: ListGroupMembers :many
SELECT gm.*, u.email, u.display_name, u.avatar_url
FROM group_members gm
JOIN users u ON u.id = gm.user_id
WHERE gm.group_id = $1
ORDER BY gm.joined_at;

-- ============================================================
-- Chat Queries
-- ============================================================

-- name: CreateChat :one
INSERT INTO chats (tenant_id, workspace_id, group_id, title)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetChatByID :one
SELECT * FROM chats WHERE id = $1;

-- name: ListChatsByGroup :many
SELECT * FROM chats WHERE group_id = $1
ORDER BY created_at ASC;

-- name: DeleteChat :exec
DELETE FROM chats WHERE id = $1;

-- ============================================================
-- Message Queries
-- ============================================================

-- name: ListMessagesByChat :many
SELECT m.*, u.email as user_email, u.display_name, u.avatar_url 
FROM messages m
LEFT JOIN users u ON m.user_id = u.id
WHERE m.chat_id = $1 AND m.is_deleted = false
ORDER BY m.created_at ASC
LIMIT $2 OFFSET $3;

-- ============================================================
-- Group Invites
-- ============================================================

-- name: CreateInvite :one
INSERT INTO group_invites (code, group_id, created_by, role_granted, max_uses, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetInviteByCode :one
SELECT * FROM group_invites WHERE code = $1 AND revoked_at IS NULL;

-- name: ListInvitesByGroup :many
SELECT * FROM group_invites
WHERE group_id = $1 AND revoked_at IS NULL
ORDER BY created_at DESC;

-- name: RevokeInvite :exec
UPDATE group_invites SET revoked_at = NOW(), revoked_by = $2 WHERE code = $1;

-- name: IncrementInviteUseCount :one
UPDATE group_invites
SET use_count = use_count + 1
WHERE code = $1 AND use_count < COALESCE(max_uses, 2147483647)
RETURNING use_count;

-- ============================================================
-- Audit Log
-- ============================================================

-- name: InsertAuditLog :exec
INSERT INTO group_audit_log (group_id, actor_id, action, metadata)
VALUES ($1, $2, $3, $4);

-- name: ListAuditLog :many
SELECT * FROM group_audit_log
WHERE group_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

