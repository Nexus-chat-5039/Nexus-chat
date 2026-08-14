# Nexus Chat: Frontend Changes & Backend Implementation Specification

This document provides a complete summary of the newly implemented frontend features in **Nexus Chat**, followed by the database migrations, WebSocket event contracts, and REST API updates required on the backend.

---

## 1. Summary of Frontend Changes

### 1.1 🚀 AI Experience & Streaming
- **Blinking Cursor & Shimmer Glow**:
  - `src/chat/MessageBubble.tsx` renders a blinking crimson cursor (`▍`) on active streaming AI messages and applies an animated glow border (`@keyframes shimmer`).
- **Streaming State Synchronization**:
  - `src/hooks/useMessages.ts` tracks `streamingMessageId` from incoming `ai_stream_chunk` socket events and resets it when `isFinal: true`.
- **Smart Status Indicator**:
  - `src/chat/MessageList.tsx` displays `"Nexus AI is thinking..."` with animated sparkles when generation begins.

### 1.2 ⚡ Chat Slash Commands (`/`)
- **Interactive Autocomplete**:
  - `src/chat/SlashCommandMenu.tsx` provides keyboard-navigable (`↑`/`↓`/`Enter`/`Tab`/`Escape`) command suggestions.
- **Built-in Commands**:
  | Command | Frontend Action | Prompt Format Sent with `triggerAI: true` |
  |---|---|---|
  | `/summarize` | Instant send | `Summarize the last 20 messages in this conversation` |
  | `/explain [topic]` | Prefixes template | `Explain in detail: {input}` |
  | `/code [task]` | Prefixes template | `Write code for: {input}` |
  | `/translate [text]` | Prefixes template | `Translate the following to English: {input}` |
  | `/goal [target]` | Prefixes template | `Help me create an actionable plan with milestones for this goal: {input}` |
  | `/help` | Local cheat-sheet | Displays in-app command reference without sending message |

### 1.3 🎯 Global Command Palette (`⌘K` / `Ctrl+K`)
- **Spotlight Modal**:
  - `src/components/CommandPalette.tsx` enables global search across channels, workspaces, and navigation actions (*Settings*, *Profile*, *Log Out*, *New Chat*, *New Group*, *Join Group*).
  - Integrated into `src/chat/ChatHeader.tsx` with a desktop `⌘K` keyboard badge.

### 1.4 ❤️ Live Message Reactions
- **Quick-Emoji Picker**:
  - `src/chat/ReactionBar.tsx` displays 6 quick reactions (`👍`, `❤️`, `😂`, `🚀`, `💡`, `👀`) on message hover.
- **Aggregated Badges**:
  - Shows group count badges (e.g. `👍 3`) with active highlighted styling if the logged-in user reacted.
  - Optimistic UI updates with socket broadcast.

### 1.5 🧵 Threaded Discussions Side Panel
- **Dedicated Thread Panel**:
  - `src/chat/ThreadPanel.tsx` provides a side panel with pinned parent message preview, thread reply stream, and compact reply composer.
  - Parent message bubbles display interactive badges (`💬 3 replies · 2m ago`) and a *"Reply in thread"* context menu option.

---

## 2. Required Backend Changes

---

### 2.1 Database Migrations

#### A. Table: `message_reactions`
Stores per-message user emoji reactions.

```sql
CREATE TABLE IF NOT EXISTS message_reactions (
    id VARCHAR(36) PRIMARY KEY,
    message_id VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_message_emoji UNIQUE (message_id, user_email, emoji)
);

CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions(message_id);
```

#### B. Table: `thread_messages`
Stores conversation replies isolated from the main channel feed.

```sql
CREATE TABLE IF NOT EXISTS thread_messages (
    id VARCHAR(36) PRIMARY KEY,
    parent_message_id VARCHAR(36) NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chat_id VARCHAR(36) NOT NULL,
    group_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255),
    user_avatar VARCHAR(512),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_thread_parent_id ON thread_messages(parent_message_id);
```

#### C. Columns on `messages` table (For counter caching)
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_count INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_last_reply_at TIMESTAMP WITH TIME ZONE;
```

---

### 2.2 WebSocket Events Contract

#### 1. Message Reactions

##### `Client -> Server: react_message`
Triggered when a user clicks an emoji reaction.
```json
{
  "messageId": "msg_12345",
  "emoji": "👍",
  "groupId": "group_abc",
  "chatId": "chat_xyz"
}
```

##### Backend Logic:
1. Identify `userEmail` from the authenticated socket session.
2. Query `message_reactions` for `(message_id, user_email, emoji)`.
3. If entry **exists**: `DELETE FROM message_reactions` (action = `"remove"`).
4. If entry **does not exist**: `INSERT INTO message_reactions` (action = `"add"`).
5. Broadcast `message_reacted` to all clients in the chat room.

##### `Server -> Client: message_reacted`
```json
{
  "messageId": "msg_12345",
  "emoji": "👍",
  "userId": "user@example.com",
  "action": "add"
}
```
*(Note: `action` is `"add"` or `"remove"`).*

---

#### 2. Threaded Replies

##### `Client -> Server: send_thread_reply`
Triggered when sending a reply inside the thread side panel.
```json
{
  "parentMessageId": "msg_12345",
  "content": "Let's proceed with this plan.",
  "groupId": "group_abc",
  "chatId": "chat_xyz",
  "tempId": "thread_temp_98765"
}
```

##### Backend Logic:
1. Insert the new reply into `thread_messages`.
2. Update parent record: `UPDATE messages SET thread_count = thread_count + 1, thread_last_reply_at = NOW() WHERE id = parent_message_id`.
3. Broadcast `thread_reply` to all clients in the room.

##### `Server -> Client: thread_reply`
```json
{
  "parentMessageId": "msg_12345",
  "reply": {
    "id": "thread_msg_uuid",
    "content": "Let's proceed with this plan.",
    "userEmail": "sender@example.com",
    "userName": "Alex",
    "userAvatar": "/avatars/alex.png",
    "createdAt": "2026-08-14T15:10:00Z"
  }
}
```

---

### 2.3 REST API Updates

#### `GET /api/chats/:chatId/messages`
Update message payload response to include aggregated reactions and thread metadata:

```json
{
  "messages": [
    {
      "id": "msg_12345",
      "content": "Hello team!",
      "user_email": "alice@example.com",
      "created_at": "2026-08-14T14:00:00Z",
      "reactions": {
        "👍": ["bob@example.com", "carol@example.com"],
        "❤️": ["alice@example.com"]
      },
      "thread_count": 2,
      "thread_last_reply_at": "2026-08-14T14:25:00Z"
    }
  ]
}
```

#### `GET /api/messages/:messageId/thread` (Optional: Thread History)
Endpoint to fetch replies when opening an existing thread:

```json
{
  "parent_message_id": "msg_12345",
  "replies": [
    {
      "id": "thread_msg_1",
      "content": "First response",
      "user_email": "bob@example.com",
      "user_name": "Bob",
      "user_avatar": null,
      "created_at": "2026-08-14T14:05:00Z"
    }
  ]
}
```
