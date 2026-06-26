-- name: UpsertUser :one
INSERT INTO users (firebase_uid, email, display_name, avatar_url, last_seen)
VALUES ($1, $2, $3, $4, NOW())
ON CONFLICT (firebase_uid) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    last_seen = NOW()
RETURNING *;

-- name: GetUserByFirebaseUID :one
SELECT * FROM users WHERE firebase_uid = $1;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;
