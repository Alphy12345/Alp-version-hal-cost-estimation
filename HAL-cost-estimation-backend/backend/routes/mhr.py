from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from ..db import get_db
from ..models.models import MHR, Machine
from ..schemas.schemas import MHRCreate, MHROut
from ..services.mhr_calculation_service import MHRCalculationService, MHRInput
from pydantic import BaseModel
from typing import Optional
router = APIRouter(prefix="/mhr", tags=["MHR"])

class MHRCalculationRequest(BaseModel):
    investment_cost: float
    elect_power_rating: float
    elect_power_charges: float
    available_hrs_per_annum: float
    utilization_hrs_year: float

class MHRCalculationResponse(BaseModel):
    machine_hour_rate: float
    calculation_breakdown: dict

@router.post("/calculate", response_model=MHRCalculationResponse)
def calculate_mhr(request: MHRCalculationRequest):
    """
    Calculate Machine Hour Rate based on input parameters
    """
    try:
        # Create input data for the service
        input_data = MHRInput(
            investment_cost=request.investment_cost,
            elect_power_rating=request.elect_power_rating,
            elect_power_charges=request.elect_power_charges,
            available_hrs_per_annum=request.available_hrs_per_annum,
            utilization_hrs_year=request.utilization_hrs_year
        )
        
        # Calculate MHR
        machine_hour_rate = MHRCalculationService.calculate_mhr(input_data)
        
        # Provide calculation breakdown for transparency
        depreciation_cost = (request.investment_cost * 0.10) / request.utilization_hrs_year
        machine_utilization_cost = depreciation_cost + request.elect_power_charges
        
        breakdown = {
            "depreciation_cost": round(depreciation_cost, 2),
            "electrical_power_charges": request.elect_power_charges,
            "machine_utilization_cost": round(machine_utilization_cost, 2),
            "final_calculation": f"{depreciation_cost:.2f} + {request.elect_power_charges} = {machine_hour_rate}"
        }
        
        return MHRCalculationResponse(
            machine_hour_rate=machine_hour_rate,
            calculation_breakdown=breakdown
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")

@router.post("/", response_model=MHROut)
def create(data: MHRCreate, db: Session = Depends(get_db)):
    # Calculate MHR if all required values are provided
    if (data.investment_cost is not None and 
        data.elect_power_charges is not None and 
        data.utilization_hrs_year is not None and
        data.utilization_hrs_year > 0):
        
        input_data = MHRInput(
            investment_cost=data.investment_cost,
            elect_power_rating=data.elect_power_rating or 0.0,
            elect_power_charges=data.elect_power_charges,
            available_hrs_per_annum=data.available_hrs_per_annum or 0.0,
            utilization_hrs_year=data.utilization_hrs_year
        )
        
        calculated_mhr = MHRCalculationService.calculate_mhr(input_data)
        # Update the data with calculated MHR
        data.machine_hr_rate = calculated_mhr
    
    # Convert float values to strings for database storage
    data_dict = data.dict()
    for key in ['investment_cost', 'elect_power_rating', 'elect_power_charges', 
                'available_hrs_per_annum', 'utilization_hrs_year', 'machine_hr_rate']:
        if data_dict.get(key) is not None:
            data_dict[key] = str(data_dict[key])
    
    obj = MHR(**data_dict)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    
    # Convert back to float for response
    for key in ['investment_cost', 'elect_power_rating', 'elect_power_charges', 
                'available_hrs_per_annum', 'utilization_hrs_year', 'machine_hr_rate']:
        if hasattr(obj, key) and getattr(obj, key) is not None:
            try:
                setattr(obj, key, float(getattr(obj, key)))
            except (ValueError, TypeError):
                pass
    
    return obj

@router.get("/", response_model=list[MHROut])
def get_all(db: Session = Depends(get_db)):
    results = db.query(MHR).options(
        joinedload(MHR.operation_type),
        joinedload(MHR.duty),
        joinedload(MHR.machine).joinedload(Machine.operation_type)
    ).all()
    
    # Convert string values to floats for response
    for obj in results:
        for key in ['investment_cost', 'elect_power_rating', 'elect_power_charges', 
                    'available_hrs_per_annum', 'utilization_hrs_year', 'machine_hr_rate']:
            if hasattr(obj, key) and getattr(obj, key) is not None:
                try:
                    setattr(obj, key, float(getattr(obj, key)))
                except (ValueError, TypeError):
                    pass
    
    return results

@router.get("/{id}", response_model=MHROut)
def get_one(id: int, db: Session = Depends(get_db)):
    obj = db.query(MHR).options(
        joinedload(MHR.operation_type),
        joinedload(MHR.duty),
        joinedload(MHR.machine).joinedload(Machine.operation_type)
    ).filter(MHR.id == id).first()
    if not obj:
        raise HTTPException(404, "MHR not found")
    
    # Convert string values to floats for response
    for key in ['investment_cost', 'elect_power_rating', 'elect_power_charges', 
                'available_hrs_per_annum', 'utilization_hrs_year', 'machine_hr_rate']:
        if hasattr(obj, key) and getattr(obj, key) is not None:
            try:
                setattr(obj, key, float(getattr(obj, key)))
            except (ValueError, TypeError):
                pass
    
    return obj

@router.put("/{id}", response_model=MHROut)
def update(id: int, data: MHRCreate, db: Session = Depends(get_db)):
    obj = db.get(MHR, id)
    if not obj:
        raise HTTPException(404, "MHR not found")
    
    # Calculate MHR if all required values are provided
    if (data.investment_cost is not None and 
        data.elect_power_charges is not None and 
        data.utilization_hrs_year is not None and
        data.utilization_hrs_year > 0):
        
        input_data = MHRInput(
            investment_cost=data.investment_cost,
            elect_power_rating=data.elect_power_rating or 0.0,
            elect_power_charges=data.elect_power_charges,
            available_hrs_per_annum=data.available_hrs_per_annum or 0.0,
            utilization_hrs_year=data.utilization_hrs_year
        )
        
        calculated_mhr = MHRCalculationService.calculate_mhr(input_data)
        # Update the data with calculated MHR
        data.machine_hr_rate = calculated_mhr
    
    # Convert float values to strings for database storage
    data_dict = data.dict()
    for key in ['investment_cost', 'elect_power_rating', 'elect_power_charges', 
                'available_hrs_per_annum', 'utilization_hrs_year', 'machine_hr_rate']:
        if data_dict.get(key) is not None:
            data_dict[key] = str(data_dict[key])
    
    for k, v in data_dict.items():
        setattr(obj, k, v)
    db.commit()
    db.refresh(obj)
    
    # Convert back to float for response
    for key in ['investment_cost', 'elect_power_rating', 'elect_power_charges', 
                'available_hrs_per_annum', 'utilization_hrs_year', 'machine_hr_rate']:
        if hasattr(obj, key) and getattr(obj, key) is not None:
            try:
                setattr(obj, key, float(getattr(obj, key)))
            except (ValueError, TypeError):
                pass
    
    return obj

@router.delete("/{id}")
def delete(id: int, db: Session = Depends(get_db)):
    obj = db.get(MHR, id)
    if not obj:
        raise HTTPException(404, "MHR not found")
    db.delete(obj)
    db.commit()
    return {"message": "Deleted successfully"}