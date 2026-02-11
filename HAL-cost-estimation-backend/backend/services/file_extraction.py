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
                           'heat treatment', 'surface treatment', 'jig boring', 'rubber press', 'jig']
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
        # Also support lines like "Operation 15 Milling" or "15. Milling"
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
            else:
                # Check for "Operation X OperationType" pattern (e.g., "Operation 15 Milling")
                # or "X. OperationType" pattern (e.g., "15. Milling")
                op_prefix_pattern = rf'^\s*(?:operation|op)?\s*\d+[\.:\)\-]?\s*(\w+)'
                match = re.search(op_prefix_pattern, line_lower)
                if match:
                    potential_op = match.group(1).lower()
                    # Check if the word after the number is a valid operation
                    for valid_op in valid_operations:
                        if valid_op in potential_op or potential_op in valid_op:
                            table_rows.append({'line': line, 'index': i, 'operation': valid_op})
                            print(f"Found table row {len(table_rows)} (with prefix): {line[:60]}...")
                            break
        
        print(f"\n--- Found {len(table_rows)} potential table rows ---")
        
        # Sort table rows by their original line index to ensure PDF order is maintained
        table_rows.sort(key=lambda x: x['index'])
        print("Table rows sorted by line index (PDF order):")
        for i, row in enumerate(table_rows):
            print(f"  {i+1}. Line {row['index']}: {row['operation']}")
        
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
                
                # Normalize operation type to use frontend-compatible values
                if details['operation_type']:
                    op_type = details['operation_type'].lower().strip()
                    # Map to frontend-supported operation types
                    if 'jig' in op_type or op_type in ['jig', 'jig boring']:
                        op_type = 'boring'  # Frontend expects 'boring', not 'jig_boring'
                    elif 'rubber' in op_type or op_type in ['rubber', 'rubber press']:
                        op_type = 'rubber_press'
                    elif ' ' in op_type:
                        op_type = op_type.replace(' ', '_')
                    details['operation_type'] = op_type
                
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
            shapes = ['round', 'rectangular', 'square', 'cube', 'cylindrical']
            for shape in shapes:
                if shape in main_lower:
                    details['shape'] = shape
                    break
            
            # Extract machine name directly from the line
            # Look for common machine patterns in the line (case insensitive)
            # Also capture descriptive text in parentheses for rubber press machines
            machine_patterns = [
                (r'(?:drilling|milling|grinding|turning|boring)\s+machine', None),
                (r'\b(?:3|4|5)\s*axis\s+cnc\b', None),  # Check 3/4/5 axis CNC FIRST
                (r'cnc\s+(?:lathe|milling|machine)?', None),  # Then CNC with suffix
                (r'cnc\b', 'CNC'),  # Standalone CNC LAST
                (r'rubber\s+press(?:\s*[-:]?\s*(?:small|medium|large|sml|med|lge))?(?:\s*\([^)]*\))?', None),
                (r'\bspm\b', 'SPM'),
                (r'jig\s+boring', 'Jig boring'),
                (r'conventional', 'Conventional'),
                (r'turning\s+cnc', 'Turning CNC'),
                (r'turning', None),
                # Rubber press size variations - check these early
                (r'small\s*\(?\s*less\s+than\s*650', 'Small (less than 650 MMX 650 MM)'),
                (r'medium\s*\(?\s*more\s+than\s*650', 'Medium (more than 650 MMX 650 MM)'),
                (r'small\s*\([^)]*650[^)]*\)', 'Small (less than 650 MMX 650 MM)'),
                (r'medium\s*\([^)]*650[^)]*\)', 'Medium (more than 650 MMX 650 MM)'),
                (r'large\s*\([^)]*\)', 'Large'),
                (r'small', 'Small (less than 650 MMX 650 MM)'),  # Fallback: just "Small"
                (r'medium', 'Medium (more than 650 MMX 650 MM)'),  # Fallback: just "Medium"
                (r'large', 'Large'),  # Fallback: just "Large"
                (r'special\s+purpose\s*machine(?:\s*\([^)]*\))?','Special Purpose Machine(SPM)'),
            ]
            for pattern, default_name in machine_patterns:
                match = re.search(pattern, main_lower, re.IGNORECASE)
                if match:
                    # Get the actual matched text with original casing
                    matched_text = main_line[match.start():match.end()]
                    # Normalize casing
                    if default_name:
                        details['machine'] = default_name
                    else:
                        # Capitalize first letter of each word
                        details['machine'] = matched_text.strip().title()
                    print(f"  Found machine: {details['machine']}")
                    break
            
            # Extract all numeric values from the line
            # First, remove common prefixes that contain operation numbers
            # Pattern: "Operation 12" or "Op 12" at the start
            cleaned_line = re.sub(r'^\s*(?:operation|op)\s*\d+\s*', ' ', main_line, flags=re.IGNORECASE)
            numbers = re.findall(r'\b(\d+(?:\.\d+)?)\b', cleaned_line)
            numbers = [float(n) for n in numbers]
            print(f"  Found numbers (after cleaning): {numbers}")
            
            # Map numbers to fields based on position and context
            # Table order typically: [Setup(min), Cycle(sec), Hours, Diameter, Length, Breadth, Height]
            # OR for rectangular parts (milling): [Setup, Cycle, Hours, -, Length, Breadth, Height]
            # OR for round parts: [Setup, Cycle, Hours, Diameter, Length, -, -]
            
            # Based on typical table structure, try to identify each value by position
            # Column indices: 0=Setup, 1=Cycle, 2=Hours, 3=Diameter/Dash, 4=Length, 5=Breadth/Dash, 6=Height/Dash
            if len(numbers) >= 7:
                # Full 7-column table: Setup, Cycle, Hours, Diameter, Length, Breadth, Height
                details['machine_setup_time'] = numbers[0]  # Usually 15-60
                details['cycle_time'] = numbers[1]  # 60-650 (seconds)
                details['man_hours'] = numbers[2]  # Large: 1200-4200
                # Index 3 could be diameter or dash (represented as 0 or just skipped)
                if numbers[3] > 0:
                    details['diameter'] = numbers[3]
                details['length'] = numbers[4]
                if numbers[5] > 0:
                    details['breadth'] = numbers[5]
                if numbers[6] > 0:
                    details['height'] = numbers[6]
            elif len(numbers) >= 6:
                # 6-column table (common for milling): Setup, Cycle, Hours, Length, Breadth, Height
                # EXTRACT ALL VALUES regardless of shape
                details['machine_setup_time'] = numbers[0]
                details['cycle_time'] = numbers[1]
                details['man_hours'] = numbers[2]
                details['length'] = numbers[3]
                details['breadth'] = numbers[4]
                details['height'] = numbers[5]
                print(f"  6-column table detected: Setup={numbers[0]}, Cycle={numbers[1]}, Hours={numbers[2]}, Length={numbers[3]}, Breadth={numbers[4]}, Height={numbers[5]}")
            elif len(numbers) >= 5:
                # Standard 5-column table: Setup, Cycle, Hours, Diameter, Length
                # OR for rectangular: Setup, Cycle, Hours, Length, Breadth (no height)
                # EXTRACT ALL VALUES regardless of shape - shape is just metadata
                details['machine_setup_time'] = numbers[0]
                details['cycle_time'] = numbers[1]
                details['man_hours'] = numbers[2]
                # For 5-column tables, indices 3 and 4 could be:
                # - Round parts: Diameter (3), Length (4)
                # - Rectangular parts: Length (3), Breadth (4) 
                # - Milling with L,B,H: might be Length (3), Breadth (4), Height missing
                # Store ALL values and let the frontend decide based on operation type
                details['diameter'] = numbers[3]  # Could also be Length for rectangular
                details['length'] = numbers[4]    # Could also be Breadth for rectangular
                # If we detect this might be milling (from operation name), also set breadth
                if detected_operation and ('mill' in detected_operation.lower() or 'surface' in detected_operation.lower() or 'grinding' in detected_operation.lower()):
                    details['length'] = numbers[3]   # Position 3 is length for rectangular
                    details['breadth'] = numbers[4]  # Position 4 is breadth for rectangular
                    # If there's a 5th number, it might be height
                    if len(numbers) >= 6:
                        details['height'] = numbers[5]
            elif len(numbers) >= 4:
                # 4 columns - could be without one field
                # Try to identify based on value ranges
                for num in numbers:
                    if num > 1000 and details['man_hours'] is None:
                        details['man_hours'] = num
                    elif 50 < num < 1000 and details['cycle_time'] is None:
                        # Could be cycle time (50-650) or setup time (25-60)
                        if num < 80 and details['machine_setup_time'] is None:
                            details['machine_setup_time'] = num
                        else:
                            details['cycle_time'] = num
                    elif num > 10 and details['diameter'] is None:
                        details['diameter'] = num
                    elif details['length'] is None:
                        details['length'] = num
            else:
                # Less than 4 numbers - use range-based logic
                for num in numbers:
                    if num > 1000:  # Work hours
                        if details['man_hours'] is None:
                            details['man_hours'] = num
                    elif 100 < num <= 1000:  # Cycle time or length
                        if details['cycle_time'] is None:
                            details['cycle_time'] = num
                        elif details['length'] is None:
                            details['length'] = num
                    elif 20 <= num <= 100:  # Setup time or diameter
                        if details['machine_setup_time'] is None:
                            details['machine_setup_time'] = num
                        elif details['diameter'] is None:
                            details['diameter'] = num
                        elif details['length'] is None:
                            details['length'] = num
                    elif num > 0:  # Small numbers
                        if details['diameter'] is None:
                            details['diameter'] = num
                        elif details['length'] is None:
                            details['length'] = num
        
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
        
        # First try to match rubber press sizes with descriptions (before CNC check)
        rubber_press_patterns = [
            (r'small\s*\(?\s*less\s+than\s*650', 'Small (less than 650 MMX 650 MM)'),
            (r'medium\s*\(?\s*more\s+than\s*650', 'Medium (more than 650 MMX 650 MM)'),
            (r'small\s*\([^)]*650[^)]*mm[^)]*\)', 'Small (less than 650 MMX 650 MM)'),
            (r'medium\s*\([^)]*650[^)]*mm[^)]*\)', 'Medium (more than 650 MMX 650 MM)'),
            (r'large\s*\([^)]*mm[^)]*\)', 'Large'),
            (r'small\b', 'Small (less than 650 MMX 650 MM)'),  # Just "Small"
            (r'medium\b', 'Medium (more than 650 MMX 650 MM)'),  # Just "Medium"
            (r'large\b', 'Large'),  # Just "Large"
        ]
        for pattern, default_name in rubber_press_patterns:
            match = re.search(pattern, text_lower, re.IGNORECASE)
            if match:
                return default_name
        
        # Check for specific CNC patterns FIRST (before standalone CNC)
        multi_axis_match = re.search(r'\b(?:3|4|5)\s*axis\s+cnc\b', text_lower, re.IGNORECASE)
        if multi_axis_match:
            # Extract the full pattern like "3 axis CNC"
            return multi_axis_match.group(0).title()
        
        # Check for standalone CNC (but not part of other words) - AFTER multi-axis check
        if re.search(r'\bcnc\b', text_lower):
            # Make sure it's not already part of a longer machine name we extracted
            return 'CNC'
        
        for line in lines:
            line_lower = line.lower()
            if any(kw.lower() in line_lower for kw in cls.MACHINE_KEYWORDS):
                # Common machine patterns - expanded
                machine_patterns = [
                    r'\b(?:3|4|5)\s*axis\s+cnc\b',  # Check 3/4/5 axis CNC FIRST
                    r'cnc\s+(?:lathe|milling|machine)',  # CNC with suffix
                    r'lathe', r'milling', r'drilling', r'grinding',
                    r'jig\s*boring', r'vmc', r'hmc', r'turning\s+cnc', r'turning',
                    r'rubber\s*press', r'spm',
                    r'conventional'
                ]
                for pattern in machine_patterns:
                    match = re.search(pattern, line_lower, re.IGNORECASE)
                    if match:
                        # Get the matched text and expand to capture full machine name
                        words = line.split()
                        matched_word_idx = None
                        for wi, word in enumerate(words):
                            if re.search(pattern, word, re.IGNORECASE):
                                matched_word_idx = wi
                                break
                        
                        if matched_word_idx is not None:
                            # Get up to 2 words before and 3 words after for longer names
                            start_idx = max(0, matched_word_idx - 2)
                            end_idx = min(len(words), matched_word_idx + 4)
                            machine_name = ' '.join(words[start_idx:end_idx]).strip()
                            return machine_name
                        
                        # Fallback: return matched text
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
