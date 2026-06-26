CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    workspace_id UUID NOT NULL,
    group_id UUID NOT NULL,
    chat_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    reply_to JSONB,
    reactions JSONB DEFAULT '[]',
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON messages
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_msg_room_time ON messages(tenant_id, group_id, chat_id, created_at DESC);
CREATE INDEX idx_msg_fulltext ON messages USING GIN(to_tsvector('english', content));
