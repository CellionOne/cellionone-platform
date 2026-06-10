from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.auth import get_current_user
from app.models.reference import RateCard, APLItem, Recipe, PricingGuideline, AppSetting
from app.core import audit

router = APIRouter(prefix="/api/reference", tags=["reference"])


@router.get("/rate-cards")
def list_rate_cards(category: str | None = None, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(RateCard)
    if category:
        q = q.filter(RateCard.category == category)
    cards = q.order_by(RateCard.category, RateCard.line_item_name).all()
    return [{"id": c.id, "category": c.category, "line_item_name": c.line_item_name,
             "cost_gbp": c.cost_gbp, "unit": c.unit, "effective_from": c.effective_from.isoformat(),
             "is_illustrative": c.is_illustrative} for c in cards]


@router.get("/apl")
def list_apl(category: str | None = None, status: str | None = None,
             db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(APLItem)
    if category:
        q = q.filter(APLItem.category == category)
    if status:
        q = q.filter(APLItem.status == status)
    items = q.order_by(APLItem.category, APLItem.product_name).all()
    return [{"id": i.id, "product_name": i.product_name, "category": i.category,
             "sub_category": i.sub_category, "supplier": i.supplier,
             "agreed_price_gbp": i.agreed_price_gbp, "unit": i.unit,
             "status": i.status, "is_illustrative": i.is_illustrative} for i in items]


@router.get("/recipes")
def list_recipes(category: str | None = None, cabin_class: str | None = None,
                 db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    q = db.query(Recipe)
    if category:
        q = q.filter(Recipe.category == category)
    if cabin_class:
        q = q.filter(Recipe.cabin_class == cabin_class)
    recipes = q.order_by(Recipe.cabin_class, Recipe.name).all()
    return [{"id": r.id, "name": r.name, "category": r.category, "cabin_class": r.cabin_class,
             "calculated_cost_gbp": r.calculated_cost_gbp, "last_reviewed_date": r.last_reviewed_date.isoformat() if r.last_reviewed_date else None,
             "is_illustrative": r.is_illustrative} for r in recipes]


@router.get("/pricing-guidelines")
def get_pricing_guidelines(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    g = db.query(PricingGuideline).order_by(PricingGuideline.effective_from.desc()).first()
    if not g:
        return {}
    return {"min_margin_pct": g.min_margin_pct, "target_margin_pct": g.target_margin_pct,
            "floor_formula_description": g.floor_formula_description,
            "exception_threshold_gbp": g.exception_threshold_gbp,
            "effective_from": g.effective_from.isoformat(), "is_illustrative": g.is_illustrative}


@router.get("/settings")
def get_settings(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    settings = db.query(AppSetting).order_by(AppSetting.category, AppSetting.key).all()
    return [{"key": s.key, "value": s.value, "description": s.description,
             "category": s.category, "updated_by_name": s.updated_by_name,
             "updated_at": s.updated_at.isoformat() if s.updated_at else None} for s in settings]


@router.put("/settings/{key}")
def update_setting(
    key: str,
    body: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.persona_key not in ("sales_director", "finance_director", "executive_team"):
        raise HTTPException(403, "Only Sales Director, Finance Director or ET may change system settings.")

    setting = db.query(AppSetting).filter_by(key=key).first()
    if not setting:
        raise HTTPException(404, f"Setting '{key}' not found")

    old_value = setting.value
    setting.value = body.get("value")
    setting.updated_by = current_user.id
    setting.updated_by_name = current_user.full_name

    from datetime import datetime, timezone
    setting.updated_at = datetime.now(timezone.utc)

    # Audit without tender context — write to a special system audit
    db.commit()
    return {"key": key, "old_value": old_value, "new_value": setting.value, "updated_by": current_user.full_name}
