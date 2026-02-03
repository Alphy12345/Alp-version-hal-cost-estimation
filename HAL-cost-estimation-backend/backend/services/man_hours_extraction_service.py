import io
import re
import zipfile
from typing import Optional, Tuple


class ManHoursExtractionService:
    @staticmethod
    def extract_text(filename: str, content: bytes) -> Tuple[Optional[str], Optional[str]]:
        name = (filename or "").lower()

        if name.endswith(".txt") or name.endswith(".csv") or name.endswith(".log"):
            try:
                return content.decode("utf-8", errors="ignore"), None
            except Exception as e:
                return None, str(e)

        if name.endswith(".docx"):
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as z:
                    xml = z.read("word/document.xml")
                text = re.sub(r"<[^>]+>", " ", xml.decode("utf-8", errors="ignore"))
                text = re.sub(r"\s+", " ", text).strip()
                return text, None
            except Exception as e:
                return None, str(e)

        if name.endswith(".pdf"):
            try:
                import PyPDF2  # type: ignore

                reader = PyPDF2.PdfReader(io.BytesIO(content))
                parts = []
                for page in reader.pages:
                    try:
                        parts.append(page.extract_text() or "")
                    except Exception:
                        parts.append("")
                return "\n".join(parts), None
            except Exception:
                return None, "PDF text extraction not available"

        return None, "Unsupported file type"

    @staticmethod
    def extract_man_hours(text: str) -> Tuple[Optional[float], Optional[str]]:
        if not text:
            return None, "Empty text"

        normalized = re.sub(r"\s+", " ", text)
        patterns = [
            r"man\s*hours?\s*/?\s*unit\s*[:=]\s*(\d+(?:\.\d+)?)",
            r"man\s*hours?\s*per\s*unit\s*[:=]\s*(\d+(?:\.\d+)?)",
            r"man\s*hours?\s*[:=]\s*(\d+(?:\.\d+)?)",
        ]

        for pat in patterns:
            m = re.search(pat, normalized, flags=re.IGNORECASE)
            if m:
                try:
                    return float(m.group(1)), m.group(0)
                except Exception:
                    continue

        return None, "Man hours value not found"
