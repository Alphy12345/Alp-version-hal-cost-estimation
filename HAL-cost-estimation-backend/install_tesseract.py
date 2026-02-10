"""
Tesseract OCR Auto-Downloader
Downloads and runs the Tesseract installer automatically
"""
import os
import sys
import urllib.request
import subprocess
from pathlib import Path

# Tesseract download URL (Windows 64-bit installer) - Updated to latest
TESSERACT_URL = "https://github.com/UB-Mannheim/tesseract/releases/download/v5.4.0.20240606/tesseract-ocr-w64-setup-5.4.0.20240606.exe"

# Local download path
DOWNLOAD_DIR = Path(os.environ.get('TEMP', os.getcwd()))
INSTALLER_PATH = DOWNLOAD_DIR / "tesseract_installer.exe"

def download_tesseract():
    """Download Tesseract installer"""
    print(f"Downloading Tesseract from {TESSERACT_URL}...")
    print(f"This may take 2-3 minutes depending on your connection...")
    
    def report_progress(block_num, block_size, total_size):
        downloaded = block_num * block_size
        percent = min(100, int(downloaded * 100 / total_size))
        print(f"\rProgress: {percent}% ({downloaded // 1024 // 1024} MB / {total_size // 1024 // 1024} MB)", end='')
    
    try:
        urllib.request.urlretrieve(TESSERACT_URL, INSTALLER_PATH, reporthook=report_progress)
        print(f"\n\nDownloaded to: {INSTALLER_PATH}")
        return True
    except Exception as e:
        print(f"\nDownload failed: {e}")
        return False

def install_tesseract():
    """Run the Tesseract installer with admin elevation"""
    print("\n" + "="*60)
    print("IMPORTANT: The Tesseract installer will now open.")
    print("Please follow these steps:")
    print("1. Click 'Yes' when Windows asks for admin permission")
    print("2. In the installer, click 'Next' to proceed")
    print("3. IMPORTANT: Check 'Add to PATH' checkbox!")
    print("4. Click 'Install' and wait for completion")
    print("5. Click 'Finish' when done")
    print("="*60 + "\n")
    
    input("Press Enter to start the installer...")
    
    try:
        # Use PowerShell to start with admin elevation
        ps_command = f'Start-Process "{INSTALLER_PATH}" -Verb runAs -Wait'
        subprocess.run(['powershell', '-Command', ps_command], check=True)
        print("\n✓ Installer completed!")
        return True
    except subprocess.CalledProcessError:
        print("\nInstallation was cancelled or failed.")
        return False
    except Exception as e:
        print(f"\nInstallation error: {e}")
        # Fallback: try direct execution
        try:
            subprocess.run([str(INSTALLER_PATH)], check=True)
            return True
        except:
            return False

def verify_installation():
    """Check if Tesseract is installed"""
    try:
        result = subprocess.run(['tesseract', '--version'], 
                              capture_output=True, 
                              text=True,
                              shell=True)
        if result.returncode == 0:
            print("\n✓ Tesseract verified successfully!")
            print(result.stdout[:200])
            return True
    except:
        pass
    return False

def main():
    print("="*60)
    print("Tesseract OCR Auto-Downloader & Installer")
    print("="*60)
    
    # Check if already installed
    if verify_installation():
        print("Tesseract is already installed!")
        return
    
    # Download
    if not download_tesseract():
        print("\nFailed to download. Please download manually from:")
        print(TESSERACT_URL)
        return
    
    # Install
    if install_tesseract():
        print("\n" + "="*60)
        print("Installation complete!")
        print("="*60)
        print("\nPlease RESTART your backend server now:")
        print("  1. Stop current server (Ctrl+C)")
        print("  2. Run: python -m uvicorn backend.main:app --reload --port 8000")
        print("\nThen try uploading a PDF or image file!")
    else:
        print("\nInstallation may have failed or was cancelled.")
        print("Please install manually from:", TESSERACT_URL)

if __name__ == "__main__":
    main()
