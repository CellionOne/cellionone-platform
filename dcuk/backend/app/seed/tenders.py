"""Seed 9 active sample tenders at different stages. Idempotent."""
from datetime import datetime, timezone, timedelta


def _now():
    return datetime.now(timezone.utc)


def _days_ago(n):
    return _now() - timedelta(days=n)


def _days_from_now(n):
    return _now() + timedelta(days=n)


SAMPLE_TENDERS = [
    {
        "tender_ref": "ACS-2026-0001",
        "customer_name": "Emerald Skies",
        "current_stage_key": "receive_tender",
        "branch": "pending",
        "status": "active",
        "estimated_contract_value_gbp": 4200000,
        "is_renewal": True,
        "submission_format": "Online portal + PDF hard copy",
        "scope_summary": "Full re-tender for LHR, LGW and MAN catering operations. Economy and business class F&B plus full non-F&B.",
        "response_posture": None,
        "notes": "Day 0 — just received. Atria extraction complete. Inner Circle to be notified.",
    },
    {
        "tender_ref": "ACS-2026-0002",
        "customer_name": "Crescent Air",
        "current_stage_key": "initial_financial_view",
        "branch": "full",
        "status": "active",
        "estimated_contract_value_gbp": 6800000,
        "is_renewal": False,
        "submission_format": "PDF submission to procurement portal",
        "scope_summary": "Long-haul F&B for LHR and MAN routes. Business class and economy. New customer — strategic target.",
        "response_posture": "mastery",
        "notes": "Day 1–2 — initial financial view in progress. High-value new logo.",
    },
    {
        "tender_ref": "ACS-2026-0003",
        "customer_name": "Polar Atlantic",
        "current_stage_key": "strategy_floor",
        "branch": "full",
        "status": "active",
        "estimated_contract_value_gbp": 3100000,
        "is_renewal": False,
        "submission_format": "PDF + Excel pricing file",
        "scope_summary": "Premium cabin catering for LHR, EDI and MAN. Business class focus with economy economy supplement.",
        "response_posture": "mastery",
        "notes": "Day 2 — strategy meeting just held. Floor set at £2.8m (8% margin). Proceeding to DTP.",
    },
    {
        "tender_ref": "ACS-2026-0004",
        "customer_name": "Meridian Express",
        "current_stage_key": "et_go_nogo",
        "branch": "full",
        "status": "active",
        "estimated_contract_value_gbp": 8500000,
        "is_renewal": False,
        "submission_format": "Secure online portal",
        "scope_summary": "Full service LHR, LGW, BHX and MAN. All cabin classes. Group relationship leverage (UAE).",
        "response_posture": "mastery",
        "notes": "Day 3 — DTP submitted. ET 24h SLA counting. High-value strategic tender.",
    },
    {
        "tender_ref": "ACS-2026-0005",
        "customer_name": "Aurora Air",
        "current_stage_key": "element_loop",
        "branch": "full",
        "status": "active",
        "estimated_contract_value_gbp": 2800000,
        "is_renewal": False,
        "submission_format": "PDF",
        "scope_summary": "New route launch LHR–Toronto. Economy and business class. New customer.",
        "response_posture": "tailored",
        "notes": "Day 3–5 — element loop running. 6 of 8 elements in progress.",
    },
    {
        "tender_ref": "ACS-2026-0006",
        "customer_name": "Highland Carrier",
        "current_stage_key": "finalise_mpl",
        "branch": "full",
        "status": "active",
        "estimated_contract_value_gbp": 1400000,
        "is_renewal": True,
        "submission_format": "Email + PDF",
        "scope_summary": "Charter renewal EDI, GLA, MAN and BFS. Economy only. Seasonal peaks.",
        "response_posture": "light",
        "notes": "Day 5 — MPL being finalised. Sales Strategy AR, FD review in progress.",
    },
    {
        "tender_ref": "ACS-2026-0007",
        "customer_name": "Cobalt Airlines",
        "current_stage_key": "et_approve_submission",
        "branch": "full",
        "status": "active",
        "estimated_contract_value_gbp": 3600000,
        "is_renewal": True,
        "submission_format": "Secure procurement portal",
        "scope_summary": "Major renewal LGW, STN, LTN, BHX. Economy and buy-on-board.",
        "response_posture": "tailored",
        "notes": "Day 11 — ET approval pending. Co-approval complete.",
    },
    {
        "tender_ref": "ACS-2026-0008",
        "customer_name": "Saffron Express",
        "current_stage_key": "submit_to_customer",
        "branch": "full",
        "status": "active",
        "estimated_contract_value_gbp": 2200000,
        "is_renewal": True,
        "submission_format": "PDF via email",
        "scope_summary": "Refresh tender LHR and BHX. Economy and business class.",
        "response_posture": "tailored",
        "notes": "Day 12 — ET approved. Ready for customer submission.",
    },
    {
        "tender_ref": "ACS-2026-0009",
        "customer_name": "Clover Aviation",
        "current_stage_key": "branch_decision",
        "branch": "light",
        "status": "active",
        "estimated_contract_value_gbp": 380000,
        "is_renewal": True,
        "submission_format": "Email PDF",
        "scope_summary": "Small LCC renewal. BFS, EDI, GLA, BRS, CWL. Economy buy-on-board.",
        "response_posture": "light",
        "notes": "Day 3 — branch decision. Light path criteria met. Skipping element loop.",
    },
]


def seed_tenders(db):
    from app.models.tender import (
        Tender, TenderAuditEntry, StrategyMeeting,
        DTPPack, FinancialModel, TenderDeliverableTracker, Element, MPL, CoApproval
    )
    from app.models.user import User
    from app.models.airline import Airline

    if db.query(Tender).count() > 0:
        return

    head_of_sales = db.query(User).filter_by(email="james.patel@acs.demo").first()
    sales_director = db.query(User).filter_by(email="sarah.mitchell@acs.demo").first()
    sales_strategy = db.query(User).filter_by(email="priya.sharma@acs.demo").first()
    finance_director = db.query(User).filter_by(email="michael.oconnor@acs.demo").first()
    aisha = db.query(User).filter_by(email="aisha.begum@acs.demo").first()

    now = _now()

    for i, t in enumerate(SAMPLE_TENDERS):
        airline = db.query(Airline).filter_by(name=t["customer_name"]).first()
        received = _days_ago(12 - i)
        tender = Tender(
            tender_ref=t["tender_ref"],
            airline_id=airline.id if airline else None,
            customer_name=t["customer_name"],
            received_date=received,
            customer_deadline=_days_from_now(12 - i + 15),
            submission_format=t["submission_format"],
            current_stage_key=t["current_stage_key"],
            current_owner_persona="head_of_sales",
            branch=t["branch"],
            status=t["status"],
            estimated_contract_value_gbp=t["estimated_contract_value_gbp"],
            is_renewal=t["is_renewal"],
            response_posture=t["response_posture"],
            scope_summary=t["scope_summary"],
            created_by=head_of_sales.id if head_of_sales else None,
            stage_entered_at=now,
        )
        if t["current_stage_key"] == "et_go_nogo":
            tender.et_sla_deadline = now + timedelta(hours=18)  # ~6h remaining
        db.add(tender)
        db.flush()

        # Add initial audit entry
        db.add(TenderAuditEntry(
            tender_id=tender.id,
            stage_key="receive_tender",
            actor_user_id=head_of_sales.id if head_of_sales else 1,
            actor_name="James Patel",
            rasci_capacity="AR",
            action="create_tender",
            before_state=None,
            after_state={"tender_ref": t["tender_ref"], "stage": "receive_tender"},
            comment="Tender received and logged.",
        ))

        # Add financial model for tenders past Day 1-2
        advanced_stages = ["strategy_floor", "submit_dtp", "et_go_nogo", "branch_decision",
                           "communicate_strategy", "element_loop", "element_exceptions",
                           "finalise_mpl", "collate_proposal", "review_outputs",
                           "co_approve", "et_approve_submission", "submit_to_customer", "post_submission"]
        if t["current_stage_key"] in advanced_stages:
            cv = t["estimated_contract_value_gbp"]
            flights = int(cv / 3500)
            db.add(FinancialModel(
                tender_id=tender.id,
                annual_flights=flights,
                avg_pax_per_flight=145,
                aircraft_type_mix={"short": 30, "medium": 45, "long": 25},
                fb_cost_per_pax=7.20,
                non_fb_cost_per_flight=280.0,
                operational_availability_pct=98.5,
                ramp_variability_pct=2.5,
                margin_target_pct=14.0,
                total_annual_cost=cv * 0.86,
                total_annual_price=cv,
                gross_margin_gbp=cv * 0.14,
                gross_margin_pct=14.0,
                sensitivity_table={
                    "-10%": {"cost": cv * 0.86 * 0.9, "price": cv * 0.9, "margin_pct": 13.6},
                    "-5%": {"cost": cv * 0.86 * 0.95, "price": cv * 0.95, "margin_pct": 13.8},
                    "+5%": {"cost": cv * 0.86 * 1.05, "price": cv * 1.05, "margin_pct": 14.1},
                    "+10%": {"cost": cv * 0.86 * 1.1, "price": cv * 1.1, "margin_pct": 14.2},
                },
                version_number=2,
                last_saved_by=sales_strategy.id if sales_strategy else None,
                is_illustrative=True,
            ))

        # Strategy meeting for tenders past Day 2
        strategy_stages = ["submit_dtp", "et_go_nogo", "branch_decision", "communicate_strategy",
                           "element_loop", "element_exceptions", "finalise_mpl", "collate_proposal",
                           "review_outputs", "co_approve", "et_approve_submission", "submit_to_customer"]
        if t["current_stage_key"] in strategy_stages:
            cv = t["estimated_contract_value_gbp"]
            db.add(StrategyMeeting(
                tender_id=tender.id,
                held_at=received + timedelta(days=2),
                attendees=[
                    {"user_id": sales_director.id, "name": "Sarah Mitchell", "role": "Chair"},
                    {"user_id": head_of_sales.id, "name": "James Patel", "role": "Support"},
                    {"user_id": sales_strategy.id if sales_strategy else 3, "name": "Priya Sharma", "role": "Pricing lead"},
                    {"user_id": finance_director.id if finance_director else 4, "name": "Michael O'Connor", "role": "Finance"},
                ],
                floor_gbp=cv * 0.88,
                floor_margin_pct=8.0,
                pricing_parameters={"target_margin_pct": 14.0, "min_margin_pct": 8.0, "response_posture": t["response_posture"]},
                response_posture=t["response_posture"],
                decisions=[
                    {"text": "Full response path agreed", "decision_taker": "Sarah Mitchell"},
                    {"text": f"Floor set at £{cv * 0.88:,.0f} (8% margin minimum)", "decision_taker": "Sarah Mitchell"},
                    {"text": "Target margin 14%", "decision_taker": "Michael O'Connor"},
                ],
                created_by=sales_director.id if sales_director else 1,
            ))

        # DTP for tenders past Day 3
        dtp_stages = ["et_go_nogo", "branch_decision", "communicate_strategy", "element_loop",
                      "element_exceptions", "finalise_mpl", "collate_proposal", "review_outputs",
                      "co_approve", "et_approve_submission", "submit_to_customer"]
        if t["current_stage_key"] in dtp_stages:
            cv = t["estimated_contract_value_gbp"]
            submitted_at = received + timedelta(days=3)
            db.add(DTPPack(
                tender_id=tender.id,
                opportunity_intro=f"Strategic opportunity with {t['customer_name']}. Contract value estimated £{cv:,.0f}.",
                key_metrics={"contract_value_gbp": cv, "term_years": 3, "airports": t["scope_summary"][:50]},
                win_strategy="Competitive pricing, strong culinary proposition, and operational reliability.",
                model_sense_check="Financial model reviewed. Margin at target parameters. Floor validated.",
                recommendation="go",
                submitted_at=submitted_at,
                et_sla_deadline=submitted_at + timedelta(hours=24),
                created_by=sales_director.id if sales_director else 1,
            ))

        # Elements for element_loop tenders
        if t["current_stage_key"] in ["element_loop", "element_exceptions", "finalise_mpl"]:
            element_keys = ["fb_cost", "culinary_proposition", "price", "procurement",
                            "business_info", "contract_legal", "ops_solution", "value_proposition"]
            element_names = ["F&B Cost", "Culinary Proposition", "Price", "Procurement",
                             "Business Info", "Contract (Legal)", "Ops Solution", "Value Proposition"]
            statuses = ["review", "prepare", "approve", "in_progress",
                        "submitted", "prepare", "review", "prepare"]
            for ek, en, es in zip(element_keys, element_names, statuses):
                db.add(Element(
                    tender_id=tender.id,
                    element_key=ek,
                    element_name=en,
                    status=es if es in ["prepare", "review", "approve", "refine", "closed"] else "prepare",
                    owner_user_id=aisha.id if aisha else None,
                    owner_name="Aisha Begum",
                    draft_content={"sections": {}, "notes": "In progress"},
                    version_number=1,
                ))

        # MPL for finalise_mpl and beyond
        mpl_stages = ["finalise_mpl", "collate_proposal", "review_outputs", "co_approve",
                      "et_approve_submission", "submit_to_customer"]
        if t["current_stage_key"] in mpl_stages:
            cv = t["estimated_contract_value_gbp"]
            mpl_status = "fd_review" if t["current_stage_key"] == "finalise_mpl" else "approved"
            db.add(MPL(
                tender_id=tender.id,
                version_number=1,
                status=mpl_status,
                line_items=[
                    {"category": "F&B Cost", "description": "Economy F&B per pax", "cost": 7.20, "margin_applied": 0.14, "customer_price": 8.37},
                    {"category": "F&B Cost", "description": "Business class F&B per pax", "cost": 18.50, "margin_applied": 0.14, "customer_price": 21.51},
                    {"category": "Non-F&B", "description": "Loading & ramp service per flight", "cost": 295.00, "margin_applied": 0.14, "customer_price": 342.97},
                    {"category": "Overhead", "description": "Kitchen overhead allocation", "cost": cv * 0.04 / 1000, "margin_applied": 0.14, "customer_price": cv * 0.04 / 1000 * 1.163},
                ],
                total_cost=cv * 0.86,
                total_price=cv,
                margin_pct=14.0,
                created_by=sales_strategy.id if sales_strategy else 3,
                is_illustrative=True,
            ))

        # CoApproval for Day 11+
        if t["current_stage_key"] in ["et_approve_submission", "submit_to_customer"]:
            db.add(CoApproval(
                tender_id=tender.id,
                sales_director_user_id=sales_director.id if sales_director else 1,
                sd_approved_at=now - timedelta(hours=2),
                finance_director_user_id=finance_director.id if finance_director else 4,
                fd_approved_at=now - timedelta(hours=1),
                status="both_approved",
            ))

    db.commit()
    print(f"  Seeded {len(SAMPLE_TENDERS)} active sample tenders")
