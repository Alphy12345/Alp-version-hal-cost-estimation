"""
Poppler Auto-Downloader for PDF processing
Downloads and extracts Poppler automatically
"""
import os
import sys
import urllib.request
import zipfile
import subprocess
from pathlib import Path

# Poppler download URL (Windows 64-bit)
POPPLER_URL = "https://github.com/oschwartz10612/poppler-windows/releases/download/v24.08.0-0/Release-24.08.0-0.zip"

# Install location
INSTALL_DIR = Path(r"C:\poppler")
DOWNLOAD_PATH = Path(os.environ.get('TEMP', os.getcwd())) / "poppler.zip"

def download_poppler():
    """Download Poppler zip"""
    print(f"Downloading Poppler from {POPPLER_URL}...")
    print(f"This may take 3-5 minutes (about 50MB)...")
    
    def report_progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        percent = min(100, int(downloaded * 100 / total_size)) if total_size > 0 else 0
        print(f"\rProgress: {percent}% ({downloaded // 1024 // 1024} MB / {total_size // 1024 // 1024} MB)", end='')
    
    try:
        urllib.request.urlretrieve(POPPLER_URL, DOWNLOAD_PATH, reporthook=report_progress)
        print(f"\n\nDownloaded to: {DOWNLOAD_PATH}")
        print(f"File size: {DOWNLOAD_PATH.stat().st_size / 1024 / 1024:.1f} MB")
        return True
    except Exception as e:
        print(f"\nDownload failed: {e}")
        return False

def extract_poppler():
    """Extract Poppler to C:\poppler"""
    print(f"\nExtracting to {INSTALL_DIR}...")
    
    try:
        # Create directory
        INSTALL_DIR.mkdir(parents=True, exist_ok=True)
        
        # Extract
        with zipfile.ZipFile(DOWNLOAD_PATH, 'r') as zip_ref:
            zip_ref.extractall(INSTALL_DIR)
        
        print(f"✓ Extracted to: {INSTALL_DIR}")
        
        # Find the bin directory
        possible_bin_paths = [
            INSTALL_DIR / "Library" / "bin",
            INSTALL_DIR / "bin",
        ]
        
        for bin_path in possible_bin_paths:
            if bin_path.exists():
                print(f"✓ Found bin directory: {bin_path}")
                return str(bin_path)
        
        # If not found, list contents
        print("\nContents of install directory:")
        for item in INSTALL_DIR.rglob("*"):
            if item.is_dir() and "bin" in item.name.lower():
                print(f"  - {item}")
        
        return None
    except Exception as e:
        print(f"Extraction failed: {e}")
        import traceback
        traceback.print_exc()
        return None

def add_to_path(bin_path: str):
    """Add Poppler bin to system PATH"""
    print(f"\n{'='*60}")
    print("IMPORTANT: Add Poppler to your system PATH")
    print(f"{'='*60}")
    print(f"Run this command as Administrator:")
    print(f"\n  setx PATH \"%PATH%;{bin_path}\" /M\n")
    print("Or manually add this to your PATH:")
    print(f"  {bin_path}")
    print(f"{'='*60}\n")
    
    input("Press Enter after you've added it to PATH (or to skip)...")

def main():
    print("="*60)
    print("Poppler Auto-Downloader (Required for PDF OCR)")
    print("="*60)
    
    # Check if already installed
    if INSTALL_DIR.exists():
        print(f"Poppler directory already exists at {INSTALL_DIR}")
        bin_path = INSTALL_DIR / "Library" / "bin"
        if bin_path.exists():
            print(f"Found bin at: {bin_path}")
            print(f"\nAdd this to your PATH: {bin_path}")
            add_to_path(str(bin_path))
            return
    
    # Download
    if not download_poppler():
        print("\nFailed to download. Please download manually from:")
        print(POPPLER_URL)
        print("Extract to C:\\poppler and add C:\\poppler\\Library\\bin to PATH")
        return
    
    # Extract
    bin_path = extract_poppler()
    if not bin_path:
        print("\nExtraction may have failed. Check C:\\poppler")
        return
    
    # Add to PATH
    add_to_path(bin_path)
    
    print("\n" + "="*60)
    print("Setup complete!")
    print("="*60)
    print("\nNext steps:")
    print("1. Open a NEW terminal window (to load updated PATH)")
    print("2. Restart the backend server:")
    print("   python -m uvicorn backend.main:app --reload --port 8000")
    print("\nThen PDF extraction will work!")

if __name__ == "__main__":
    main()
