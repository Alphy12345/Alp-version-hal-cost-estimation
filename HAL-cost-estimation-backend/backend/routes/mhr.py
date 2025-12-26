from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from ..db import get_db
from ..models.models import MHR, Machine
from ..schemas.schemas import MHRCreate, MHROut
router = APIRouter(prefix="/mhr", tags=["MHR"])

@router.post("/", response_model=MHROut)
def create(data: MHRCreate, db: Session = Depends(get_db)):
    obj = MHR(**data.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.get("/", response_model=list[MHROut])
def get_all(db: Session = Depends(get_db)):
    return db.query(MHR).options(
        joinedload(MHR.operation_type),
        joinedload(MHR.duty),
        joinedload(MHR.machine).joinedload(Machine.operation_type)
    ).all()

@router.get("/{id}", response_model=MHROut)
def get_one(id: int, db: Session = Depends(get_db)):
    obj = db.query(MHR).options(
        joinedload(MHR.operation_type),
        joinedload(MHR.duty),
        joinedload(MHR.machine).joinedload(Machine.operation_type)
    ).filter(MHR.id == id).first()
    if not obj:
        raise HTTPException(404, "MHR not found")
    return obj

@router.put("/{id}", response_model=MHROut)
def update(id: int, data: MHRCreate, db: Session = Depends(get_db)):
    obj = db.get(MHR, id)
    if not obj:
        raise HTTPException(404, "MHR not found")
    for k, v in data.dict().items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    return obj

@router.delete("/{id}")
def delete(id: int, db: Session = Depends(get_db)):
    obj = db.get(MHR, id)
    if not obj:
        raise HTTPException(404, "MHR not found")
    db.delete(obj)
    db.commit()
    return {"message": "Deleted successfully"}