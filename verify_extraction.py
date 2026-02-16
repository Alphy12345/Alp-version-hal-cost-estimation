#!/usr/bin/env python3
"""Verify extraction capabilities are properly configured."""

import sys
sys.path.insert(0, 'c:/Cmti/alphy version  complete hal cost estimation/HAL-cost-estimation-backend')

def check_imports():
    """Check if all required libraries are available."""
    results = {}
    
    # Check pdfplumber
    try:
        import pdfplumber
        results['pdfplumber'] = f"✓ Available (version {pdfplumber.__version__})"
    except ImportError:
        results['pdfplumber'] = "✗ Not installed - PDF text extraction will fail"
    
    # Check Tesseract
    try:
        import pytesseract
        from PIL import Image
        results['tesseract'] = "✓ Available"
    except ImportError:
        results['tesseract'] = "✗ Not installed - OCR will fail"
    
    # Check python-docx
    try:
        import docx
        results['python-docx'] = "✓ Available"
    except ImportError:
        results['python-docx'] = "✗ Not installed - Word extraction will fail"
    
    # Check openpyxl
    try:
        import openpyxl
        results['openpyxl'] = f"✓ Available (version {openpyxl.__version__})"
    except ImportError:
        results['openpyxl'] = "✗ Not installed - Excel .xlsx extraction will fail"
    
    # Check xlrd
    try:
        import xlrd
        results['xlrd'] = f"✓ Available (version {xlrd.__version__})"
    except ImportError:
        results['xlrd'] = "✗ Not installed - Excel .xls extraction will fail"
    
    return results

def check_methods():
    """Check if extraction methods exist."""
    from backend.services.file_extraction import FileExtractionService
    
    methods = [
        'extract_text_from_file',
        'extract_multiple_operations',
        'extract_operations_from_pdf_format',
        '_parse_generated_pdf_table',
        '_extract_from_word',
        '_extract_from_excel',
    ]
    
    results = {}
    for method in methods:
        exists = hasattr(FileExtractionService, method)
        results[method] = "✓ Available" if exists else "✗ Missing"
    
    return results

if __name__ == "__main__":
    print("="*70)
    print("EXTRACTION CAPABILITIES VERIFICATION")
    print("="*70)
    
    print("\n1. LIBRARY AVAILABILITY:")
    print("-"*70)
    lib_results = check_imports()
    for lib, status in lib_results.items():
        print(f"  {lib:20} {status}")
    
    print("\n2. EXTRACTION METHODS:")
    print("-"*70)
    method_results = check_methods()
    for method, status in method_results.items():
        print(f"  {method:30} {status}")
    
    print("\n3. SUPPORTED FILE TYPES:")
    print("-"*70)
    from backend.services.file_extraction import FileExtractionService
    extensions = sorted(FileExtractionService.SUPPORTED_EXTENSIONS)
    print(f"  {', '.join(extensions)}")
    
    print("\n" + "="*70)
    
    # Overall status
    all_libs_ok = all('✓' in v for v in lib_results.values())
    all_methods_ok = all('✓' in v for v in method_results.values())
    
    if all_libs_ok and all_methods_ok:
        print("✓ ALL SYSTEMS READY - Extraction should work for PDF, Word, Excel, and images")
    else:
        print("✗ SOME COMPONENTS MISSING - Install missing libraries for full functionality")
    
    print("="*70)
