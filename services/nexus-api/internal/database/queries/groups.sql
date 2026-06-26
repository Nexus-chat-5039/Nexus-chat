-- name: CreateGroup :one
INSERT INTO groups (tenant_id, workspace_id, name, owner_id, ai_enabled)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetGroupByID :one
SELECT * FROM groups WHERE id = $1;

-- name: ListGroupsByWorkspace :many
SELECT * FROM groups WHERE tenant_id = $1 AND workspace_id = $2
ORDER BY created_at DESC;

-- name: UpdateGroupAI :exec
UPDATE groups SET ai_enabled = $2 WHERE id = $1;

-- name: DeleteGroup :exec
DELETE FROM groups WHERE id = $1;

-- name: CreateChat :one
INSERT INTO chats (tenant_id, workspace_id, group_id, title)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetChatByID :one
SELECT * FROM chats WHERE id = $1;

-- name: ListChatsByGroup :many
SELECT * FROM chats WHERE group_id = $1
ORDER BY created_at DESC;

-- name: ListMessagesByChat :many
SELECT * FROM messages
WHERE chat_id = $1 AND is_deleted = false
ORDER BY created_at ASC
LIMIT $2 OFFSET $3;
