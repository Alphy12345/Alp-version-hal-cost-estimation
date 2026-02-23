backend running code - python -m uvicorn backend.main:app --reload --port 8000

minio code - minio.exe server data 


terseract ocr 

How it works:
Upload a file (PDF, image, etc.) using the Import button
Backend extracts text using OCR (Optical Character Recognition)
Parses the text to find:
Operation type (turning, milling, drilling, etc.)
Material (steel, aluminium, titanium)
Machine name
Man hours per unit
Duty category (light/medium/heavy)
Machine setup time
Cycle time
Dimensions (diameter, length, breadth, height)
Shape (round/rectangular)
Autofills all form fields with the extracted data
Technical implementation:
Backend: file_extraction.py service using pytesseract for OCR
API Endpoint: /files/import/file returns extracted data
Frontend: Processes response and calls onChangeForm for each extracted field


just run the install tesseract.py its harcoded so just install that file using python install_tesseract.py and it will install and run that. Its used to extract words from the pdf 


after that run the install poppler.py its harcoded so just install that file using python install_poppler.py and it will install and run that 


what poppler  does is that it converts pdf to images its used for pdf processing so install this also then restart the backend and it should run hopefully 