#!/usr/bin/env python3
"""Test PDF extraction with sample text matching the actual PDF format."""

import sys
sys.path.insert(0, 'c:/Cmti/alphy version  complete hal cost estimation/HAL-cost-estimation-backend')

from backend.services.file_extraction import FileExtractionService

# Sample text that mimics what pdfplumber extracts from the generated PDF
sample_text = """HAL Cost Estimation - Operations Report

Project: test
Date: 16/2/2026
Part: 12 - asfg

OPERATIONS SUMMARY
Total Operations: 3
Part Number: 12

Operation 1: Drilling
Material: steel
Man Hours/Unit: 1800
Setup Time (min): 25
Diameter (mm): 22
Shape: rectangular
Machine: Drilling machine
Duty Category: heavy
Cycle Time (min): 120
Length (mm): 65

Operation 2: Turning
Material: aluminium
Man Hours/Unit: 2400
Setup Time (min): 30
Diameter (mm): 40
Shape: round
Machine: CNC
Duty Category: medium
Cycle Time (min): 90
Length (mm): 120

Operation 3: Milling
Material: steel
Man Hours/Unit: 150
Setup Time (min): 3
Length (mm): 200
Shape: rectangular
Machine: 3 axis CNC
Duty Category: heavy
Cycle Time (min): 45
Breadth (mm): 60
Height (mm): 50
"""

print("="*70)
print("Testing PDF format extraction")
print("="*70)

# Test 1: Direct PDF format extraction
print("\n--- Test 1: extract_operations_from_pdf_format ---")
operations = FileExtractionService.extract_operations_from_pdf_format(sample_text)
print(f"\nResult: Found {len(operations)} operations")
for i, op in enumerate(operations):
    print(f"\nOperation {i+1}:")
    for key, value in op.items():
        if value is not None:
            print(f"  {key}: {value}")

# Test 2: Full pipeline
print("\n" + "="*70)
print("--- Test 2: extract_multiple_operations (full pipeline) ---")
all_ops = FileExtractionService.extract_multiple_operations(sample_text)
print(f"\nResult: Found {len(all_ops)} operations")
for i, op in enumerate(all_ops):
    print(f"  Op {i+1}: {op.get('operation_type')} - {op.get('material')} - {op.get('machine')}")

print("\n" + "="*70)
if len(operations) > 0:
    print("✓ PDF extraction is working!")
else:
    print("✗ PDF extraction failed - check debug output above")
print("="*70)
