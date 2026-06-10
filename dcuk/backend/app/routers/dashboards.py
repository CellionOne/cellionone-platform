from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, date, timedelta
from app.database import get_db
from app.core.auth import get_current_user
from app.models.tender import Tender, TenderAuditEntry
from app.models.historical import HistoricalTender
from app.core.rasci import get_rasci_code

router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])


@router.get("/performance")
def performance_dashboard(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    hist = db.query(HistoricalTender).all()
    now_date = date.today()
    last_12m = now_date - timedelta(days=365)
    last_24m = now_date - timedelta(days=730)

    def win_rate(records):
        if not records:
            return 0
        won = sum(1 for r in records if r.outcome == "won")
        return round(won / len(records) * 100, 1)

    recent_12 = [h for h in hist if h.outcome_date and h.outcome_date >= last_12m]
    recent_24 = [h for h in hist if h.outcome_date and h.outcome_date >= last_24m]

    by_type = {}
    for h in hist:
        t = h.airline_type or "unknown"
        by_type.setdefault(t, []).append(h)

    by_size = {"small": [], "medium": [], "large": []}
    for h in hist:
        v = h.contract_value_gbp or 0
        if v < 1000000:
            by_size["small"].append(h)
        elif v < 3000000:
            by_size["medium"].append(h)
        else:
            by_size["large"].append(h)

    # Win/loss by month (last 24m)
    monthly = {}
    for h in recent_24:
        if h.outcome_date:
            key = h.outcome_date.strftime("%Y-%m")
            monthly.setdefault(key, {"won": 0, "lost": 0, "withdrawn": 0})
            monthly[key][h.outcome] = monthly[key].get(h.outcome, 0) + 1

    # SLA adherence (illustrative — using audit entry timestamps)
    total_actions = db.query(TenderAuditEntry).count()
    sla_adherence_pct = 87.3  # illustrative

    # Time to submit trend (from active tenders — illustrative)
    active = db.query(Tender).filter(Tender.status.in_(["active", "submitted"])).all()

    return {
        "win_rate_last_12m": win_rate(recent_12),
        "win_rate_last_24m": win_rate(recent_24),
        "win_rate_by_type": {t: win_rate(recs) for t, recs in by_type.items()},
        "win_rate_by_size": {s: win_rate(recs) for s, recs in by_size.items()},
        "monthly_outcomes": [
            {"month": k, **v} for k, v in sorted(monthly.items())
        ],
        "sla_adherence_pct": sla_adherence_pct,
        "avg_days_to_submit_target": 7,
        "total_tenders": len(hist),
        "total_won": sum(1 for h in hist if h.outcome == "won"),
        "total_lost": sum(1 for h in hist if h.outcome == "lost"),
        "total_withdrawn": sum(1 for h in hist if h.outcome == "withdrawn"),
        "is_illustrative": True,
    }


@router.get("/persona-summary")
def persona_summary(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """My dashboard — tenders relevant to my persona."""
    all_active = db.query(Tender).filter(Tender.status == "active").all()
    action_required = []
    can_view = []
    now = datetime.now(timezone.utc)

    for t in all_active:
        code = get_rasci_code(current_user.persona_key, t.current_stage_key)
        if code == "-":
            continue
        sla_status = "ok"
        if t.et_sla_deadline:
            remaining_h = (t.et_sla_deadline - now).total_seconds() / 3600
            if remaining_h < 0:
                sla_status = "breached"
            elif remaining_h < 4:
                sla_status = "approaching"
        entry = {
            "id": t.id,
            "tender_ref": t.tender_ref,
            "customer_name": t.customer_name,
            "current_stage_key": t.current_stage_key,
            "estimated_contract_value_gbp": t.estimated_contract_value_gbp,
            "customer_deadline": t.customer_deadline.isoformat() if t.customer_deadline else None,
            "rasci_code": code,
            "sla_status": sla_status,
            "branch": t.branch,
        }
        if code in ("AR", "A"):
            action_required.append(entry)
        else:
            can_view.append(entry)

    return {
        "persona": current_user.persona_key,
        "full_name": current_user.full_name,
        "action_required": action_required,
        "can_view": can_view,
    }


@router.get("/sales-strategy/widgets")
def sales_strategy_widgets(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """Widget D data — historical win rate trends."""
    from app.models.airline import Airline
    hist = db.query(HistoricalTender).all()

    by_outcome = {"won": 0, "lost": 0, "withdrawn": 0}
    for h in hist:
        by_outcome[h.outcome] = by_outcome.get(h.outcome, 0) + 1

    return {
        "win_loss_summary": by_outcome,
        "total_historical": len(hist),
        "is_illustrative": True,
    }
