from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.auth import get_current_user
from app.models.airline import Airline, AirportPresence

router = APIRouter(prefix="/api/airlines", tags=["airlines"])


def _airline_dict(a: Airline, presence: list) -> dict:
    return {
        "id": a.id,
        "name": a.name,
        "iata_code": a.iata_code,
        "type": a.type,
        "hq_country": a.hq_country,
        "other_countries_operated": a.other_countries_operated,
        "uk_airports_served": a.uk_airports_served,
        "estimated_annual_spend_gbp_m": a.estimated_annual_spend_gbp_m,
        "estimated_next_review_date": a.estimated_next_review_date.isoformat() if a.estimated_next_review_date else None,
        "notes": a.notes,
        "is_dcuk_customer": a.is_dcuk_customer,
        "is_illustrative": a.is_illustrative,
        "airport_presence": [
            {"airport": p.airport_code, "caterer": p.current_caterer, "is_dcuk": p.is_dcuk}
            for p in presence
        ],
    }


@router.get("/")
def list_airlines(
    type: str | None = None,
    is_dcuk: bool | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    q = db.query(Airline)
    if type:
        q = q.filter(Airline.type == type)
    if is_dcuk is not None:
        q = q.filter(Airline.is_dcuk_customer == is_dcuk)
    airlines = q.order_by(Airline.estimated_next_review_date.asc()).all()
    airline_ids = [a.id for a in airlines]
    presence_all = db.query(AirportPresence).filter(AirportPresence.airline_id.in_(airline_ids)).all()
    presence_map: dict[int, list] = {}
    for p in presence_all:
        presence_map.setdefault(p.airline_id, []).append(p)
    return [_airline_dict(a, presence_map.get(a.id, [])) for a in airlines]


@router.get("/pipeline")
def contract_pipeline(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """For Widget A — upcoming contract reviews in next 24 months."""
    from datetime import date, timedelta
    cutoff = date.today().replace(year=date.today().year + 2)
    airlines = (db.query(Airline)
                .filter(Airline.estimated_next_review_date <= cutoff)
                .filter(Airline.estimated_next_review_date.isnot(None))
                .order_by(Airline.estimated_next_review_date.asc())
                .all())
    return [
        {
            "id": a.id,
            "name": a.name,
            "type": a.type,
            "review_date": a.estimated_next_review_date.isoformat() if a.estimated_next_review_date else None,
            "spend_gbp_m": a.estimated_annual_spend_gbp_m,
            "is_dcuk_customer": a.is_dcuk_customer,
            "uk_airports": a.uk_airports_served,
        }
        for a in airlines
    ]


@router.get("/competitor-map")
def competitor_map(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """For Widget B — airport-level caterer breakdown."""
    presence = db.query(AirportPresence).all()
    airline_map = {a.id: a for a in db.query(Airline).all()}

    by_airport: dict[str, dict] = {}
    for p in presence:
        airport = p.airport_code
        if airport not in by_airport:
            by_airport[airport] = {"airport": airport, "total_spend": 0, "caterers": {}, "airlines": []}
        airline = airline_map.get(p.airline_id)
        if airline:
            spend = airline.estimated_annual_spend_gbp_m or 0
            by_airport[airport]["total_spend"] += spend
            caterer = p.current_caterer
            by_airport[airport]["caterers"][caterer] = by_airport[airport]["caterers"].get(caterer, 0) + spend
            by_airport[airport]["airlines"].append({
                "name": airline.name,
                "caterer": caterer,
                "spend_gbp_m": spend,
                "is_dcuk": p.is_dcuk,
            })

    return list(by_airport.values())


@router.get("/global-opportunities")
def global_opportunities(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    """For Widget C — airlines not currently dCUK customers but where dnata Group has presence."""
    dnata_countries = {"UAE", "Singapore", "India", "Australia", "Canada", "USA", "Japan", "Qatar"}
    airlines = db.query(Airline).filter(Airline.is_dcuk_customer == False).all()  # noqa
    result = []
    for a in airlines:
        other = set(a.other_countries_operated or [])
        overlap = other & dnata_countries
        if overlap:
            result.append({
                "id": a.id,
                "name": a.name,
                "type": a.type,
                "hq_country": a.hq_country,
                "spend_gbp_m": a.estimated_annual_spend_gbp_m,
                "review_date": a.estimated_next_review_date.isoformat() if a.estimated_next_review_date else None,
                "dnata_overlap_countries": list(overlap),
                "uk_airports": a.uk_airports_served,
            })
    result.sort(key=lambda x: x["spend_gbp_m"] or 0, reverse=True)
    return result


@router.get("/{airline_id}")
def get_airline(airline_id: int, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    a = db.query(Airline).filter_by(id=airline_id).first()
    if not a:
        from fastapi import HTTPException
        raise HTTPException(404)
    presence = db.query(AirportPresence).filter_by(airline_id=airline_id).all()
    return _airline_dict(a, presence)
