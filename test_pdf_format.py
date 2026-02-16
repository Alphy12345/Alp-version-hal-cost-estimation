import sys
sys.path.insert(0, 'c:/Cmti/alphy version  complete hal cost estimation/HAL-cost-estimation-backend')

from backend.services.file_extraction import FileExtractionService

# Sample text simulating the PDF format from the screenshot
sample_pdf_text = """
HAL Cost Estimation - Operations Report
Project: test
Date: 16/2/2026

Part: 12 - asfg
Page 1 of 1

OPERATIONS SUMMARY
Total Operations: 20
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

print("="*60)
print("Testing PDF format extraction with sample text")
print("="*60)

# Test the extraction
operations = FileExtractionService.extract_operations_from_pdf_format(sample_pdf_text)

print(f"\n{'='*60}")
print(f"Extracted {len(operations)} operations:")
print(f"{'='*60}")

for i, op in enumerate(operations):
    print(f"\nOperation {i+1}:")
    for key, value in op.items():
        if value is not None:
            print(f"  {key}: {value}")

# Also test the full pipeline
print(f"\n{'='*60}")
print("Testing full extract_multiple_operations pipeline:")
print(f"{'='*60}")

all_ops = FileExtractionService.extract_multiple_operations(sample_pdf_text)
print(f"Total operations found: {len(all_ops)}")
