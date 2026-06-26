-- name: CreateWorkspace :one
INSERT INTO workspaces (tenant_id, name, slug)
VALUES ($1, $2, $3)
RETURNING *;

-- name: GetWorkspaceByID :one
SELECT * FROM workspaces WHERE id = $1;

-- name: GetWorkspaceBySlug :one
SELECT * FROM workspaces WHERE slug = $1;

-- name: ListWorkspacesByTenant :many
SELECT w.* FROM workspaces w
JOIN workspace_members wm ON wm.workspace_id = w.id
WHERE w.tenant_id = $1 AND wm.user_id = $2
ORDER BY w.created_at DESC;

-- name: AddWorkspaceMember :exec
INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES ($1, $2, $3)
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- name: GetWorkspaceMember :one
SELECT * FROM workspace_members
WHERE workspace_id = $1 AND user_id = $2;

-- name: ListWorkspaceMembers :many
SELECT wm.*, u.display_name, u.email, u.avatar_url
FROM workspace_members wm
JOIN users u ON u.id = wm.user_id
WHERE wm.workspace_id = $1
ORDER BY wm.joined_at;

-- name: RemoveWorkspaceMember :exec
DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2;
