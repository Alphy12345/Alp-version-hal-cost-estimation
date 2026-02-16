import sys
sys.path.insert(0, 'c:/Cmti/alphy version  complete hal cost estimation/HAL-cost-estimation-backend')

from backend.services.file_extraction import FileExtractionService, extract_from_uploaded_file
import os

# Test with a PDF file if available
pdf_files = [
    "c:/Cmti/alphy version  complete hal cost estimation/HAL-cost-estimation-backend/uploads/test.pdf",
    "c:/Cmti/alphy version  complete hal cost estimation/test-pdf-layout.html"
]

# Find any PDF in uploads directory
uploads_dir = "c:/Cmti/alphy version  complete hal cost estimation/HAL-cost-estimation-backend/uploads"
if os.path.exists(uploads_dir):
    for f in os.listdir(uploads_dir):
        if f.endswith('.pdf'):
            pdf_path = os.path.join(uploads_dir, f)
            print(f"\n{'='*60}")
            print(f"Testing with: {pdf_path}")
            print(f"{'='*60}")
            
            # Extract text
            text = FileExtractionService.extract_text_from_file(pdf_path)
            print(f"\n--- Extracted Text ({len(text)} chars) ---")
            print(text[:1000])
            print("\n...")
            print(text[-500:])
            
            # Try to extract operations
            print(f"\n--- Attempting operation extraction ---")
            operations = FileExtractionService.extract_multiple_operations(text)
            print(f"Found {len(operations)} operations:")
            for i, op in enumerate(operations):
                print(f"  {i+1}. {op}")
            break
else:
    print("No uploads directory found")
