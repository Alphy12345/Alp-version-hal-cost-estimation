# Quick setup instructions for Tesseract OCR

## Windows Installation

1. Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
   - Choose the latest stable release (e.g., tesseract-ocr-w64-setup-5.3.0.20221222.exe)

2. Run the installer
   - Select "Add to PATH" during installation (important!)
   - Default install location: C:\Program Files\Tesseract-OCR

3. Verify installation
   Open Command Prompt and type: tesseract --version

4. Restart your FastAPI backend server

## Alternative: Use Text Files for Testing

Create a .txt file with content like:

```
Operation: milling
Material: steel
Machine: CNC
Man Hours: 2.5
Duty: heavy
Setup Time: 30
Cycle Time: 45
Diameter: 50
Length: 100
```

Upload this file - it will work without Tesseract!
