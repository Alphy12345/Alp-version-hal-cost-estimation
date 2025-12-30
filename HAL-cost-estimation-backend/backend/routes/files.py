from fastapi import APIRouter, UploadFile, File
from fastapi.responses import StreamingResponse
from backend.services.file_service import upload_file
from backend.services.minio_client import MINIO_CLIENT, BUCKET_NAME


router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    file_id = upload_file(file)
    return {
        "message": "File uploaded successfully",
        "file_id": file_id
    }


@router.get("/download/{file_id:path}")
def download_file(file_id: str):
    obj = MINIO_CLIENT.get_object(BUCKET_NAME, file_id)

    filename = file_id.rsplit("/", 1)[-1]

    return StreamingResponse(
        obj,
        media_type="application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
