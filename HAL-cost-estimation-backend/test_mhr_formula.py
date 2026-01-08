#!/usr/bin/env python3
"""
Test different MHR formulas to find the correct one
"""

def test_current_formula():
    """Current formula being used"""
    investment_cost = 2000000
    elect_power_charges = 25
    utilization_hrs_year = 3348
    
    depreciation_cost = (investment_cost * 0.10) / utilization_hrs_year
    machine_utilization_cost = depreciation_cost + elect_power_charges
    total_mhr = machine_utilization_cost * 1.05
    
    print(f"Current Formula: (({investment_cost} × 10% ÷ {utilization_hrs_year}) + {elect_power_charges}) × 1.05")
    print(f"Depreciation Cost: {depreciation_cost:.2f}")
    print(f"Machine Utilization Cost: {machine_utilization_cost:.2f}")
    print(f"Total MHR: {total_mhr:.2f}")
    print()

def test_formula_without_maintenance():
    """Test without 1.05 maintenance factor"""
    investment_cost = 2000000
    elect_power_charges = 25
    utilization_hrs_year = 3348
    
    depreciation_cost = (investment_cost * 0.10) / utilization_hrs_year
    machine_utilization_cost = depreciation_cost + elect_power_charges
    
    print(f"Formula without maintenance: (({investment_cost} × 10% ÷ {utilization_hrs_year}) + {elect_power_charges})")
    print(f"Result: {machine_utilization_cost:.2f}")
    print()

def test_different_depreciation_rates():
    """Test different depreciation rates to get 84"""
    investment_cost = 2000000
    elect_power_charges = 25
    utilization_hrs_year = 3348
    target_result = 84
    
    # Work backwards: (target/1.05 - elect_power_charges) * utilization_hrs_year / investment_cost
    depreciation_rate = ((target_result / 1.05) - elect_power_charges) * utilization_hrs_year / investment_cost
    
    print(f"To get {target_result}:")
    print(f"Required depreciation rate: {depreciation_rate:.6f} ({depreciation_rate*100:.2f}%)")
    print(f"Formula: (({investment_cost} × {depreciation_rate:.6f} ÷ {utilization_hrs_year}) + {elect_power_charges}) × 1.05")
    
    # Test with this rate
    depreciation_cost = (investment_cost * depreciation_rate) / utilization_hrs_year
    machine_utilization_cost = depreciation_cost + elect_power_charges
    total_mhr = machine_utilization_cost * 1.05
    print(f"Result: {total_mhr:.2f}")
    print()

def test_alternative_formulas():
    """Test some alternative formulas that might give 84"""
    investment_cost = 2000000
    elect_power_charges = 25
    utilization_hrs_year = 3348
    
    # Test 1: Maybe it's 5% depreciation instead of 10%
    depreciation_cost_5 = (investment_cost * 0.05) / utilization_hrs_year
    machine_utilization_cost_5 = depreciation_cost_5 + elect_power_charges
    total_mhr_5 = machine_utilization_cost_5 * 1.05
    print(f"Test 1 (5% depreciation): {total_mhr_5:.2f}")
    
    # Test 2: Maybe no maintenance factor (1.05)
    depreciation_cost = (investment_cost * 0.10) / utilization_hrs_year
    machine_utilization_cost = depreciation_cost + elect_power_charges
    print(f"Test 2 (no maintenance): {machine_utilization_cost:.2f}")
    
    # Test 3: Maybe 3% maintenance instead of 5%
    total_mhr_3 = machine_utilization_cost * 1.03
    print(f"Test 3 (3% maintenance): {total_mhr_3:.2f}")
    
    # Test 4: Maybe 8% depreciation with 5% maintenance
    depreciation_cost_8 = (investment_cost * 0.08) / utilization_hrs_year
    machine_utilization_cost_8 = depreciation_cost_8 + elect_power_charges
    total_mhr_8 = machine_utilization_cost_8 * 1.05
    print(f"Test 4 (8% depreciation): {total_mhr_8:.2f}")

if __name__ == "__main__":
    print("=== MHR Formula Analysis ===")
    print()
    
    print("Current Implementation:")
    test_current_formula()
    
    print("Target Analysis:")
    test_different_depreciation_rates()
    
    print("Alternative Formulas:")
    test_alternative_formulas()
