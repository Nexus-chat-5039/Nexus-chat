def test_auth_and_avatar_flow(client):
    """
    Validates user signup, avatar upload, and profile retrieval logic.
    Using `TestClient` replaces manual HTTP requests to localhost.
    """
    EMAIL = "debug_auto_user@test.com"
    PASSWORD = "password123"

    # 1. Signup
    res = client.post("/auth/signup", json={
        "email": EMAIL,
        "password": PASSWORD,
        "username": "DebugUser"
    })
    
    assert res.status_code == 200, f"Signup failed: {res.text}"
    token = res.json().get("access_token")
    assert token is not None

    # 2. Upload Avatar
    # Create minimal 1x1 png in memory instead of reading from disk
    img_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff\x3f\x03\x00\x05\xfe\x02\xfe\xa7\x35\x81\x84\x00\x00\x00\x00IEND\xae\x42\x60\x82'
    
    headers = {"Authorization": f"Bearer {token}"}
    files = {"file": ("test_avatar.png", img_data, "image/png")}
    
    res = client.post("/auth/profile/avatar", files=files, headers=headers)
    assert res.status_code == 200, f"Upload failed: {res.text}"
    
    # 3. Check /auth/me for the avatar URL
    res = client.get("/auth/me", headers=headers)
    assert res.status_code == 200
    data = res.json()
    
    assert "profile_image" in data
    assert data["profile_image"] is not None
    assert str(data["profile_image"]).startswith("/static/avatars/")

    # 4. Fetch the image content (since the URL is relative to the server)
    img_url = data["profile_image"]
    img_res = client.get(img_url)
    assert img_res.status_code == 200, "Failed to retrieve the actual avatar image file"
    assert "image/png" in img_res.headers.get("Content-Type", "")
