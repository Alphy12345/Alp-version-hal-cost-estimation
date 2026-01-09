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
    machine_type: Optional[str] = None  # "conventional" or "cnc"

class PowerAndUtilizationRequest(BaseModel):
    elect_power_rating: float
    available_hrs_per_annum: float
    machine_type: str  # "conventional" or "cnc"

class PowerAndUtilizationResponse(BaseModel):
    electrical_power_charges: float
    utilization_hrs_year: float
    calculation_breakdown: dict

class MHRCalculationResponse(BaseModel):
    machine_hour_rate: float
    calculation_breakdown: dict

@router.post("/calculate-power-utilization", response_model=PowerAndUtilizationResponse)
def calculate_power_and_utilization(request: PowerAndUtilizationRequest, db: Session = Depends(get_db)):
    """
    Calculate Electrical Power Charges and Utilization Hours based on machine type
    
    Electrical Power Charges: Power Rating × 5.0
    Utilization Hours: Available Hours - Downtime
    Downtime: 7% for conventional machines, 15% for CNC machines
    """
    try:
        # Calculate Electrical Power Charges
        electrical_power_charges = MHRCalculationService.calculate_electrical_power_charges(
            request.elect_power_rating, 5.0
        )
        
        # Calculate downtime based on machine type
        machine_type_lower = request.machine_type.lower()
        if machine_type_lower == "conventional":
            downtime_percentage = 0.07  # 7% downtime
        elif machine_type_lower == "cnc":
            downtime_percentage = 0.15  # 15% downtime
        else:
            # Default to conventional if machine type is not recognized
            downtime_percentage = 0.07
        
        # Calculate downtime hours
        downtime_hours = request.available_hrs_per_annum * downtime_percentage
        
        # Calculate Utilization Hours
        utilization_hrs_year = MHRCalculationService.calculate_utilization_hours(
            request.available_hrs_per_annum, downtime_hours
        )
        
        # Provide calculation breakdown
        breakdown = {
            "electrical_power_calculation": f"{request.elect_power_rating} kW × 5.0 = {electrical_power_charges}",
            "machine_type": request.machine_type,
            "downtime_percentage": f"{downtime_percentage * 100}%",
            "downtime_hours": round(downtime_hours, 2),
            "utilization_calculation": f"{request.available_hrs_per_annum} - {downtime_hours:.2f} = {utilization_hrs_year:.2f}"
        }
        
        return PowerAndUtilizationResponse(
            electrical_power_charges=electrical_power_charges,
            utilization_hrs_year=utilization_hrs_year,
            calculation_breakdown=breakdown
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")

@router.post("/calculate", response_model=MHRCalculationResponse)
def calculate_mhr_endpoint(request: MHRCalculationRequest, db: Session = Depends(get_db)):
    """
    Calculate Machine Hour Rate with auto-calculation for missing values
    """
    try:
        # Create input data with optional values for auto-calculation
        input_data = MHRInput(
            investment_cost=request.investment_cost,
            elect_power_rating=request.elect_power_rating,
            elect_power_charges=request.elect_power_charges if request.elect_power_charges > 0 else None,
            available_hrs_per_annum=request.available_hrs_per_annum,
            utilization_hrs_year=request.utilization_hrs_year if request.utilization_hrs_year > 0 else None,
            machine_type=request.machine_type
        )
        
        # Calculate MHR with auto-calculation
        machine_hour_rate = MHRCalculationService.calculate_mhr(input_data)
        
        # Get the actual calculated values for breakdown
        if input_data.elect_power_charges is None:
            # Auto-calculated electrical power charges
            elect_power_charges = MHRCalculationService.calculate_electrical_power_charges(request.elect_power_rating, 5.0)
        else:
            elect_power_charges = request.elect_power_charges
        
        if input_data.utilization_hrs_year is None:
            # Auto-calculated utilization hours based on machine type
            if request.machine_type:
                machine_type_lower = request.machine_type.lower()
                if machine_type_lower == "cnc":
                    downtime_percentage = 0.15  # 15% downtime for CNC
                else:
                    downtime_percentage = 0.07  # 7% downtime for conventional
            else:
                downtime_percentage = 0.07  # Default to conventional
            
            downtime_hours = request.available_hrs_per_annum * downtime_percentage
            utilization_hrs_year = MHRCalculationService.calculate_utilization_hours(request.available_hrs_per_annum, downtime_hours)
        else:
            utilization_hrs_year = request.utilization_hrs_year
            downtime_percentage = None
            downtime_hours = None
        
        # Provide calculation breakdown for transparency
        depreciation_cost = (request.investment_cost * 0.10) / utilization_hrs_year
        machine_utilization_cost = depreciation_cost + elect_power_charges
        
        breakdown = {
            "depreciation_cost": round(depreciation_cost, 2),
            "electrical_power_charges": elect_power_charges,
            "utilization_hrs_year": utilization_hrs_year,
            "machine_utilization_cost": round(machine_utilization_cost, 2),
            "maintenance_factor": 1.05,
            "machine_type": request.machine_type,
            "downtime_percentage": f"{downtime_percentage * 100}%" if downtime_percentage else "Not auto-calculated",
            "downtime_hours": round(downtime_hours, 2) if downtime_hours else None,
            "final_calculation": f"({depreciation_cost:.2f} + {elect_power_charges}) × 1.05 = {machine_hour_rate}"
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
    """
    Create MHR record with auto-calculation of missing values
    """
    # Determine machine type from machine name if machine_id is provided
    machine_type = None
    if data.machine_id:
        machine = db.query(Machine).filter(Machine.id == data.machine_id).first()
        if machine and machine.name:
            machine_name_lower = machine.name.lower()
            if "cnc" in machine_name_lower:
                machine_type = "cnc"
            else:
                machine_type = "conventional"
    
    should_auto_calculate_mhr = data.machine_hr_rate is None or data.machine_hr_rate <= 0

    # Only auto-calculate MHR when it is not explicitly provided.
    # For this project, the MHR used in cost estimation must come from the configured
    # reference table values (entered as machine_hr_rate).
    if should_auto_calculate_mhr:
        input_data = MHRInput(
            investment_cost=data.investment_cost,
            elect_power_rating=data.elect_power_rating or 0.0,
            elect_power_charges=data.elect_power_charges if data.elect_power_charges and data.elect_power_charges > 0 else None,
            available_hrs_per_annum=data.available_hrs_per_annum or 0.0,
            utilization_hrs_year=data.utilization_hrs_year if data.utilization_hrs_year and data.utilization_hrs_year > 0 else None,
            machine_type=machine_type
        )

        calculated_mhr = MHRCalculationService.calculate_mhr(input_data)
        data.machine_hr_rate = calculated_mhr

        if input_data.elect_power_charges is None:
            elect_power_charges = MHRCalculationService.calculate_electrical_power_charges(data.elect_power_rating or 0.0, 5.0)
        else:
            elect_power_charges = data.elect_power_charges

        if input_data.utilization_hrs_year is None:
            if machine_type == "cnc":
                downtime_percentage = 0.15  # 15% downtime for CNC
            else:
                downtime_percentage = 0.07  # 7% downtime for conventional

            downtime_hours = (data.available_hrs_per_annum or 0.0) * downtime_percentage
            utilization_hrs_year = MHRCalculationService.calculate_utilization_hours(data.available_hrs_per_annum or 0.0, downtime_hours)
        else:
            utilization_hrs_year = data.utilization_hrs_year
    else:
        elect_power_charges = data.elect_power_charges
        utilization_hrs_year = data.utilization_hrs_year
    
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
    
    # Only auto-calculate MHR if the caller did not provide machine_hr_rate.
    should_auto_calculate_mhr = data.machine_hr_rate is None or data.machine_hr_rate <= 0
    if (
        should_auto_calculate_mhr
        and data.investment_cost is not None
        and data.elect_power_charges is not None
        and data.utilization_hrs_year is not None
        and data.utilization_hrs_year > 0
    ):
        input_data = MHRInput(
            investment_cost=data.investment_cost,
            elect_power_rating=data.elect_power_rating or 0.0,
            elect_power_charges=data.elect_power_charges,
            available_hrs_per_annum=data.available_hrs_per_annum or 0.0,
            utilization_hrs_year=data.utilization_hrs_year
        )

        calculated_mhr = MHRCalculationService.calculate_mhr(input_data)
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