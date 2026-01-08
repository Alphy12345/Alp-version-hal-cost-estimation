from typing import Optional
from pydantic import BaseModel


class MHRInput(BaseModel):
    investment_cost: float
    elect_power_rating: float
    elect_power_charges: Optional[float] = None  # Auto-calculated if not provided
    available_hrs_per_annum: float
    utilization_hrs_year: Optional[float] = None  # Auto-calculated if not provided
    machine_type: Optional[str] = None  # "conventional" or "cnc" for downtime calculation


class MHRCalculationService:
    """Service for calculating Machine Hour Rate (MHR)"""
    
    @staticmethod
    def calculate_mhr(input_data: MHRInput) -> float:
        """
        Calculate Machine Hour Rate based on the provided formulas:
        
        1. Electrical power charges, P: P = kW Rating x Rate per kWH (auto-calculated if not provided)
        2. Utilization Hrs/ Year, U: U = Available hours per Year minus Down Time (auto-calculated if not provided)
        3. Machine Utilization Cost, M (Rs/hr): M = (I * 10% / U) + P
        4. Total Machine Hour Rate, B (Rs/hr): B = M x 1.05 (always apply 5% maintenance cost)
        
        Note: Auto-calculation logic:
        - If elect_power_charges is None: calculate from elect_power_rating x rate_per_kwh (assume 5 per kWH)
        - If utilization_hrs_year is None: calculate from available_hrs_per_annum x 0.93 (assume 7% downtime)
        - Always multiply final MHR by 1.05 for maintenance cost
        """
        
        # Extract values from input
        investment_cost = input_data.investment_cost
        elect_power_rating = input_data.elect_power_rating
        available_hrs_per_annum = input_data.available_hrs_per_annum
        
        # Auto-calculate electrical power charges if not provided
        if input_data.elect_power_charges is None:
            # Assume rate per kWH = 5 (standard rate)
            elect_power_charges = MHRCalculationService.calculate_electrical_power_charges(elect_power_rating, 5.0)
        else:
            elect_power_charges = input_data.elect_power_charges
        
        # Auto-calculate utilization hours if not provided
        if input_data.utilization_hrs_year is None:
            # Calculate downtime based on machine type
            if input_data.machine_type:
                machine_type_lower = input_data.machine_type.lower()
                if machine_type_lower == "cnc":
                    downtime_percentage = 0.15  # 15% downtime for CNC
                else:
                    downtime_percentage = 0.07  # 7% downtime for conventional
            else:
                # Default to 7% downtime if machine type not specified
                downtime_percentage = 0.07
            
            downtime_hours = available_hrs_per_annum * downtime_percentage
            utilization_hrs_year = MHRCalculationService.calculate_utilization_hours(available_hrs_per_annum, downtime_hours)
        else:
            utilization_hrs_year = input_data.utilization_hrs_year
        
        # Validate inputs
        if utilization_hrs_year <= 0:
            raise ValueError("Utilization hours per year must be greater than 0")
        
        if investment_cost < 0:
            raise ValueError("Investment cost cannot be negative")
        
        # Calculate Machine Utilization Cost, M (Rs/hr)
        # M = (I * 10% / U) + P
        depreciation_cost = (investment_cost * 0.10) / utilization_hrs_year
        machine_utilization_cost = depreciation_cost + elect_power_charges
        
        # Calculate Total Machine Hour Rate, B (Rs/hr)
        # B = M x 1.05 (always apply 5% maintenance cost)
        total_machine_hour_rate = machine_utilization_cost * 1.05
        
        return round(total_machine_hour_rate, 2)
    
    @staticmethod
    def calculate_electrical_power_charges(kw_rating: float, rate_per_kwh: float) -> float:
        """
        Calculate Electrical power charges, P: P = kW Rating x Rate per kWH
        """
        return round(kw_rating * rate_per_kwh, 2)
    
    @staticmethod
    def calculate_utilization_hours(available_hrs_per_annum: float, downtime_hours: float = 0) -> float:
        """
        Calculate Utilization Hrs/ Year, U: U = Available hours per Year minus Down Time
        """
        utilization_hours = available_hrs_per_annum - downtime_hours
        return max(0, utilization_hours)  # Ensure non-negative result
