import os
import re
import shutil
import sys
from typing import Optional
from fastapi import UploadFile

# Check if Tesseract is in PATH
def check_tesseract_installed():
    """Check if tesseract command is available"""
    tesseract_cmd = 'tesseract'
    if sys.platform == 'win32':
        tesseract_cmd = 'tesseract.exe'
    
    for path in os.environ.get('PATH', '').split(os.pathsep):
        exe_path = os.path.join(path, tesseract_cmd)
        if os.path.exists(exe_path):
            print(f"Found Tesseract at: {exe_path}")
            return True
    return False

TESSERACT_IN_PATH = check_tesseract_installed()
print(f"Tesseract in PATH: {TESSERACT_IN_PATH}")

try:
    import pytesseract
    from pdf2image import convert_from_path
    from PIL import Image
    
    # Set explicit path to Tesseract on Windows
    if sys.platform == 'win32':
        possible_tesseract_paths = [
            r'C:\Program Files\Tesseract-OCR\tesseract.exe',
            r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
            os.path.expandvars(r'%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe'),
        ]
        for tesseract_path in possible_tesseract_paths:
            if os.path.exists(tesseract_path):
                pytesseract.pytesseract.tesseract_cmd = tesseract_path
                print(f"Set Tesseract path: {tesseract_path}")
                break
        
        # Set Poppler path for pdf2image on Windows
        possible_poppler_paths = [
            r'C:\poppler\poppler-24.08.0\Library\bin',
            r'C:\poppler\Library\bin',
            r'C:\poppler\bin',
        ]
        for poppler_path in possible_poppler_paths:
            if os.path.exists(poppler_path):
                os.environ['PATH'] = poppler_path + os.pathsep + os.environ.get('PATH', '')
                print(f"Added Poppler to PATH: {poppler_path}")
                break
    
    TESSERACT_AVAILABLE = True
    try:
        version = pytesseract.get_tesseract_version()
        print(f"Tesseract version: {version}")
    except Exception as e:
        print(f"Tesseract version check failed: {e}")
        TESSERACT_AVAILABLE = False
except Exception as e:
    TESSERACT_AVAILABLE = False
    print(f"WARNING: OCR libraries not available: {e}")

class FileExtractionService:
    """Service to extract operation details from uploaded files."""
    
    SUPPORTED_EXTENSIONS = {'.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.txt', '.csv'}
    
    # Keywords to search for in extracted text - expanded
    OPERATION_KEYWORDS = ['operation', 'operation type', 'op type', 'process', 'op:', 'operation:', 'opn', 'op.']
    MATERIAL_KEYWORDS = ['material', 'matl', 'mat:', 'material:', 'matl.', 'materials']
    MACHINE_KEYWORDS = ['machine', 'equipment', 'machine name', 'mach:', 'machine:', 'mach', 'mach.']
    MAN_HOURS_KEYWORDS = ['man hours', 'manhours', 'man hrs', 'hours per unit', 'hrs/unit', 'hrs', 'hours', 'man hr', 'hr/unit']
    DUTY_KEYWORDS = ['duty', 'duty category', 'load', 'duty:', 'duty cat', 'category']
    SETUP_TIME_KEYWORDS = ['setup time', 'machine setup time', 'set up time', 'setup:', 's/t', 'setup']
    CYCLE_TIME_KEYWORDS = ['cycle time', 'cycle', 'cycle:', 'c/t', 'cycletime']
    DIAMETER_KEYWORDS = ['diameter', 'dia', 'diam', 'd:', 'dia:', 'dia.', 'Ø', 'phi']
    LENGTH_KEYWORDS = ['length', 'len', 'l', 'len:', 'length:', 'l.']
    BREADTH_KEYWORDS = ['breadth', 'width', 'b', 'w', 'breadth:', 'width:', 'b.', 'w.']
    HEIGHT_KEYWORDS = ['height', 'h', 'thickness', 'thick', 'height:', 'h:', 'h.', 't.']
    
    @classmethod
    def extract_text_from_file(cls, file_path: str) -> str:
        """Extract text from PDF or image file."""
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext not in cls.SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file type: {ext}")
        
        # For text files, read directly
        if ext in ['.txt', '.csv']:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        
        if not TESSERACT_AVAILABLE:
            print("WARNING: Tesseract OCR not available. Cannot extract text from images/PDFs.")
            return ""
        
        if ext == '.pdf':
            return cls._extract_from_pdf(file_path)
        else:
            return cls._extract_from_image(file_path)
    
    @classmethod
    def _extract_from_pdf(cls, pdf_path: str) -> str:
        """Extract text from PDF using OCR."""
        text_parts = []
        try:
            images = convert_from_path(pdf_path, dpi=200)
            print(f"PDF has {len(images)} pages")
            for i, image in enumerate(images):
                print(f"Processing page {i+1}/{len(images)}")
                text = pytesseract.image_to_string(image)
                text_parts.append(text)
                print(f"Page {i+1} extracted text length: {len(text)}")
        except Exception as e:
            print(f"PDF extraction error: {e}")
            import traceback
            traceback.print_exc()
        
        return "\n".join(text_parts)
    
    @classmethod
    def _extract_from_image(cls, image_path: str) -> str:
        """Extract text from image using OCR."""
        try:
            if not TESSERACT_AVAILABLE:
                return ""
            image = Image.open(image_path)
            text = pytesseract.image_to_string(image)
            print(f"Image extracted text length: {len(text)}")
            return text
        except Exception as e:
            print(f"Image extraction error: {e}")
            import traceback
            traceback.print_exc()
            return ""
    
    @classmethod
    def extract_operation_details(cls, text: str) -> dict:
        """Extract operation details from text."""
        details = {
            'operation_type': None,
            'material': None,
            'machine': None,
            'man_hours': None,
            'duty_category': None,
            'machine_setup_time': None,
            'cycle_time': None,
            'diameter': None,
            'length': None,
            'breadth': None,
            'height': None,
            'shape': None
        }
        
        text_lower = text.lower()
        lines = text.split('\n')
        
        # Extract each field
        details['operation_type'] = cls._extract_value(text, lines, cls.OPERATION_KEYWORDS, 
                                                      ['turning', 'milling', 'drilling', 'grinding', 'boring'])
        details['material'] = cls._extract_value(text, lines, cls.MATERIAL_KEYWORDS,
                                               ['steel', 'aluminium', 'aluminum', 'titanium', 'brass', 'copper'])
        details['machine'] = cls._extract_machine(text, lines)
        details['man_hours'] = cls._extract_numeric_value(text, lines, cls.MAN_HOURS_KEYWORDS)
        details['duty_category'] = cls._extract_value(text, lines, cls.DUTY_KEYWORDS,
                                                      ['light', 'medium', 'heavy'])
        details['machine_setup_time'] = cls._extract_numeric_value(text, lines, cls.SETUP_TIME_KEYWORDS)
        details['cycle_time'] = cls._extract_numeric_value(text, lines, cls.CYCLE_TIME_KEYWORDS)
        details['diameter'] = cls._extract_numeric_value(text, lines, cls.DIAMETER_KEYWORDS)
        details['length'] = cls._extract_numeric_value(text, lines, cls.LENGTH_KEYWORDS)
        details['breadth'] = cls._extract_numeric_value(text, lines, cls.BREADTH_KEYWORDS)
        details['height'] = cls._extract_numeric_value(text, lines, cls.HEIGHT_KEYWORDS)
        
        # Determine shape based on dimensions found
        if details['diameter'] and not details['breadth']:
            details['shape'] = 'round'
        elif details['breadth'] or details['height']:
            details['shape'] = 'rectangular'
        
        return details
    
    @classmethod
    def _extract_value(cls, text: str, lines: list, keywords: list, allowed_values: list) -> Optional[str]:
        """Extract a value based on keywords and allowed values - case insensitive."""
        text_lower = text.lower()
        
        for i, line in enumerate(lines):
            line_lower = line.lower()
            # Check if any keyword is in the line
            if any(kw.lower() in line_lower for kw in keywords):
                # Look for allowed values in the same line or next few lines (case insensitive)
                search_text = line_lower
                if i + 1 < len(lines):
                    search_text += " " + lines[i + 1].lower()
                
                for value in allowed_values:
                    if value.lower() in search_text:
                        # Normalize aluminium spelling
                        if value.lower() in ['aluminium', 'aluminum']:
                            return 'aluminium'
                        return value.lower()
        return None
    
    @classmethod
    def _extract_machine(cls, text: str, lines: list) -> Optional[str]:
        """Extract machine name from text - case insensitive."""
        text_lower = text.lower()
        
        for line in lines:
            line_lower = line.lower()
            if any(kw.lower() in line_lower for kw in cls.MACHINE_KEYWORDS):
                # Common machine patterns
                machine_patterns = [
                    r'cnc', r'lathe', r'milling', r'drilling', r'grinding',
                    r'boring', r'3\s*axis', r'4\s*axis', r'5\s*axis',
                    r'vmc', r'hmc', r'turning'
                ]
                for pattern in machine_patterns:
                    match = re.search(pattern, line_lower, re.IGNORECASE)
                    if match:
                        # Extract the word containing the pattern and nearby words
                        words = line.split()
                        for i, word in enumerate(words):
                            if re.search(pattern, word, re.IGNORECASE):
                                # Return this word and possibly next word
                                if i + 1 < len(words):
                                    return f"{word} {words[i+1]}".strip()
                                return word
        return None
    
    @classmethod
    def _extract_numeric_value(cls, text: str, lines: list, keywords: list) -> Optional[float]:
        """Extract a numeric value based on keywords - case insensitive."""
        for i, line in enumerate(lines):
            line_lower = line.lower()
            if any(kw.lower() in line_lower for kw in keywords):
                # Look for number patterns in this line and next line
                search_text = line
                if i + 1 < len(lines):
                    search_text += " " + lines[i + 1]
                
                # Find numbers (including decimals)
                numbers = re.findall(r'\d+\.?\d*', search_text)
                if numbers:
                    try:
                        return float(numbers[0])
                    except ValueError:
                        continue
        return None


def extract_from_uploaded_file(file_path: str) -> dict:
    """Main function to extract operation details from uploaded file."""
    try:
        text = FileExtractionService.extract_text_from_file(file_path)
        print(f"\n{'='*60}")
        print(f"EXTRACTED TEXT (first 1000 chars):")
        print(f"{'='*60}")
        print(text[:1000] if text else "NO TEXT EXTRACTED")
        print(f"\n{'='*60}")
        print(f"Total text length: {len(text)} characters")
        print(f"{'='*60}\n")
        
        details = FileExtractionService.extract_operation_details(text)
        print(f"EXTRACTED DETAILS: {details}")
        
        return {
            'success': True,
            'text': text[:2000] if len(text) > 2000 else text,
            'text_length': len(text),
            'extracted_data': details
        }
    except Exception as e:
        import traceback
        print(f"EXTRACTION ERROR: {e}")
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e),
            'extracted_data': {}
        }
