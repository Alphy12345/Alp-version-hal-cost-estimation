from fastapi import APIRouter, UploadFile, File, Query, Form, Depends, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from backend.services.file_service import upload_file
from backend.services.minio_client import MINIO_CLIENT, BUCKET_NAME
from sqlalchemy.orm import Session
from backend.db import get_db
from backend.models.projects import ProjectPart
from backend.services.file_extraction import extract_from_uploaded_file
import os
import shutil

router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    file_id = upload_file(file)
    return {
        "message": "File uploaded successfully",
        "file_id": file_id
    }


@router.get("/download/{file_id:path}")
def download_file(file_id: str, inline: bool = Query(False, description="Display file inline instead of downloading")):
    obj = MINIO_CLIENT.get_object(BUCKET_NAME, file_id)

    filename = file_id.rsplit("/", 1)[-1]
    
    # Determine content type based on file extension
    if filename.lower().endswith('.pdf'):
        media_type = "application/pdf"
    elif filename.lower().endswith(('.jpg', '.jpeg')):
        media_type = "image/jpeg"
    elif filename.lower().endswith('.png'):
        media_type = "image/png"
    elif filename.lower().endswith('.gif'):
        media_type = "image/gif"
    else:
        media_type = "application/octet-stream"
    
    # Set Content-Disposition based on inline parameter
    if inline:
        content_disposition = f'inline; filename="{filename}"'
    else:
        content_disposition = f'attachment; filename="{filename}"'

    return StreamingResponse(
        obj,
        media_type=media_type,
        headers={
            "Content-Disposition": content_disposition
        }
    )


@router.get("/uploads/{file_path:path}")
def serve_upload_file(file_path: str, inline: bool = Query(False, description="Display file inline instead of downloading")):
    """Serve files from uploads directory with proper headers for inline display"""
    file_location = os.path.join("uploads", file_path)
    
    if not os.path.exists(file_location):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    
    filename = os.path.basename(file_path)
    
    # Determine content type based on file extension
    if filename.lower().endswith('.pdf'):
        media_type = "application/pdf"
    elif filename.lower().endswith(('.jpg', '.jpeg')):
        media_type = "image/jpeg"
    elif filename.lower().endswith('.png'):
        media_type = "image/png"
    elif filename.lower().endswith('.gif'):
        media_type = "image/gif"
    else:
        media_type = "application/octet-stream"
    
    # Set Content-Disposition based on inline parameter
    if inline:
        content_disposition = f'inline; filename="{filename}"'
    else:
        content_disposition = f'attachment; filename="{filename}"'

    return FileResponse(
        file_location,
        media_type=media_type,
        headers={
            "Content-Disposition": content_disposition
        }
    )


@router.post("/import/file")
async def import_file(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    part_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """Import a file, extract operation details, and associate it with a part/project."""
    try:
        # Verify part exists
        part = db.query(ProjectPart).filter(ProjectPart.id == part_id).first()
        if not part:
            raise HTTPException(status_code=404, detail="Part not found")
        
        # Create uploads directory if it doesn't exist
        upload_dir = os.path.join("uploads", "imported", str(project_id), str(part_id))
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        filename = file.filename
        file_path = os.path.join(upload_dir, filename)
        
        # Save file locally
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Extract operation details from file
        extraction_result = extract_from_uploaded_file(file_path)
        
        # Store relative path in database
        relative_path = os.path.join("uploads", "imported", str(project_id), str(part_id), filename)
        
        return {
            "message": "File imported successfully",
            "filename": filename,
            "file_path": relative_path,
            "project_id": project_id,
            "part_id": part_id,
            "extraction_success": extraction_result.get('success', False),
            "extracted_data": extraction_result.get('extracted_data', {}),
            "text_preview": extraction_result.get('text', '')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import file: {str(e)}")
