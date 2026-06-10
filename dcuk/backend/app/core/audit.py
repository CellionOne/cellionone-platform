"""
Audit trail infrastructure.
Every state change writes an immutable TenderAuditEntry.
No entry is ever deleted or updated.
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.core.rasci import get_rasci_code


def log(
    db: Session,
    tender_id: int,
    stage_key: str,
    actor_user_id: int,
    actor_name: str,
    persona_key: str,
    action: str,
    before_state: dict | None = None,
    after_state: dict | None = None,
    comment: str | None = None,
) -> None:
    """
    Write an immutable audit entry. Call this for every business action.
    SQLAlchemy does NOT auto-flush here — caller commits as normal.
    """
    from app.models.tender import TenderAuditEntry

    rasci_code = get_rasci_code(persona_key, stage_key)

    entry = TenderAuditEntry(
        tender_id=tender_id,
        timestamp_utc=datetime.now(timezone.utc),
        stage_key=stage_key,
        actor_user_id=actor_user_id,
        actor_name=actor_name,
        rasci_capacity=rasci_code,
        action=action,
        before_state=before_state,
        after_state=after_state,
        comment=comment,
    )
    db.add(entry)


def log_stage_advance(
    db: Session,
    tender_id: int,
    from_stage: str,
    to_stage: str,
    actor_user_id: int,
    actor_name: str,
    persona_key: str,
    comment: str | None = None,
) -> None:
    log(
        db=db,
        tender_id=tender_id,
        stage_key=from_stage,
        actor_user_id=actor_user_id,
        actor_name=actor_name,
        persona_key=persona_key,
        action=f"advance_stage → {to_stage}",
        before_state={"stage": from_stage},
        after_state={"stage": to_stage},
        comment=comment,
    )
