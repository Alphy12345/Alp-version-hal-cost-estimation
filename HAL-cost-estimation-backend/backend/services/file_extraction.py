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
                page_lines = text.split('\n')
                non_empty = [l for l in page_lines if l.strip()]
                print(f"Page {i+1}: {len(page_lines)} lines, {len(non_empty)} non-empty")
                # Print first 20 non-empty lines of each page for debugging
                for j, line in enumerate(non_empty[:20]):
                    print(f"  Page{i+1} Line{j}: {line[:100]}")
        except Exception as e:
            print(f"PDF extraction error: {e}")
            import traceback
            traceback.print_exc()
        
        full_text = "\n".join(text_parts)
        print(f"\nTotal extracted text: {len(full_text)} chars, {len(full_text.split(chr(10)))} lines")
        return full_text
    
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
        
        # List of valid operation types to detect in tables - EXPANDED
        valid_operations = ['turning', 'milling', 'drilling', 'grinding', 'boring', 'welding', 
                           'heat treatment', 'surface treatment', 'jig boring', 'rubber press', 
                           'jig', 'heat', 'surface']
        valid_materials = ['steel', 'aluminium', 'aluminum', 'titanium', 'brass', 'copper']
        valid_duties = ['light duty', 'medium duty', 'heavy duty', 'light', 'medium', 'heavy']
        valid_shapes = ['round', 'rectangular', 'square', 'cylindrical']
        
        print(f"\n--- Parsing {len(lines)} lines for table data ---")
        
        print(f"\n--- ALL LINES (total: {len(lines)}) ---")
        for i, line in enumerate(lines):
            stripped = line.strip()
            if stripped and len(stripped) > 3:  # Only print non-empty, meaningful lines
                print(f"  Line {i}: {repr(stripped[:150])}")
        
        # Table detection: Look for lines that start with an operation name
        # Pattern: lines containing operation type followed by material, machine, etc.
        # Also support lines like "Operation 15 Milling" or "15. Milling"
        table_rows = []
        skip_lines = set()  # Track lines to skip (merged multi-line operations)
        for i, line in enumerate(lines):
            if i in skip_lines:
                continue
            
            line_lower = line.lower().strip()
            if not line_lower:
                continue
            
            # Special case: detect "rubber" on one line followed by "press" on the next
            # (handles multi-line table entries like "Rubber Small" on line N, "press Steel..." on line N+1)
            if line_lower.startswith('rubber'):
                # Look ahead to see if next line starts with 'press'
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip().lower()
                    if next_line.startswith('press'):
                        combined = line + ' ' + lines[i + 1].strip()
                        table_rows.append({'line': combined, 'index': i, 'operation': 'rubber press'})
                        print(f"FOUND split rubber press at lines {i}-{i+1}: {combined[:80]}...")
                        skip_lines.add(i + 1)  # Skip the press line
                        continue
            
            # Check if line starts with an operation type (for table rows) - case insensitive
            matched_op = None
            for op in valid_operations:
                # Match at start of line (already lowercase)
                op_pattern = rf'^\s*{re.escape(op)}\b'
                if re.search(op_pattern, line_lower):
                    matched_op = op
                    break
                # Also try matching without word boundary for multi-word operations
                if ' ' in op:
                    simple_pattern = rf'^\s*{re.escape(op)}'
                    if re.search(simple_pattern, line_lower):
                        matched_op = op
                        break
            
            if matched_op:
                table_rows.append({'line': line, 'index': i, 'operation': matched_op})
                print(f"FOUND ROW {len(table_rows)} at line {i}: {matched_op} -> {line[:80]}...")
            else:
                # Check for "Operation X OperationType" pattern (e.g., "Operation 15 Milling")
                # or "X. OperationType" pattern (e.g., "15. Milling")
                op_prefix_patterns = [
                    rf'^\s*(?:operation|op)?\s*\d+[\.:\)\-]?\s*(turning|milling|drilling|grinding|boring|welding|heat|surface|jig|rubber)',
                    rf'^\s*\d+\.\s*(turning|milling|drilling|grinding|boring|welding|heat|surface|jig|rubber)',
                    rf'^\s*\d+\s+(turning|milling|drilling|grinding|boring|welding|heat|surface|jig|rubber)',
                ]
                for pattern in op_prefix_patterns:
                    match = re.search(pattern, line_lower)
                    if match:
                        potential_op = match.group(1).lower() if match.groups() else None
                        if not potential_op:
                            continue
                        # Check if the word after the number is a valid operation
                        for valid_op in valid_operations:
                            if valid_op in potential_op or potential_op in valid_op:
                                table_rows.append({'line': line, 'index': i, 'operation': valid_op})
                                print(f"FOUND ROW {len(table_rows)} (with prefix) at line {i}: {valid_op} -> {line[:80]}...")
                                break
                        else:
                            continue
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
        
            # If no table rows found via line-matching, try to find operations that span multiple lines
            # by looking for operation keywords followed by continuation lines
            if not table_rows:
                print("\n--- Trying multi-line operation detection ---")
                i = 0
                while i < len(lines):
                    line = lines[i].strip()
                    line_lower = line.lower()
                    if not line_lower:
                        i += 1
                        continue
                    
                    # Check if this line starts with an operation
                    for op in valid_operations:
                        if re.search(rf'^\s*{re.escape(op)}\b', line_lower):
                            # Found an operation start - look ahead for continuation
                            combined = line
                            j = i + 1
                            while j < len(lines) and j < i + 3:  # Check next 2 lines
                                next_line = lines[j].strip()
                                next_lower = next_line.lower()
                                # If next line starts with a continuation word, merge it
                                if next_lower.startswith('press') or next_lower.startswith('treatment'):
                                    combined += ' ' + next_line
                                    print(f"  Merged continuation at line {j}: {next_line[:60]}")
                                    j += 1
                                else:
                                    break
                            table_rows.append({'line': combined, 'index': i, 'operation': op})
                            print(f"FOUND multi-line operation at {i}: {op}")
                            i = j  # Skip the merged lines
                            break
                    else:
                        i += 1
        
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
            
            # Extract duty category - improved detection with debug
            print(f"  Looking for duty in: {main_lower[:100]}...")
            duties = [
                ('heavy duty', 'heavy'), 
                ('medium duty', 'medium'), 
                ('light duty', 'light'),
                ('heavy', 'heavy'),  # Also check standalone
                ('medium', 'medium'),
                ('light', 'light')
            ]
            duty_found = False
            for duty_full, duty_short in duties:
                if duty_full in main_lower:
                    details['duty_category'] = duty_short
                    print(f"  ✓ Found duty: {duty_short} (matched '{duty_full}')")
                    duty_found = True
                    break
            
            if not duty_found:
                print(f"  ✗ No duty found in line - checking nearby lines...")
                # Look for duty in the full section text (multiple lines)
                full_lower = text_lower
                for duty_full, duty_short in duties:
                    if duty_full in full_lower:
                        details['duty_category'] = duty_short
                        print(f"  ✓ Found duty in section: {duty_short} (matched '{duty_full}')")
                        duty_found = True
                        break
            
            # Extract shape
            shapes = ['round', 'rectangular', 'square', 'cube', 'cylindrical']
            for shape in shapes:
                if shape in main_lower:
                    details['shape'] = shape
                    break
            
            # Extract machine name directly from the line
            # Common machine patterns - expanded
            # PRIORITY ORDER: Specific machines first, then generic patterns
            machine_patterns = [
                # CNC patterns FIRST (before standalone CNC)
                (r'\b(?:3|4|5)\s*axis\s+cnc\b', None),
                (r'turning\s+cnc', 'Turning CNC'),
                (r'cnc\s+(?:lathe|milling|machine)?', None),
                (r'cnc\b', 'CNC'),
                # Rubber press sizes - check these BEFORE generic rubber press
                (r'small\s*\(?\s*less\s+than\s*650', 'Small (less than 650 MMX 650 MM)'),
                (r'medium\s*\(?\s*more\s+than\s*650', 'Medium (more than 650 MMX 650 MM)'),
                (r'small\s*\([^)]*650[^)]*\)', 'Small (less than 650 MMX 650 MM)'),
                (r'medium\s*\([^)]*650[^)]*\)', 'Medium (more than 650 MMX 650 MM)'),
                (r'large\s*\([^)]*\)', 'Large'),
                (r'she[l1]\b', 'Small (less than 650 MMX 650 MM)'),  # OCR error: Shel -> Small
                (r'med[i1]um\b', 'Medium (more than 650 MMX 650 MM)'),  # OCR error: med1um -> Medium
                (r'small\b', 'Small (less than 650 MMX 650 MM)'),
                (r'medium\b', 'Medium (more than 650 MMX 650 MM)'),
                (r'large\b', 'Large'),
                # Generic rubber press (only if size not found)
                (r'rubber\s*press', 'Rubber Press'),
                # Other machines
                (r'(?:drilling|milling|grinding|turning|boring)\s+machine', None),
                (r'\bspm\b', 'SPM'),
                (r'jig\s+boring', 'Jig boring'),
                (r'conventional', 'Conventional'),
                (r'turning', None),
                (r'lathe', None),
                (r'drilling', None),
                (r'grinding', None),
                (r'milling', None),
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
            # Remove machine size descriptors that contain numbers (like "650 MMX")
            cleaned_line = re.sub(r'\d+\s*mmx?\s*\d*\s*mm\)?', ' ', cleaned_line, flags=re.IGNORECASE)
            cleaned_line = re.sub(r'less\s+than\s+\d+', ' ', cleaned_line, flags=re.IGNORECASE)
            cleaned_line = re.sub(r'more\s+than\s+\d+', ' ', cleaned_line, flags=re.IGNORECASE)
            # Remove standalone numbers that are likely part of machine descriptions (650, 650MM, etc)
            cleaned_line = re.sub(r'\b65[0-9]\b', ' ', cleaned_line, flags=re.IGNORECASE)
            numbers = re.findall(r'\b(\d+(?:\.\d+)?)\b', cleaned_line)
            numbers = [float(n) for n in numbers]
            print(f"  Found numbers (after cleaning): {numbers}")
            
            # Special handling for rubber press operations
            is_rubber_press = detected_operation and 'rubber' in detected_operation.lower()
            if is_rubber_press:
                # Extract machine name for rubber press
                if details['machine'] is None:
                    details['machine'] = cls._extract_machine(text, lines)
                    print(f"  Extracted rubber press machine: {details['machine']}")
                
                print(f"  Rubber press detected - processing {len(numbers)} numbers")
                # Rubber press format: Setup, Cycle, Hours, Diameter, Length, Breadth, Height
                # or: Setup, Cycle, Hours, Length, Breadth, Height (no diameter)
                if len(numbers) >= 7:
                    details['machine_setup_time'] = numbers[0]
                    details['cycle_time'] = numbers[1]
                    details['man_hours'] = numbers[2]
                    details['diameter'] = numbers[3]
                    details['length'] = numbers[4]
                    details['breadth'] = numbers[5] if numbers[5] > 0 else None
                    details['height'] = numbers[6] if numbers[6] > 0 else None
                    print(f"  Rubber press 7-col: Setup={numbers[0]}, Cycle={numbers[1]}, Hours={numbers[2]}, Dia={numbers[3]}, Len={numbers[4]}, Breadth={numbers[5]}, Height={numbers[6]}")
                elif len(numbers) >= 6:
                    details['machine_setup_time'] = numbers[0]
                    details['cycle_time'] = numbers[1]
                    details['man_hours'] = numbers[2]
                    # Check if position 3 looks like diameter (typically <100 for rubber press)
                    if numbers[3] < 200:
                        details['diameter'] = numbers[3]
                        details['length'] = numbers[4]
                        details['breadth'] = numbers[5] if numbers[5] > 0 else None
                    else:
                        details['length'] = numbers[3]
                        details['breadth'] = numbers[4]
                        details['height'] = numbers[5]
                    print(f"  Rubber press 6-col: Setup={numbers[0]}, Cycle={numbers[1]}, Hours={numbers[2]}, Dia={details.get('diameter')}, Len={details['length']}")
                elif len(numbers) >= 5:
                    # For rubber press: Setup, Cycle, Hours, Diameter, Length (no breadth/height for basic rubber press)
                    details['machine_setup_time'] = numbers[0]
                    details['cycle_time'] = numbers[1]
                    details['man_hours'] = numbers[2]
                    details['diameter'] = numbers[3]  # Position 3 is diameter
                    details['length'] = numbers[4]      # Position 4 is length
                    print(f"  Rubber press 5-col: Setup={numbers[0]}, Cycle={numbers[1]}, Hours={numbers[2]}, Dia={numbers[3]}, Len={numbers[4]}")
            else:
                # Standard handling for non-rubber operations
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
                    # 6-column table: Setup, Cycle, Hours, Dim1, Dim2, Dim3
                    # ONLY milling gets length/breadth/height (rectangular)
                    # ALL other operations get diameter/length (round) - shape doesn't matter
                    is_milling = detected_operation and 'mill' in detected_operation.lower()
                    
                    details['machine_setup_time'] = numbers[0]
                    details['cycle_time'] = numbers[1]
                    details['man_hours'] = numbers[2]
                    
                    if is_milling:
                        # Milling rectangular: Length, Breadth, Height
                        details['length'] = numbers[3]
                        details['breadth'] = numbers[4]
                        details['height'] = numbers[5]
                        print(f"  6-column MILLING: Setup={numbers[0]}, Cycle={numbers[1]}, Hours={numbers[2]}, Length={numbers[3]}, Breadth={numbers[4]}, Height={numbers[5]}")
                    else:
                        # ALL other operations: Diameter, Length (round)
                        details['diameter'] = numbers[3]
                        details['length'] = numbers[4]
                        print(f"  6-column NON-MILLING: Setup={numbers[0]}, Cycle={numbers[1]}, Hours={numbers[2]}, Diameter={numbers[3]}, Length={numbers[4]}")
                elif len(numbers) >= 5:
                    # Standard 5-column table: Setup, Cycle, Hours, Diameter, Length
                    # For round parts (most operations except milling): Diameter is at index 3
                    # For rectangular parts: Length is at index 3, Breadth at index 4
                    details['machine_setup_time'] = numbers[0]
                    details['cycle_time'] = numbers[1]
                    details['man_hours'] = numbers[2]
                    # ALWAYS set diameter and length for 5-column tables
                    # Position 3 is always diameter for round parts
                    # Position 4 is always length
                    details['diameter'] = numbers[3]
                    details['length'] = numbers[4]
                    print(f"  5-col ROUND: Setup={numbers[0]}, Cycle={numbers[1]}, Hours={numbers[2]}, Dia={numbers[3]}, Len={numbers[4]}")
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
        
        # First try to match rubber press sizes with descriptions (BEFORE any other checks)
        # Look for the size descriptors that appear in the table - handle OCR errors
        rubber_press_patterns = [
            (r'small\s*\(?\s*less\s+than\s*650', 'Small (less than 650 MMX 650 MM)'),
            (r'medium\s*\(?\s*more\s+than\s*650', 'Medium (more than 650 MMX 650 MM)'),
            (r'small\s*\([^)]*650[^)]*mm[^)]*\)', 'Small (less than 650 MMX 650 MM)'),
            (r'medium\s*\([^)]*650[^)]*mm[^)]*\)', 'Medium (more than 650 MMX 650 MM)'),
            (r'large\s*\([^)]*mm[^)]*\)', 'Large'),
            # Handle OCR errors where 'Small' becomes 'Shel', etc.
            (r'she[l1]\b', 'Small (less than 650 MMX 650 MM)'),
            (r'med[i1]um\b', 'Medium (more than 650 MMX 650 MM)'),
            (r'small\b', 'Small (less than 650 MMX 650 MM)'),  # Just "Small"
            (r'medium\b', 'Medium (more than 650 MMX 650 MM)'),  # Just "Medium"
            (r'large\b', 'Large'),  # Just "Large"
        ]
        
        is_rubber_press = 'rubber' in text_lower
        
        for pattern, default_name in rubber_press_patterns:
            match = re.search(pattern, text_lower, re.IGNORECASE)
            if match:
                # If this is a rubber press line, return the size
                if is_rubber_press:
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
                # For rubber press lines, check for size patterns first
                if 'rubber' in line_lower:
                    for pattern, default_name in rubber_press_patterns:
                        match = re.search(pattern, line_lower, re.IGNORECASE)
                        if match:
                            return default_name
                
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
