import os
import uuid
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from app.auth.dependencies import get_current_user
import logging

router = APIRouter(tags=["Upload"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = "app/static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Security limits
UPLOAD_MAX_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {
    # Images
    "jpg", "jpeg", "png", "gif", "webp", "svg",
    # Documents
    "pdf", "txt", "md", "csv",
    # Archives
    "zip",
}
BLOCKED_EXTENSIONS = {"exe", "sh", "bat", "cmd", "ps1", "php", "jsp", "html", "htm", "js"}

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user=Depends(get_current_user)
):
    try:
        # Validate extension
        original_name = file.filename or "unknown"
        ext = os.path.splitext(original_name)[1].lstrip(".").lower()
        
        if ext in BLOCKED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type .{ext} is not allowed")
        
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400, 
                detail=f"File type .{ext} is not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )
        
        # Read with size limit
        contents = await file.read()
        if len(contents) > UPLOAD_MAX_SIZE:
            raise HTTPException(status_code=400, detail="File must be under 10 MB")
        
        # Generate safe filename (UUID, not user-controlled)
        unique_filename = f"{uuid.uuid4()}.{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(file_path, "wb") as buffer:
            buffer.write(contents)
            
        file_url = f"/static/uploads/{unique_filename}"
        
        file_type = "image" if file.content_type and file.content_type.startswith("image/") else "file"
        
        return {
            "id": str(uuid.uuid4()),
            "url": file_url,
            "type": file_type,
            "name": original_name,
            "size": len(contents)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to upload file")
