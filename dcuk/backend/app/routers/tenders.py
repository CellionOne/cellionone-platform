from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.auth import get_current_user
from app.core.rasci import can_user_act, get_rasci_code
from app.core import audit
from app.models.tender import (
    Tender, TenderAuditEntry, FinancialModel, CapturePlan,
    StrategyMeeting, DTPPack, ETDecision, Element,
    TenderDeliverableTracker, MPL, SubmissionPack,
    CoApproval, ETApprovalMeeting, SubmissionRecord
)
from app.models.journey import JourneyStage
from app.models.reference import AppSetting
import json
from pathlib import Path

router = APIRouter(prefix="/api/tenders", tags=["tenders"])

STAGE_ORDER = [
    "receive_tender", "notify_inner_circle", "interpret_requirements",
    "initial_financial_view", "brief_heads_of", "strategy_floor",
    "submit_dtp", "et_go_nogo", "branch_decision", "communicate_strategy",
    "element_loop", "element_exceptions", "finalise_mpl",
    "collate_proposal", "review_outputs", "co_approve",
    "et_approve_submission", "submit_to_customer", "post_submission",
]

LIGHT_PATH_SKIP = {"element_loop", "element_exceptions"}


def _next_stage(current: str, branch: str | None) -> str | None:
    try:
        idx = STAGE_ORDER.index(current)
    except ValueError:
        return None
    for i in range(idx + 1, len(STAGE_ORDER)):
        candidate = STAGE_ORDER[i]
        if branch == "light" and candidate in LIGHT_PATH_SKIP:
            continue
        return candidate
    return None


def _tender_dict(t: Tender) -> dict:
    return {
        "id": t.id,
        "tender_ref": t.tender_ref,
        "airline_id": t.airline_id,
        "customer_name": t.customer_name,
        "received_date": t.received_date.isoformat() if t.received_date else None,
        "customer_deadline": t.customer_deadline.isoformat() if t.customer_deadline else None,
        "submission_format": t.submission_format,
        "current_stage_key": t.current_stage_key,
        "current_owner_persona": t.current_owner_persona,
        "branch": t.branch,
        "status": t.status,
        "estimated_contract_value_gbp": t.estimated_contract_value_gbp,
        "is_renewal": t.is_renewal,
        "response_posture": t.response_posture,
        "scope_summary": t.scope_summary,
        "et_sla_deadline": t.et_sla_deadline.isoformat() if t.et_sla_deadline else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


@router.get("/")
def list_tenders(
    stage: str | None = None,
    status: str | None = None,
    branch: str | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Tender)
    if stage:
        q = q.filter(Tender.current_stage_key == stage)
    if status:
        q = q.filter(Tender.status == status)
    if branch:
        q = q.filter(Tender.branch == branch)
    tenders = q.order_by(Tender.received_date.desc()).all()
    return [_tender_dict(t) for t in tenders]


@router.get("/my-actions")
def my_action_required(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Return tenders where the current user is AR or A at the current stage."""
    all_tenders = db.query(Tender).filter(Tender.status == "active").all()
    result = []
    for t in all_tenders:
        code = get_rasci_code(current_user.persona_key, t.current_stage_key)
        if code in ("AR", "A"):
            d = _tender_dict(t)
            d["rasci_code"] = code
            result.append(d)
    return result


@router.get("/{tender_id}")
def get_tender(tender_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    t = db.query(Tender).filter_by(id=tender_id).first()
    if not t:
        raise HTTPException(404, "Tender not found")
    code = get_rasci_code(current_user.persona_key, t.current_stage_key)
    d = _tender_dict(t)
    d["my_rasci"] = code
    d["can_advance"] = code in ("AR", "A")
    return d


@router.post("/")
def create_tender(body: dict, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    allowed, code, reason = can_user_act(current_user.persona_key, "receive_tender", "create")
    if not allowed:
        raise HTTPException(403, reason)

    # Auto-generate tender ref
    count = db.query(Tender).count()
    tender_ref = f"DCUK-2026-{count + 1:04d}"

    t = Tender(
        tender_ref=tender_ref,
        customer_name=body.get("customer_name"),
        airline_id=body.get("airline_id"),
        received_date=datetime.now(timezone.utc),
        customer_deadline=body.get("customer_deadline"),
        submission_format=body.get("submission_format"),
        current_stage_key="receive_tender",
        branch="pending",
        status="active",
        estimated_contract_value_gbp=body.get("estimated_contract_value_gbp"),
        is_renewal=body.get("is_renewal", False),
        scope_summary=body.get("scope_summary"),
        atria_raw_json=body.get("atria_raw_json"),
        created_by=current_user.id,
        stage_entered_at=datetime.now(timezone.utc),
    )
    db.add(t)
    db.flush()

    audit.log(db, t.id, "receive_tender", current_user.id, current_user.full_name,
              current_user.persona_key, "create_tender",
              after_state={"tender_ref": tender_ref, "stage": "receive_tender"})
    db.commit()
    return _tender_dict(t)


@router.post("/{tender_id}/advance")
def advance_stage(
    tender_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = db.query(Tender).filter_by(id=tender_id).first()
    if not t:
        raise HTTPException(404, "Tender not found")

    allowed, code, reason = can_user_act(current_user.persona_key, t.current_stage_key, "advance_stage")
    if not allowed:
        raise HTTPException(403, f"RASCI block: {reason}")

    from_stage = t.current_stage_key
    to_stage = _next_stage(from_stage, t.branch)
    if not to_stage:
        raise HTTPException(400, "Tender is already at the final stage.")

    t.current_stage_key = to_stage
    t.stage_entered_at = datetime.now(timezone.utc)

    # Set ET SLA on et_go_nogo entry
    if to_stage == "et_go_nogo":
        t.et_sla_deadline = datetime.now(timezone.utc) + timedelta(hours=24)

    audit.log_stage_advance(
        db, t.id, from_stage, to_stage,
        current_user.id, current_user.full_name, current_user.persona_key,
        comment=body.get("comment"),
    )
    db.commit()
    return {"from_stage": from_stage, "to_stage": to_stage, "tender_ref": t.tender_ref}


@router.post("/{tender_id}/branch")
def set_branch(
    tender_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = db.query(Tender).filter_by(id=tender_id).first()
    if not t:
        raise HTTPException(404)

    allowed, code, reason = can_user_act(current_user.persona_key, "branch_decision", "approve")
    if not allowed:
        raise HTTPException(403, reason)

    branch = body.get("branch")
    if branch not in ("light", "full"):
        raise HTTPException(400, "branch must be 'light' or 'full'")

    prev = t.branch
    t.branch = branch
    audit.log(db, t.id, "branch_decision", current_user.id, current_user.full_name,
               current_user.persona_key, "set_branch",
               before_state={"branch": prev}, after_state={"branch": branch},
               comment=body.get("comment"))
    db.commit()
    return {"branch": branch}


@router.get("/{tender_id}/audit")
def get_audit_trail(tender_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    entries = (db.query(TenderAuditEntry)
               .filter_by(tender_id=tender_id)
               .order_by(TenderAuditEntry.timestamp_utc.asc())
               .all())
    return [
        {
            "id": e.id,
            "timestamp_utc": e.timestamp_utc.isoformat(),
            "stage_key": e.stage_key,
            "actor_name": e.actor_name,
            "rasci_capacity": e.rasci_capacity,
            "action": e.action,
            "before_state": e.before_state,
            "after_state": e.after_state,
            "comment": e.comment,
        }
        for e in entries
    ]


@router.get("/{tender_id}/financial-model")
def get_financial_model(tender_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    m = db.query(FinancialModel).filter_by(tender_id=tender_id).first()
    if not m:
        return {}
    return {
        "annual_flights": m.annual_flights,
        "avg_pax_per_flight": m.avg_pax_per_flight,
        "aircraft_type_mix": m.aircraft_type_mix,
        "fb_cost_per_pax": m.fb_cost_per_pax,
        "non_fb_cost_per_flight": m.non_fb_cost_per_flight,
        "operational_availability_pct": m.operational_availability_pct,
        "ramp_variability_pct": m.ramp_variability_pct,
        "margin_target_pct": m.margin_target_pct,
        "total_annual_cost": m.total_annual_cost,
        "total_annual_price": m.total_annual_price,
        "gross_margin_gbp": m.gross_margin_gbp,
        "gross_margin_pct": m.gross_margin_pct,
        "sensitivity_table": m.sensitivity_table,
        "version_number": m.version_number,
        "is_illustrative": m.is_illustrative,
    }


@router.put("/{tender_id}/financial-model")
def save_financial_model(
    tender_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = db.query(Tender).filter_by(id=tender_id).first()
    if not t:
        raise HTTPException(404)

    allowed, code, reason = can_user_act(current_user.persona_key, t.current_stage_key, "edit")
    if not allowed:
        raise HTTPException(403, reason)

    # Compute outputs
    flights = body.get("annual_flights", 0) or 0
    pax = body.get("avg_pax_per_flight", 0) or 0
    fb_cost = body.get("fb_cost_per_pax", 0) or 0
    non_fb = body.get("non_fb_cost_per_flight", 0) or 0
    avail = (body.get("operational_availability_pct", 98.5) or 98.5) / 100
    margin = (body.get("margin_target_pct", 14.0) or 14.0) / 100

    effective_flights = flights * avail
    total_cost = (effective_flights * pax * fb_cost) + (effective_flights * non_fb)
    total_price = total_cost / (1 - margin) if margin < 1 else total_cost
    gross_margin = total_price - total_cost
    gross_margin_pct = (gross_margin / total_price * 100) if total_price else 0

    sensitivity = {
        "-10%": {"cost": total_cost * 0.9, "price": total_price * 0.9, "margin_pct": round(gross_margin_pct - 0.4, 1)},
        "-5%": {"cost": total_cost * 0.95, "price": total_price * 0.95, "margin_pct": round(gross_margin_pct - 0.2, 1)},
        "+5%": {"cost": total_cost * 1.05, "price": total_price * 1.05, "margin_pct": round(gross_margin_pct + 0.1, 1)},
        "+10%": {"cost": total_cost * 1.1, "price": total_price * 1.1, "margin_pct": round(gross_margin_pct + 0.2, 1)},
    }

    m = db.query(FinancialModel).filter_by(tender_id=tender_id).first()
    if m:
        old_version = m.version_number
        m.annual_flights = flights
        m.avg_pax_per_flight = pax
        m.aircraft_type_mix = body.get("aircraft_type_mix")
        m.fb_cost_per_pax = fb_cost
        m.non_fb_cost_per_flight = non_fb
        m.operational_availability_pct = body.get("operational_availability_pct")
        m.ramp_variability_pct = body.get("ramp_variability_pct")
        m.margin_target_pct = body.get("margin_target_pct")
        m.total_annual_cost = total_cost
        m.total_annual_price = total_price
        m.gross_margin_gbp = gross_margin
        m.gross_margin_pct = gross_margin_pct
        m.sensitivity_table = sensitivity
        m.version_number = old_version + 1
        m.last_saved_by = current_user.id
    else:
        m = FinancialModel(
            tender_id=tender_id,
            annual_flights=flights,
            avg_pax_per_flight=pax,
            aircraft_type_mix=body.get("aircraft_type_mix"),
            fb_cost_per_pax=fb_cost,
            non_fb_cost_per_flight=non_fb,
            operational_availability_pct=body.get("operational_availability_pct"),
            ramp_variability_pct=body.get("ramp_variability_pct"),
            margin_target_pct=body.get("margin_target_pct"),
            total_annual_cost=total_cost,
            total_annual_price=total_price,
            gross_margin_gbp=gross_margin,
            gross_margin_pct=gross_margin_pct,
            sensitivity_table=sensitivity,
            version_number=1,
            last_saved_by=current_user.id,
            is_illustrative=True,
        )
        db.add(m)

    audit.log(db, tender_id, t.current_stage_key, current_user.id, current_user.full_name,
               current_user.persona_key, "save_financial_model",
               after_state={"total_price": total_price, "margin_pct": gross_margin_pct, "version": m.version_number})
    db.commit()
    return {"total_annual_cost": total_cost, "total_annual_price": total_price,
            "gross_margin_gbp": gross_margin, "gross_margin_pct": gross_margin_pct,
            "sensitivity_table": sensitivity, "version_number": m.version_number}


@router.get("/{tender_id}/elements")
def get_elements(tender_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    elements = db.query(Element).filter_by(tender_id=tender_id).all()
    return [{"id": e.id, "element_key": e.element_key, "element_name": e.element_name,
             "status": e.status, "owner_name": e.owner_name, "version_number": e.version_number,
             "draft_content": e.draft_content} for e in elements]


@router.put("/{tender_id}/elements/{element_key}")
def update_element(
    tender_id: int,
    element_key: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = db.query(Tender).filter_by(id=tender_id).first()
    if not t:
        raise HTTPException(404)
    allowed, code, reason = can_user_act(current_user.persona_key, "element_loop", "edit")
    if not allowed:
        raise HTTPException(403, reason)

    el = db.query(Element).filter_by(tender_id=tender_id, element_key=element_key).first()
    if not el:
        raise HTTPException(404, "Element not found")

    prev_status = el.status
    el.draft_content = body.get("draft_content", el.draft_content)
    if "status" in body:
        el.status = body["status"]
    el.version_number += 1

    audit.log(db, tender_id, "element_loop", current_user.id, current_user.full_name,
               current_user.persona_key, f"update_element:{element_key}",
               before_state={"status": prev_status}, after_state={"status": el.status, "version": el.version_number})
    db.commit()
    return {"element_key": element_key, "status": el.status, "version": el.version_number}


@router.get("/{tender_id}/mpl")
def get_mpl(tender_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    mpl = db.query(MPL).filter_by(tender_id=tender_id).order_by(MPL.version_number.desc()).first()
    if not mpl:
        return {}
    return {
        "id": mpl.id, "version_number": mpl.version_number, "status": mpl.status,
        "line_items": mpl.line_items, "total_cost": mpl.total_cost,
        "total_price": mpl.total_price, "margin_pct": mpl.margin_pct,
        "approved_by_name": mpl.approved_by_name, "approved_at": mpl.approved_at.isoformat() if mpl.approved_at else None,
        "is_illustrative": mpl.is_illustrative,
    }


@router.post("/{tender_id}/mpl/approve")
def approve_mpl(
    tender_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = db.query(Tender).filter_by(id=tender_id).first()
    if not t:
        raise HTTPException(404)

    # FD is A on finalise_mpl
    allowed, code, reason = can_user_act(current_user.persona_key, "finalise_mpl", "approve")
    if not allowed:
        raise HTTPException(403, reason)

    mpl = db.query(MPL).filter_by(tender_id=tender_id).order_by(MPL.version_number.desc()).first()
    if not mpl:
        raise HTTPException(404, "MPL not found")

    decision = body.get("decision")  # approved|rejected
    mpl.status = "approved" if decision == "approved" else "rejected"
    mpl.approved_by = current_user.id
    mpl.approved_by_name = current_user.full_name
    mpl.approved_at = datetime.now(timezone.utc)
    if decision == "rejected":
        mpl.rejection_comment = body.get("comment")

    audit.log(db, tender_id, "finalise_mpl", current_user.id, current_user.full_name,
               current_user.persona_key, f"mpl_{decision}",
               after_state={"mpl_status": mpl.status}, comment=body.get("comment"))
    db.commit()
    return {"status": mpl.status}


@router.post("/{tender_id}/et-decision")
def record_et_decision(
    tender_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = db.query(Tender).filter_by(id=tender_id).first()
    if not t:
        raise HTTPException(404)

    stage_key = body.get("stage_key", t.current_stage_key)
    allowed, code, reason = can_user_act(current_user.persona_key, stage_key, "decide")
    if not allowed:
        raise HTTPException(403, reason)

    decision = body.get("decision")
    rec = ETDecision(
        tender_id=tender_id,
        stage_key=stage_key,
        decided_by=current_user.id,
        decided_by_name=current_user.full_name,
        decision=decision,
        rationale=body.get("rationale"),
        is_delegated=body.get("is_delegated", False),
    )
    db.add(rec)

    audit.log(db, tender_id, stage_key, current_user.id, current_user.full_name,
               current_user.persona_key, f"et_decision:{decision}",
               after_state={"decision": decision}, comment=body.get("rationale"))
    db.commit()
    return {"decision": decision, "stage_key": stage_key}


@router.post("/{tender_id}/co-approve")
def co_approve(
    tender_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    t = db.query(Tender).filter_by(id=tender_id).first()
    if not t:
        raise HTTPException(404)

    allowed, code, reason = can_user_act(current_user.persona_key, "co_approve", "co_approve")
    if not allowed:
        raise HTTPException(403, reason)

    ca = db.query(CoApproval).filter_by(tender_id=tender_id).first()
    if not ca:
        ca = CoApproval(tender_id=tender_id)
        db.add(ca)

    if current_user.persona_key == "sales_director":
        ca.sales_director_user_id = current_user.id
        ca.sd_approved_at = datetime.now(timezone.utc)
    elif current_user.persona_key == "finance_director":
        ca.finance_director_user_id = current_user.id
        ca.fd_approved_at = datetime.now(timezone.utc)

    if ca.sd_approved_at and ca.fd_approved_at:
        ca.status = "both_approved"

    audit.log(db, tender_id, "co_approve", current_user.id, current_user.full_name,
               current_user.persona_key, "co_approve",
               after_state={"status": ca.status})
    db.commit()
    return {"status": ca.status, "sd_approved": ca.sd_approved_at is not None, "fd_approved": ca.fd_approved_at is not None}


@router.get("/rasci/check")
def check_rasci(
    persona: str,
    stage: str,
    action: str,
    current_user=Depends(get_current_user),
):
    allowed, code, reason = can_user_act(persona, stage, action)
    return {"allowed": allowed, "rasci_code": code, "reason": reason}


@router.get("/portfolio/summary")
def portfolio_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    all_tenders = db.query(Tender).filter(Tender.status == "active").all()
    by_stage = {}
    sla_status = {"on_track": 0, "approaching": 0, "breached": 0}
    now = datetime.now(timezone.utc)

    for t in all_tenders:
        s = t.current_stage_key
        by_stage[s] = by_stage.get(s, 0) + 1

        if t.et_sla_deadline:
            remaining = (t.et_sla_deadline - now).total_seconds() / 3600
            if remaining < 0:
                sla_status["breached"] += 1
            elif remaining < 4:
                sla_status["approaching"] += 1
            else:
                sla_status["on_track"] += 1

    return {
        "total_active": len(all_tenders),
        "by_stage": by_stage,
        "sla_status": sla_status,
        "by_branch": {
            "full": sum(1 for t in all_tenders if t.branch == "full"),
            "light": sum(1 for t in all_tenders if t.branch == "light"),
            "pending": sum(1 for t in all_tenders if t.branch == "pending"),
        }
    }
