from datetime import datetime

def test_message_api_groups_and_history(client):
    """
    Validates that a user can create groups/chats, receive messages, 
    and that their custom avatar appears correctly in the message history payload.
    """
    EMAIL = "debug_image_user@test.com"
    PASSWORD = "password123"
    
    # 1. Signup
    res = client.post("/auth/signup", json={"email": EMAIL, "password": PASSWORD, "username": "ImgUser"})
    assert res.status_code == 200
    token = res.json().get("access_token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Upload Avatar
    img_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff\x3f\x03\x00\x05\xfe\x02\xfe\xa7\x35\x81\x84\x00\x00\x00\x00IEND\xae\x42\x60\x82'
    files = {"file": ("test_avatar.png", img_data, "image/png")}
    
    res = client.post("/auth/profile/avatar", files=files, headers=headers)
    assert res.status_code == 200
    
    # 3. Create Group/Chat
    res = client.post("/api/groups", json={"name": "ImgTestGroup"}, headers=headers)
    assert res.status_code == 200
    group_id = res.json().get("id")
    
    res = client.post(f"/api/groups/{group_id}/chats", json={"title": "ImgChat"}, headers=headers)
    assert res.status_code == 200
    chat_id = res.json().get("id")
    
    # 4. Insert a message into DB intentionally 
    # (Since WebSocket testing in FastAPI requires specialized Socket.IO test clients, 
    # we can simulate the DB layer directly for this REST API payload test)
    from app.core.mongo import get_message_collection
    
    msg_col = get_message_collection()
    msg_col.insert_one({
        "user_id": EMAIL,
        "group_id": group_id,
        "chat_id": chat_id,
        "role": "user",
        "content": "Test message for avatar verify",
        "created_at": datetime.utcnow()
    })
    
    # 5. Fetch Messages API and verify fields
    res = client.get(f"/api/messages/{group_id}/{chat_id}", headers=headers)
    assert res.status_code == 200
    msgs = res.json()
    
    assert len(msgs) == 1, "Expected exactly 1 message in the chat"
    
    last_msg = msgs[0]
    assert last_msg["sender"] == EMAIL
    assert "sender_image" in last_msg
    assert last_msg["sender_image"] is not None, "sender_image should not be null after uploading an avatar"
    assert str(last_msg["sender_image"]).startswith("/static/avatars/")
