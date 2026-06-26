-- name: InsertMessage :one
INSERT INTO messages (
    id,
    tenant_id,
    workspace_id,
    group_id,
    chat_id,
    user_id,
    role,
    content,
    created_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, NOW()
)
RETURNING *;
