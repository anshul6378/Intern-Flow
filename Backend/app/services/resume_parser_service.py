from __future__ import annotations

import os
import re
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile


class ResumeParserService:
    ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
    MAX_UPLOAD_BYTES = 5 * 1024 * 1024

    @staticmethod
    def _storage_dir() -> Path:
        configured = os.getenv("RESUME_UPLOAD_DIR")
        if configured:
            storage = Path(configured)
        else:
            storage = Path(__file__).resolve().parents[2] / "uploads" / "resumes"
        storage.mkdir(parents=True, exist_ok=True)
        return storage

    @staticmethod
    def _safe_filename(filename: str) -> str:
        clean = re.sub(r"[^A-Za-z0-9._-]", "_", filename).strip("._")
        return clean or "resume"

    @staticmethod
    def _extract_text(content: bytes, extension: str) -> str:
        if extension == ".txt":
            return content.decode("utf-8", errors="ignore")

        if extension == ".pdf":
            try:
                from pypdf import PdfReader

                reader = PdfReader(BytesIO(content))
                return "\n".join((page.extract_text() or "") for page in reader.pages)
            except Exception:
                return ""

        if extension == ".docx":
            try:
                from docx import Document

                doc = Document(BytesIO(content))
                return "\n".join(paragraph.text for paragraph in doc.paragraphs)
            except Exception:
                return ""

        return ""

    @staticmethod
    def _parse_with_heuristics(text: str) -> dict:
        normalized = text or ""
        lowered = normalized.lower()

        email_match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", normalized)
        phone_match = re.search(r"(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4}", normalized)
        linkedin_match = re.search(r"(?:https?://)?(?:www\.)?linkedin\.com/in/[A-Za-z0-9_-]+", lowered)

        name = ""
        for raw_line in normalized.splitlines()[:12]:
            line = raw_line.strip()
            if not line:
                continue
            if "@" in line or any(ch.isdigit() for ch in line):
                continue
            if len(line.split()) < 2 or len(line) > 60:
                continue
            name = line
            break

        known_skills = [
            "python", "java", "javascript", "typescript", "react", "node", "sql", "aws", "docker",
            "kubernetes", "git", "fastapi", "flask", "django", "tensorflow", "pytorch", "excel",
        ]
        skills = [skill for skill in known_skills if re.search(rf"\b{re.escape(skill)}\b", lowered)]

        degree_keywords = [
            "b.tech", "btech", "m.tech", "mtech", "b.e", "bachelor", "master", "mba", "phd",
            "computer science", "information technology", "electronics",
        ]
        matched_degree = next((item for item in degree_keywords if item in lowered), "")

        confidence = 0.1
        if name:
            confidence += 0.25
        if email_match:
            confidence += 0.3
        if phone_match:
            confidence += 0.2
        if skills:
            confidence += 0.1
        if matched_degree:
            confidence += 0.05
        confidence = min(confidence, 0.95)

        return {
            "name": name,
            "email": email_match.group(0) if email_match else "",
            "phone": phone_match.group(0) if phone_match else "",
            "linkedin": linkedin_match.group(0) if linkedin_match else "",
            "skills": skills,
            "education": {
                "degree_hint": matched_degree,
            },
            "confidence_score": round(confidence, 2),
            "raw_excerpt": normalized[:2000],
        }

    @staticmethod
    async def parse_resume_upload(upload_file: UploadFile) -> dict:
        filename = upload_file.filename or "resume"
        extension = Path(filename).suffix.lower()
        if extension not in ResumeParserService.ALLOWED_EXTENSIONS:
            raise ValueError("Unsupported file type. Please upload PDF, DOCX, or TXT resume")

        payload = await upload_file.read()
        if not payload:
            raise ValueError("Uploaded resume is empty")
        if len(payload) > ResumeParserService.MAX_UPLOAD_BYTES:
            raise ValueError("Resume exceeds 5MB upload limit")

        storage_dir = ResumeParserService._storage_dir()
        safe_name = ResumeParserService._safe_filename(Path(filename).stem)
        saved_name = f"{safe_name}_{uuid4().hex[:10]}{extension}"
        output_path = storage_dir / saved_name
        output_path.write_bytes(payload)

        extracted_text = ResumeParserService._extract_text(payload, extension)
        parsed = ResumeParserService._parse_with_heuristics(extracted_text)

        autofill = {
            "candidate_name": parsed.get("name", ""),
            "candidate_email": parsed.get("email", ""),
            "candidate_phone": parsed.get("phone", ""),
            "linkedin_url": parsed.get("linkedin", ""),
            "degree": parsed.get("education", {}).get("degree_hint", ""),
        }

        return {
            "resume_url": f"/uploads/resumes/{saved_name}",
            "file_name": filename,
            "parsed_resume_data": parsed,
            "autofill_data": autofill,
            "confidence_score": parsed.get("confidence_score", 0.0),
        }
