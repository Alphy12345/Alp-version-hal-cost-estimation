from typing import Optional
from pydantic import BaseModel


class MHRInput(BaseModel):
    investment_cost: float
    elect_power_rating: float
    elect_power_charges: float
    available_hrs_per_annum: float
    utilization_hrs_year: float


class MHRCalculationService:
    """Service for calculating Machine Hour Rate (MHR)"""
    
    @staticmethod
    def calculate_mhr(input_data: MHRInput) -> float:
        """
        Calculate Machine Hour Rate based on the provided formulas:
        
        1. Electrical power charges, P: P = kW Rating x Rate per kWH
        2. Utilization Hrs/ Year, U: U = Available hours per Year minus Down Time
        3. Machine Utilization Cost, M (Rs/hr): M = (I * 10% / U) + P
        4. Total Machine Hour Rate, B (Rs/hr): B = M (no maintenance factor)
        
        Note: In the current implementation, we assume:
        - P is already calculated by the user (elect_power_charges)
        - U is provided directly by the user (utilization_hrs_year)
        - I is the investment_cost
        - No maintenance factor is applied (removed the 1.05 multiplier)
        """
        
        # Extract values from input
        investment_cost = input_data.investment_cost
        elect_power_charges = input_data.elect_power_charges
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
        # B = M (no maintenance factor applied)
        total_machine_hour_rate = machine_utilization_cost
        
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
