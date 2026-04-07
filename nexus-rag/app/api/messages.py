from fastapi import APIRouter, Depends
from typing import List
from app.auth.dependencies import get_current_user
from app.core.mongo import get_message_collection
from datetime import datetime
from bson import ObjectId

router = APIRouter(prefix="/api/messages", tags=["Messages"])

def _format_messages(cursor, user):
    cursor_list = list(cursor)
    if not cursor_list:
        return []
        
    user_ids = list(set(msg["user_id"] for msg in cursor_list if msg.get("user_id")))
    
    from app.core.mongo import get_db
    db = get_db()
    users_col = db.users
    users_cursor = users_col.find({"email": {"$in": user_ids}})
    
    user_map = {}
    image_map = {}
    for u in users_cursor:
        email = u.get("email")
        if email:
            is_private = u.get("is_private", False)
            if is_private:
                if email == user["email"]:
                    user_map[email] = u.get("full_name") or u.get("username") or email.split("@")[0]
                    image_map[email] = u.get("profile_image")
                else:
                    uid_suffix = str(u["_id"])[-4:]
                    user_map[email] = f"User-{uid_suffix}"
                    image_map[email] = None 
            else:
                user_map[email] = u.get("full_name") or u.get("username") or email.split("@")[0]
                image_map[email] = u.get("profile_image")

    messages = []
    for msg in cursor_list:
        sender_email = msg.get("user_id")
        display_name = user_map.get(sender_email)
        sender_image = image_map.get(sender_email)
            
        messages.append({
            "id": str(msg["_id"]),
            "role": msg["role"],
            "content": msg["content"],
            "created_at": msg["created_at"],
            "sender": sender_email, 
            "sender_name": display_name,
            "sender_image": sender_image,
            "replyTo": msg.get("replyTo"),
            "is_deleted": msg.get("is_deleted", False),
            "is_edited": msg.get("is_edited", False),
            "reactions": msg.get("reactions", {}),
            "is_pinned": msg.get("is_pinned", False),
            "bookmarked_by": msg.get("bookmarked_by", []),
            "thread_id": msg.get("thread_id"),
            "reply_count": msg.get("reply_count", 0),
            "attachments": msg.get("attachments", [])
        })

    return messages

@router.get("/{group_id}/{chat_id}")
def get_chat_messages(
    group_id: str,
    chat_id: str,
    user=Depends(get_current_user)
):
    messages_col = get_message_collection()

    cursor = messages_col.find(
        {
            "group_id": group_id,
            "chat_id": chat_id,
            "thread_id": {"$in": [None, ""]},
            "deleted_for": {"$ne": user["email"]}
        }
    ).sort("created_at", 1)

    return _format_messages(cursor, user)

@router.get("/{group_id}/{chat_id}/thread/{message_id}")
def get_thread_messages(
    group_id: str,
    chat_id: str,
    message_id: str,
    user=Depends(get_current_user)
):
    messages_col = get_message_collection()

    # Get parent message
    parent = messages_col.find_one({"_id": ObjectId(message_id)})
    if not parent:
        return []
        
    parent_list = _format_messages([parent], user)
    
    # Get replies
    cursor = messages_col.find(
        {
            "group_id": group_id,
            "chat_id": chat_id,
            "thread_id": message_id,
            "deleted_for": {"$ne": user["email"]}
        }
    ).sort("created_at", 1)

    replies = _format_messages(cursor, user)
    return {
        "parent": parent_list[0] if parent_list else None,
        "replies": replies
    }
