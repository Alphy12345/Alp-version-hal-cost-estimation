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
    SETUP_TIME_KEYWORDS = ['setup time', 'machine setup time', 'set up time', 'setup:', 's/t', 'setup', 'setup_time']
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
    def extract_multiple_operations(cls, text: str) -> list:
        """Extract multiple operations from text - detects table rows and operation sections."""
        operations = []
        lines = text.split('\n')
        
        # List of valid operation types to detect in tables
        valid_operations = ['turning', 'milling', 'drilling', 'grinding', 'boring', 'welding', 
                           'heat treatment', 'surface treatment', 'jig boring', 'rubber press']
        valid_materials = ['steel', 'aluminium', 'aluminum', 'titanium', 'brass', 'copper']
        valid_duties = ['light duty', 'medium duty', 'heavy duty', 'light', 'medium', 'heavy']
        valid_shapes = ['round', 'rectangular', 'square', 'cylindrical']
        
        print(f"\n--- Parsing {len(lines)} lines for table data ---")
        
        # Debug: Print lines containing potential operation indicators
        for i, line in enumerate(lines):
            line_lower = line.lower().strip()
            if any(op in line_lower for op in ['jig', 'rubber', 'press', 'boring']):
                print(f"  Line {i}: {repr(line[:80])}")
        
        # Table detection: Look for lines that start with an operation name
        # Pattern: lines containing operation type followed by material, machine, etc.
        table_rows = []
        for i, line in enumerate(lines):
            line_lower = line.lower().strip()
            if not line_lower:
                continue
            
            # Check if line starts with an operation type (for table rows) - case insensitive
            for op in valid_operations:
                # Match at start of line (already lowercase)
                op_pattern = rf'^\s*{re.escape(op)}\b'
                if re.search(op_pattern, line_lower):
                    table_rows.append({'line': line, 'index': i, 'operation': op})
                    print(f"Found table row {len(table_rows)}: {line[:60]}...")
                    break
                # Also try matching without word boundary for multi-word operations
                if ' ' in op:
                    simple_pattern = rf'^\s*{re.escape(op)}'
                    if re.search(simple_pattern, line_lower):
                        table_rows.append({'line': line, 'index': i, 'operation': op})
                        print(f"Found table row {len(table_rows)} (simple): {line[:60]}...")
                        break
        
        print(f"\n--- Found {len(table_rows)} potential table rows ---")
        
        # If we found table rows, extract each as an operation
        if len(table_rows) >= 1:
            for i, row_info in enumerate(table_rows):
                row_text = row_info['line']
                
                # For table rows, the entire data is usually in one line
                # But we might need to look at next line if it's wrapped
                if i + 1 < len(table_rows):
                    next_start = table_rows[i + 1]['index']
                    section_lines = lines[row_info['index']:next_start]
                else:
                    # Last row - take rest of document
                    section_lines = lines[row_info['index']:]
                
                section_text = '\n'.join(section_lines)
                print(f"\n--- Processing table row {i+1}: {row_info['operation']} ---")
                
                # Extract details from this row
                details = cls._extract_operation_from_line(section_text, row_info['operation'])
                
                if any(v is not None for v in details.values()):
                    operations.append(details)
                    print(f"Row {i+1} extracted: {details}")
                else:
                    print(f"Row {i+1}: No valid data")
        
        # If no table rows found, try section-based extraction (Operation 1, Op 2, etc.)
        if not operations:
            print("\n--- No table rows found, trying section-based extraction ---")
            operations = cls._extract_sections(text)
        
        return operations
    
    @classmethod
    def _extract_operation_from_line(cls, text: str, detected_operation: str = None) -> dict:
        """Extract operation details from a table row or line of text."""
        details = {
            'operation_type': detected_operation,
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
        
        # For single line (table row), extract all values from that line
        if len(lines) == 1 or (len(lines) > 0 and all(len(l.strip()) < 100 for l in lines[:2])):
            main_line = lines[0]
            main_lower = main_line.lower()
            
            # Extract material
            materials = ['steel', 'aluminium', 'aluminum', 'titanium', 'brass', 'copper']
            for mat in materials:
                if mat in main_lower:
                    details['material'] = mat if mat != 'aluminum' else 'aluminium'
                    break
            
            # Extract duty category
            duties = [('heavy duty', 'heavy'), ('medium duty', 'medium'), ('light duty', 'light')]
            for duty_full, duty_short in duties:
                if duty_full in main_lower or f' {duty_short} ' in f' {main_lower} ':
                    details['duty_category'] = duty_short
                    break
            
            # Extract shape
            shapes = ['round', 'rectangular', 'square']
            for shape in shapes:
                if shape in main_lower:
                    details['shape'] = shape
                    break
            
            # Extract machine name directly from the line
            # Look for common machine patterns in the line
            machine_patterns = [
                (r'(?:drilling|milling|grinding|turning|boring)\s+machine', 'drilling machine'),
                (r'cnc\s+(?:lathe|milling|machine)?', 'cnc'),
                (r'\b\d+\s*axis\s+cnc\b', None),
                (r'rubber\s+press(?:\s*-\s*(?:small|medium|large))?', None),
                (r'\bspm\b', 'spm'),
                (r'jig\s+boring', 'jig boring'),
                (r'conventional', 'conventional'),
            ]
            for pattern, default_name in machine_patterns:
                match = re.search(pattern, main_lower)
                if match:
                    # Get the actual matched text (with proper case)
                    matched_text = main_line[match.start():match.end()]
                    details['machine'] = matched_text.strip()
                    print(f"  Found machine: {details['machine']}")
                    break
            
            # Extract all numeric values from the line
            numbers = re.findall(r'\b(\d+(?:\.\d+)?)\b', main_line)
            numbers = [float(n) for n in numbers]
            print(f"  Found numbers: {numbers}")
            
            # Map numbers to fields based on position and context
            # Typical table order: Setup Time, Cycle Time, Work Hours, Diameter, Length
            # Or: Diameter, Length, Setup Time, Cycle Time, Work Hours
            
            # Check for keywords to help map numbers
            has_setup = any(kw in main_lower for kw in ['setup', 'set up'])
            has_cycle = any(kw in main_lower for kw in ['cycle'])
            has_hours = any(kw in main_lower for kw in ['work', 'hours', 'man hours'])
            
            # Try to map based on typical ranges
            for num in numbers:
                if num > 1000:  # Likely work hours (man hours)
                    if details['man_hours'] is None:
                        details['man_hours'] = num
                elif num > 100:  # Likely cycle time (seconds) or length (>100mm)
                    if details['cycle_time'] is None:
                        details['cycle_time'] = num
                    elif details['length'] is None and num > 50:
                        details['length'] = num
                elif num > 10:  # Could be setup time, diameter, or smaller length
                    if details['machine_setup_time'] is None:
                        details['machine_setup_time'] = num
                    elif details['diameter'] is None:
                        details['diameter'] = num
                    elif details['length'] is None:
                        details['length'] = num
                    elif details['breadth'] is None:
                        details['breadth'] = num
                else:  # Small numbers - could be any field
                    if details['diameter'] is None and details['shape'] == 'round':
                        details['diameter'] = num
                    elif details['height'] is None:
                        details['height'] = num
        
        # Use the regular extraction as fallback/supplement
        regular = cls.extract_operation_details(text)
        for key in details:
            if details[key] is None and regular.get(key) is not None:
                details[key] = regular[key]
        
        # Ensure operation type is set
        if details['operation_type'] is None:
            details['operation_type'] = regular.get('operation_type')
        
        return details
    
    @classmethod
    def _extract_sections(cls, text: str) -> list:
        """Extract operations based on section boundaries (Operation 1, Op 2, etc.)."""
        operations = []
        
        # Patterns that indicate operation boundaries
        operation_patterns = [
            r'(?:^|\n)\s*(?:operation|op|opn)\s*(\d+)[\s:\.\-]',
            r'(?:^|\n)\s*(\d+)\s*[\.\)\-]\s*(?:operation|op)',
        ]
        
        boundaries = []
        for pattern in operation_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                op_num = match.group(1) if match.groups() else None
                boundaries.append({
                    'start': match.start(),
                    'number': int(op_num) if op_num else None,
                    'matched_text': match.group(0)
                })
        
        boundaries = sorted(boundaries, key=lambda x: x['start'])
        
        # Remove duplicates that are too close
        unique_boundaries = []
        last_start = -100
        for b in boundaries:
            if b['start'] - last_start > 50:
                unique_boundaries.append(b)
                last_start = b['start']
        boundaries = unique_boundaries
        
        print(f"Found {len(boundaries)} section boundaries")
        
        if len(boundaries) <= 1:
            details = cls.extract_operation_details(text)
            if any(v is not None for v in details.values()):
                return [details]
            return []
        
        # Extract each section
        for i, boundary in enumerate(boundaries):
            section_start = boundary['start']
            if i + 1 < len(boundaries):
                section_end = boundaries[i + 1]['start']
            else:
                section_end = len(text)
            
            section_text = text[section_start:section_end]
            details = cls.extract_operation_details(section_text)
            
            if any(v is not None for v in details.values()):
                operations.append(details)
        
        return operations
    
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
                # Common machine patterns - expanded
                machine_patterns = [
                    r'cnc', r'lathe', r'milling', r'drilling', r'grinding',
                    r'boring', r'jig\s*boring', r'3\s*axis', r'4\s*axis', r'5\s*axis',
                    r'vmc', r'hmc', r'turning', r'rubber\s*press', r'spm',
                    r'conventional', r'cnc\s*lathe', r'cnc\s*milling', r'axis\s*cnc'
                ]
                for pattern in machine_patterns:
                    match = re.search(pattern, line_lower, re.IGNORECASE)
                    if match:
                        # Get the matched text and expand to capture full machine name
                        start = match.start()
                        end = match.end()
                        # Expand to include surrounding words (up to 3 words before and after)
                        words = line.split()
                        matched_word_idx = None
                        for wi, word in enumerate(words):
                            if re.search(pattern, word, re.IGNORECASE):
                                matched_word_idx = wi
                                break
                        
                        if matched_word_idx is not None:
                            # Get up to 2 words before and 2 words after
                            start_idx = max(0, matched_word_idx - 2)
                            end_idx = min(len(words), matched_word_idx + 3)
                            machine_name = ' '.join(words[start_idx:end_idx]).strip()
                            return machine_name
                        
                        # Fallback: return matched text with some context
                        return match.group(0)
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
        
        # Extract multiple operations instead of single operation
        operations = FileExtractionService.extract_multiple_operations(text)
        print(f"EXTRACTED {len(operations)} OPERATIONS: {operations}")
        
        # Return array if multiple operations, or single object if only one
        extracted_data = operations if len(operations) > 1 else (operations[0] if operations else {})
        
        return {
            'success': True,
            'text': text[:2000] if len(text) > 2000 else text,
            'text_length': len(text),
            'operation_count': len(operations),
            'extracted_data': extracted_data
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
