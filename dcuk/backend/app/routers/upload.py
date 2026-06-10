"""Atria upload handler — accepts JSON or PDF, pre-fills tender creation form."""
import os
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.auth import get_current_user
from app.settings import settings

router = APIRouter(prefix="/api/upload", tags=["upload"])


def _extract_from_json(data: dict) -> dict:
    return {
        "customer": data.get("customer"),
        "submission_deadline": data.get("submission_deadline"),
        "submission_format": data.get("submission_format"),
        "scope_summary": data.get("scope_summary"),
        "low_confidence_fields": data.get("low_confidence_fields", []),
        "confidence": "high",
    }


def _extract_from_pdf_text(text: str) -> dict:
    # Best-effort extraction — all fields marked low confidence
    return {
        "customer": None,
        "submission_deadline": None,
        "submission_format": None,
        "scope_summary": text[:500] if text else None,
        "low_confidence_fields": ["customer", "submission_deadline", "submission_format", "scope_summary"],
        "confidence": "low",
    }


@router.post("/atria")
async def upload_atria(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    from app.core.rasci import can_user_act
    allowed, code, reason = can_user_act(current_user.persona_key, "receive_tender", "upload")
    if not allowed:
        raise HTTPException(403, reason)

    upload_dir = settings.upload_dir
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(upload_dir, filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    extracted = {}
    if file.filename and file.filename.endswith(".json"):
        try:
            data = json.loads(content)
            extracted = _extract_from_json(data)
        except Exception:
            extracted = {"low_confidence_fields": ["all"], "confidence": "low"}
    elif file.filename and file.filename.endswith(".pdf"):
        try:
            from pdfminer.high_level import extract_text
            import io
            text = extract_text(io.BytesIO(content))
            extracted = _extract_from_pdf_text(text)
        except Exception:
            extracted = {"low_confidence_fields": ["all"], "confidence": "low",
                         "scope_summary": "PDF extraction failed — please fill fields manually."}
    else:
        extracted = {"low_confidence_fields": ["all"], "confidence": "low"}

    return {
        "file_path": file_path,
        "filename": filename,
        "extracted": extracted,
        "note": "Atria extraction must be run externally and uploaded. Direct API integration is a Phase 2 enhancement.",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": current_user.full_name,
    }
