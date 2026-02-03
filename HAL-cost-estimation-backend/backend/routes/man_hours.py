from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from backend.services.man_hours_extraction_service import ManHoursExtractionService


router = APIRouter(prefix="/man-hours", tags=["Man Hours"])


class ManHoursExtractResponse(BaseModel):
    man_hours_per_unit: float
    match: str | None = None
    filename: str


@router.post("/extract", response_model=ManHoursExtractResponse)
async def extract_man_hours(file: UploadFile = File(...)):
    try:
        content = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read uploaded file")

    text, err = ManHoursExtractionService.extract_text(file.filename or "", content)
    if err is not None or not text:
        raise HTTPException(status_code=400, detail=err or "Failed to extract text")

    value, match = ManHoursExtractionService.extract_man_hours(text)
    if value is None:
        raise HTTPException(status_code=404, detail=str(match or "Man hours value not found"))

    return ManHoursExtractResponse(
        man_hours_per_unit=value,
        match=match,
        filename=file.filename or "",
    )
