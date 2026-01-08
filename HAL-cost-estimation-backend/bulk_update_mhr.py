#!/usr/bin/env python3
"""
Bulk update all MHR records with corrected formula
"""

import requests
import json

def calculate_corrected_mhr(investment_cost, elect_power_charges, utilization_hrs_year):
    """
    Calculate MHR using the corrected formula (without maintenance factor)
    Formula: ((investment_cost × 10% ÷ utilization_hrs_year) + elect_power_charges)
    """
    if not investment_cost or not elect_power_charges or not utilization_hrs_year:
        return None
    
    if utilization_hrs_year <= 0:
        return None
    
    depreciation_cost = (investment_cost * 0.10) / utilization_hrs_year
    machine_utilization_cost = depreciation_cost + elect_power_charges
    total_machine_hour_rate = machine_utilization_cost
    
    return round(total_machine_hour_rate, 2)

def main():
    """Update all MHR records with corrected calculations"""
    
    print("🚀 Starting bulk MHR update with corrected formula...")
    print("=" * 60)
    
    # Get all existing MHR records
    try:
        response = requests.get("http://localhost:8000/mhr/")
        mhr_records = response.json()
        print(f"📊 Found {len(mhr_records)} MHR records to update")
    except Exception as e:
        print(f"❌ Failed to fetch MHR records: {e}")
        return
    
    updated_count = 0
    failed_count = 0
    
    for record in mhr_records:
        try:
            record_id = record['id']
            
            # Extract current values
            investment_cost = float(record.get('investment_cost', 0))
            elect_power_charges = float(record.get('elect_power_charges', 0))
            utilization_hrs_year = float(record.get('utilization_hrs_year', 0))
            current_mhr = record.get('machine_hr_rate')
            
            # Calculate new MHR using corrected formula
            new_mhr = calculate_corrected_mhr(investment_cost, elect_power_charges, utilization_hrs_year)
            
            if new_mhr is None:
                print(f"⚠️  Skipping ID {record_id}: Insufficient data for calculation")
                failed_count += 1
                continue
            
            # Prepare update data (keep all existing values, just update MHR)
            update_data = {
                "op_type_id": record.get('op_type_id'),
                "duty_id": record.get('duty_id'), 
                "machine_id": record.get('machine_id'),
                "investment_cost": investment_cost,
                "elect_power_rating": float(record.get('elect_power_rating', 0)),
                "elect_power_charges": elect_power_charges,
                "available_hrs_per_annum": float(record.get('available_hrs_per_annum', 0)),
                "utilization_hrs_year": utilization_hrs_year,
                "machine_hr_rate": new_mhr  # Updated with corrected calculation
            }
            
            # Update the record
            update_response = requests.put(f"http://localhost:8000/mhr/{record_id}", json=update_data)
            
            if update_response.status_code == 200:
                machine_name = record.get('machine', {}).get('name', 'Unknown')
                print(f"✅ Updated ID {record_id} ({machine_name}):")
                print(f"   Investment: {investment_cost:,}, Power Charges: {elect_power_charges}, Utilization: {utilization_hrs_year}")
                print(f"   Old MHR: {current_mhr} → New MHR: {new_mhr}")
                print()
                updated_count += 1
            else:
                print(f"❌ Failed to update ID {record_id}: {update_response.status_code}")
                failed_count += 1
                
        except Exception as e:
            print(f"❌ Error processing record {record.get('id', 'unknown')}: {e}")
            failed_count += 1
    
    print("=" * 60)
    print(f"📈 Update Summary:")
    print(f"   ✅ Successfully updated: {updated_count} records")
    print(f"   ❌ Failed to update: {failed_count} records")
    print(f"   📊 Total processed: {len(mhr_records)} records")
    
    if updated_count > 0:
        print(f"\n🎉 Bulk update completed! All MHR values now use the corrected formula.")
        print(f"   Formula: ((Investment × 10% ÷ Utilization) + Power Charges)")
        print(f"   (Maintenance factor 1.05 has been removed)")
    
    print("\n🔍 You can verify the updates by checking the MHR table in the UI.")

if __name__ == "__main__":
    main()
