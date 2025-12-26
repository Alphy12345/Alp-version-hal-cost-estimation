from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from ..schemas.cost_schemas import (
    CostEstimationRequest, 
    CostEstimationResponse,
    CostBreakdown
)
from ..services.cost_calculation_service import CostCalculationService

router = APIRouter(prefix="/cost-estimation", tags=["Cost Estimation"])

@router.post("/calculate", response_model=CostEstimationResponse)
def calculate_cost_estimation(
    request: CostEstimationRequest,
    db: Session = Depends(get_db)
):
    """
    Calculate manufacturing cost estimation per unit.
    
    ## Required Inputs:
    - **dimensions**: Provide diameter+length (for round) OR length+breadth+height (for rectangular)
    - **material**: aluminium, steel, titanium
    - **operation_type**: turning, milling, drilling, grinding, boring, etc.
    - **machine_name**: Name of the machine to use (from machines table)
    - **man_hours_per_unit**: Time required per unit (in hours)
    
    ## Optional Inputs:
    - **duty_category**: Override auto-classification (light, medium, heavy)
    
    ## How to get machine_name:
    1. Call GET /machines/ to see all available machines
    2. Copy the exact machine name you want to use
    3. Pass that name in the request
    
    ## Dimension Requirements by Operation:
    
    **TURNING, BORING** (Round parts):
    - Required: diameter, length
    - Example:
    ```json
    {
      "material": "steel",
      "operation_type": "turning",
      "dimensions": {"diameter": 50, "length": 200},
      "machine_name": "CNC Lathe",
      "man_hours_per_unit": 0.5
    }
    ```
    
    **MILLING, GRINDING, SURFACE_TREATMENT** (Rectangular parts):
    - Required: length, breadth, height
    - Example:
    ```json
    {
      "material": "aluminium",
      "operation_type": "milling",
      "dimensions": {"length": 100, "breadth": 50, "height": 30},
      "machine_name": "CNC Milling Machine",
      "man_hours_per_unit": 1.0
    }
    ```
    
    **DRILLING, WELDING, HEAT_TREATMENT** (Flexible):
    - Accepts EITHER round OR rectangular dimensions
    
    ## Calculation Formula:
    1. **A** = Man-hours per unit (from input)
    2. **B** = Machine Hour Rate (from database based on machine_id)
    3. **C** = Wage Rate (based on machine category)
    4. **D** = Basic Cost = A × (B + C)
    5. **OH** = Overheads = 100% of C (which is just C)
    6. **Profit** = 10% of (D + OH)
    7. **P&F** = 2% of D
    8. **Unit Cost** = D + OH + Profit + P&F
    
    ## Returns:
    - Selected machine details
    - Auto-detected shape and dimensions
    - Calculated volume
    - Duty classification
    - Complete cost breakdown per unit
    - Step-by-step calculation explanation
    """
    
    # Initialize service
    service = CostCalculationService(db)
    
    # Step 1: Get machine details from database by name
    try:
        machine_details = service.get_machine_details(request.machine_name, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    machine_name = machine_details["name"]
    
    # Step 2: Determine machine category from name
    machine_category = service.determine_machine_category(machine_name)
    
    # Detect shape and prepare dimensions dict
    dims = request.dimensions
    if dims.diameter is not None:
        # Round part
        shape = "round"
        dimensions_dict = {
            "diameter": dims.diameter,
            "length": dims.length
        }
        volume = 3.14159 * (dims.diameter/2)**2 * dims.length
    elif dims.breadth is not None and dims.height is not None:
        # Rectangular part
        shape = "rectangular"
        dimensions_dict = {
            "length": dims.length,
            "breadth": dims.breadth,
            "height": dims.height
        }
        volume = dims.length * dims.breadth * dims.height
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid dimensions. Provide either (diameter + length) for round parts OR (length + breadth + height) for rectangular parts"
        )
    
    # Step 3: Determine duty category
    if request.duty_category:
        duty = request.duty_category.value
    else:
        duty = service.determine_duty_category(
            shape=shape,
            dimensions=dimensions_dict,
            material=request.material.value,
            operation=request.operation_type.value
        )
    
    # Step 4: Get Machine Hour Rate (B)
    try:
        machine_hour_rate = service.get_machine_hour_rate(
            operation=request.operation_type.value,
            duty=duty,
            machine_name=machine_name,
            db=db,
            machine_id=machine_details.get("id"),
            op_type_id=machine_details.get("operation_type_id"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # Step 5: Get Wage Rate (C)
    wage_rate = service.get_wage_rate(machine_name)
    
    # Step 6: Get Man-hours (A) from input
    man_hours = request.man_hours_per_unit
    
    # Step 7: Calculate all costs
    cost_breakdown = service.calculate_costs(
        man_hours=man_hours,
        machine_hour_rate=machine_hour_rate,
        wage_rate=wage_rate,
        quantity=1  # Always calculate per unit
    )
    
    # Remove total_cost since we're calculating per unit
    cost_breakdown.pop('total_cost', None)
    
    # Step 8: Create calculation explanation
    calculation_steps = {
        "step_1_inputs": {
            "A_man_hours": man_hours,
            "B_machine_hour_rate": machine_hour_rate,
            "C_wage_rate": wage_rate
        },
        "step_2_basic_cost": {
            "formula": "D = A × (B + C)",
            "calculation": f"{man_hours} × ({machine_hour_rate} + {wage_rate})",
            "result": cost_breakdown["basic_cost_per_unit"]
        },
        "step_3_overheads": {
            "formula": "OH = 100% of C (which is just C)",
            "calculation": f"{wage_rate}",
            "result": cost_breakdown["overheads_per_unit"]
        },
        "step_4_profit": {
            "formula": "Profit = 10% of (D + OH)",
            "calculation": f"0.10 × ({cost_breakdown['basic_cost_per_unit']} + {cost_breakdown['overheads_per_unit']})",
            "result": cost_breakdown["profit_per_unit"]
        },
        "step_5_packing_forwarding": {
            "formula": "P&F = 2% of D",
            "calculation": f"0.02 × {cost_breakdown['basic_cost_per_unit']}",
            "result": cost_breakdown["packing_forwarding_per_unit"]
        },
        "step_6_unit_cost": {
            "formula": "Unit Cost = D + OH + Profit + P&F",
            "calculation": f"{cost_breakdown['basic_cost_per_unit']} + {cost_breakdown['overheads_per_unit']} + {cost_breakdown['profit_per_unit']} + {cost_breakdown['packing_forwarding_per_unit']}",
            "result": cost_breakdown["unit_cost"]
        },
        "step_7_outsourcing_mhr": {
            "formula": "Outsourcing MHR = B + 2C",
            "calculation": f"{machine_hour_rate} + (2 × {wage_rate})",
            "result": cost_breakdown["outsourcing_mhr"]
        }
    }
    
    # Prepare response
    response = CostEstimationResponse(
        duty_category=duty,
        selected_machine=machine_details,
        machine_category=machine_category,
        shape=shape,
        dimensions=dimensions_dict,
        volume=round(volume, 2),
        cost_breakdown=CostBreakdown(**cost_breakdown),
        material=request.material,
        operation_type=request.operation_type,
        calculation_steps=calculation_steps
    )
    
    return response


@router.post("/quick-estimate", response_model=dict)
def quick_estimate(
    operation: str,
    duty: str,
    quantity: int,
    db: Session = Depends(get_db)
):
    """
    Quick cost estimate with minimal inputs
    Returns simplified cost breakdown
    """
    service = CostCalculationService(db)
    
    # Use defaults
    machine_name, machine_category = service.select_machine(
        operation=operation,
        duty=duty,
        material="steel",
        machine_category=None
    )

    try:
        machine_details = service.get_machine_details(machine_name, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    try:
        machine_hour_rate = service.get_machine_hour_rate(
            operation=operation,
            duty=duty,
            machine_name=machine_name,
            db=db,
            machine_id=machine_details.get("id"),
            op_type_id=machine_details.get("operation_type_id"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    wage_rate = service.get_wage_rate(machine_name)
    man_hours = service.calculate_man_hours(operation, duty)
    
    cost_breakdown = service.calculate_costs(
        man_hours=man_hours,
        machine_hour_rate=machine_hour_rate,
        wage_rate=wage_rate,
        quantity=quantity
    )
    
    return {
        "machine": machine_name,
        "duty": duty,
        "quantity": quantity,
        "unit_cost": cost_breakdown["unit_cost"],
        "total_cost": cost_breakdown["total_cost"],
        "details": cost_breakdown
    }