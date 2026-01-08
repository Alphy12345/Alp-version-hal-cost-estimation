#!/usr/bin/env python3
"""
Test script to verify MHR calculation integration
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_mhr_calculation_endpoint():
    """Test the standalone MHR calculation endpoint"""
    print("Testing MHR calculation endpoint...")
    
    payload = {
        "investment_cost": 1000000,
        "elect_power_rating": 50,
        "elect_power_charges": 500,
        "available_hrs_per_annum": 2000,
        "utilization_hrs_year": 1800
    }
    
    try:
        response = requests.post(f"{BASE_URL}/mhr/calculate", json=payload)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Calculation successful: MHR = {data['machine_hour_rate']}")
            print(f"   Breakdown: {data['calculation_breakdown']}")
            return True
        else:
            print(f"❌ Calculation failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_mhr_create_with_calculation():
    """Test MHR creation with automatic calculation"""
    print("\nTesting MHR creation with automatic calculation...")
    
    payload = {
        "investment_cost": 1000000,
        "elect_power_rating": 50,
        "elect_power_charges": 500,
        "available_hrs_per_annum": 2000,
        "utilization_hrs_year": 1800
    }
    
    try:
        response = requests.post(f"{BASE_URL}/mhr/", json=payload)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Creation successful: ID = {data['id']}, MHR = {data['machine_hr_rate']}")
            return data['id']
        else:
            print(f"❌ Creation failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def test_mhr_update_with_calculation(mhr_id):
    """Test MHR update with automatic calculation"""
    print(f"\nTesting MHR update with automatic calculation (ID: {mhr_id})...")
    
    payload = {
        "investment_cost": 2000000,  # Changed value
        "elect_power_rating": 75,
        "elect_power_charges": 750,
        "available_hrs_per_annum": 2000,
        "utilization_hrs_year": 1800
    }
    
    try:
        response = requests.put(f"{BASE_URL}/mhr/{mhr_id}", json=payload)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Update successful: MHR = {data['machine_hr_rate']}")
            return True
        else:
            print(f"❌ Update failed: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Starting MHR Integration Tests")
    print("=" * 50)
    
    # Test 1: Standalone calculation endpoint
    test1_passed = test_mhr_calculation_endpoint()
    
    # Test 2: Create with automatic calculation
    mhr_id = test_mhr_create_with_calculation()
    
    # Test 3: Update with automatic calculation
    test3_passed = False
    if mhr_id:
        test3_passed = test_mhr_update_with_calculation(mhr_id)
    
    print("\n" + "=" * 50)
    print("📊 Test Results:")
    print(f"   Calculation Endpoint: {'✅ PASSED' if test1_passed else '❌ FAILED'}")
    print(f"   Create with Auto-Calc: {'✅ PASSED' if mhr_id else '❌ FAILED'}")
    print(f"   Update with Auto-Calc: {'✅ PASSED' if test3_passed else '❌ FAILED'}")
    
    if test1_passed and mhr_id and test3_passed:
        print("\n🎉 All tests passed! MHR integration is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Please check the implementation.")

if __name__ == "__main__":
    main()
