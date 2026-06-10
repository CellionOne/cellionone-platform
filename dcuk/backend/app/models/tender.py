from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, Text, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class Tender(Base):
    __tablename__ = "tenders"

    id = Column(Integer, primary_key=True, index=True)
    tender_ref = Column(String, unique=True, nullable=False, index=True)  # DCUK-2026-NNNN
    airline_id = Column(Integer, ForeignKey("airlines.id"), nullable=True)
    customer_name = Column(String, nullable=False)
    received_date = Column(DateTime(timezone=True), nullable=False)
    customer_deadline = Column(DateTime(timezone=True), nullable=True)
    submission_format = Column(String, nullable=True)
    current_stage_key = Column(String, nullable=False, default="receive_tender")
    current_owner_persona = Column(String, nullable=True)
    branch = Column(String, nullable=True)  # light|full|pending
    status = Column(String, nullable=False, default="active")  # active|submitted|won|lost|withdrawn|operationalised
    estimated_contract_value_gbp = Column(Float, nullable=True)
    is_renewal = Column(Boolean, default=False)
    response_posture = Column(String, nullable=True)  # light|tailored|mastery
    atria_upload_path = Column(String, nullable=True)
    atria_raw_json = Column(JSON, nullable=True)
    scope_summary = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    stage_entered_at = Column(DateTime(timezone=True), nullable=True)
    et_sla_deadline = Column(DateTime(timezone=True), nullable=True)


class TenderAuditEntry(Base):
    __tablename__ = "tender_audit_entries"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False, index=True)
    timestamp_utc = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    stage_key = Column(String, nullable=False)
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    actor_name = Column(String, nullable=False)
    rasci_capacity = Column(String, nullable=False)
    action = Column(String, nullable=False)
    before_state = Column(JSON, nullable=True)
    after_state = Column(JSON, nullable=True)
    comment = Column(Text, nullable=True)


class TenderVersion(Base):
    __tablename__ = "tender_versions"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    model_inputs = Column(JSON)
    model_outputs = Column(JSON)
    is_illustrative = Column(Boolean, default=True)


class FinancialModel(Base):
    __tablename__ = "financial_models"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), unique=True, nullable=False, index=True)
    annual_flights = Column(Integer, nullable=True)
    avg_pax_per_flight = Column(Integer, nullable=True)
    aircraft_type_mix = Column(JSON, nullable=True)  # {short: %, medium: %, long: %}
    fb_cost_per_pax = Column(Float, nullable=True)
    non_fb_cost_per_flight = Column(Float, nullable=True)
    operational_availability_pct = Column(Float, nullable=True)
    ramp_variability_pct = Column(Float, nullable=True)
    margin_target_pct = Column(Float, nullable=True)
    total_annual_cost = Column(Float, nullable=True)
    total_annual_price = Column(Float, nullable=True)
    gross_margin_gbp = Column(Float, nullable=True)
    gross_margin_pct = Column(Float, nullable=True)
    sensitivity_table = Column(JSON, nullable=True)
    version_number = Column(Integer, default=1)
    last_saved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_saved_at = Column(DateTime(timezone=True), server_default=func.now())
    is_illustrative = Column(Boolean, default=True)


class CapturePlan(Base):
    __tablename__ = "capture_plans"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), unique=True, nullable=False)
    customer_brief = Column(Text)
    why_in_market = Column(Text)
    key_dates = Column(JSON)
    response_posture = Column(String)
    initial_financial_summary = Column(Text)
    decisions_to_take = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class StrategyMeeting(Base):
    __tablename__ = "strategy_meetings"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), unique=True, nullable=False)
    held_at = Column(DateTime(timezone=True))
    attendees = Column(JSON, default=list)
    floor_gbp = Column(Float)
    floor_margin_pct = Column(Float)
    pricing_parameters = Column(JSON, default=dict)
    response_posture = Column(String)
    decisions = Column(JSON, default=list)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class DTPPack(Base):
    __tablename__ = "dtp_packs"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), unique=True, nullable=False)
    opportunity_intro = Column(Text)
    key_metrics = Column(JSON)
    win_strategy = Column(Text)
    model_sense_check = Column(Text)
    recommendation = Column(String)  # go|no_go|conditional
    submitted_at = Column(DateTime(timezone=True))
    et_sla_deadline = Column(DateTime(timezone=True))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ETDecision(Base):
    __tablename__ = "et_decisions"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False, index=True)
    stage_key = Column(String, nullable=False)
    decided_by = Column(Integer, ForeignKey("users.id"))
    decided_by_name = Column(String)
    decision = Column(String)  # go|no_go|conditional|approved|rejected
    rationale = Column(Text)
    decided_at = Column(DateTime(timezone=True), server_default=func.now())
    is_delegated = Column(Boolean, default=False)


class TenderDeliverableTracker(Base):
    __tablename__ = "tender_deliverable_trackers"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False, index=True)
    element_key = Column(String, nullable=False)
    element_name = Column(String, nullable=False)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner_name = Column(String, nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="pending")  # pending|in_progress|submitted|approved|returned


class Element(Base):
    __tablename__ = "elements"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False, index=True)
    element_key = Column(String, nullable=False)
    element_name = Column(String, nullable=False)
    status = Column(String, default="prepare")  # prepare|review|approve|refine|closed
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner_name = Column(String, nullable=True)
    draft_content = Column(JSON, default=dict)
    version_number = Column(Integer, default=1)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_comment = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())


class ElementException(Base):
    __tablename__ = "element_exceptions"

    id = Column(Integer, primary_key=True)
    element_id = Column(Integer, ForeignKey("elements.id"), nullable=False)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False, index=True)
    exception_type = Column(String, nullable=False)  # apl_deviation|pricing_override|supplier_substitution|recipe_substitution|contract_clause_deviation
    raised_by = Column(Integer, ForeignKey("users.id"))
    raised_by_name = Column(String)
    raised_at = Column(DateTime(timezone=True), server_default=func.now())
    evidence_notes = Column(Text)
    routed_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="open")  # open|approved|rejected
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_comment = Column(Text, nullable=True)


class MPL(Base):
    __tablename__ = "mpls"

    id = Column(Integer, primary_key=True, index=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False, index=True)
    version_number = Column(Integer, default=1)
    status = Column(String, default="draft")  # draft|fd_review|approved|rejected
    line_items = Column(JSON, default=list)
    total_cost = Column(Float, nullable=True)
    total_price = Column(Float, nullable=True)
    margin_pct = Column(Float, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_by_name = Column(String, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_comment = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
    is_illustrative = Column(Boolean, default=True)


class SubmissionPack(Base):
    __tablename__ = "submission_packs"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), unique=True, nullable=False)
    collated_at = Column(DateTime(timezone=True), server_default=func.now())
    collated_by = Column(Integer, ForeignKey("users.id"))
    element_versions = Column(JSON, default=dict)
    mpl_id = Column(Integer, ForeignKey("mpls.id"), nullable=True)
    financial_model_version = Column(Integer, nullable=True)
    gaps_detected = Column(JSON, default=list)
    readiness_signed_off_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    readiness_signed_off_at = Column(DateTime(timezone=True), nullable=True)
    variance_flags = Column(JSON, default=list)


class CoApproval(Base):
    __tablename__ = "co_approvals"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), unique=True, nullable=False)
    sales_director_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    sd_approved_at = Column(DateTime(timezone=True), nullable=True)
    finance_director_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    fd_approved_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String, default="pending")  # pending|both_approved|rejected


class ETApprovalMeeting(Base):
    __tablename__ = "et_approval_meetings"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), unique=True, nullable=False)
    held_at = Column(DateTime(timezone=True), nullable=True)
    chair_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    attendees = Column(JSON, default=list)
    decisions_per_approver = Column(JSON, default=list)
    outcome = Column(String, nullable=True)  # approved|rejected
    outcome_at = Column(DateTime(timezone=True), nullable=True)


class SubmissionRecord(Base):
    __tablename__ = "submission_records"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), unique=True, nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now())
    submitted_by = Column(Integer, ForeignKey("users.id"))
    submitted_by_name = Column(String)
    format = Column(String)
    access_method = Column(String)
    what_was_sent = Column(Text)
    what_was_requested = Column(Text)


class PostSubmissionRecord(Base):
    __tablename__ = "post_submission_records"

    id = Column(Integer, primary_key=True)
    tender_id = Column(Integer, ForeignKey("tenders.id"), nullable=False, index=True)
    record_type = Column(String)  # negotiation|contract|further_submission|menu_presentation|site_visit|audit
    notes = Column(Text)
    occurred_at = Column(DateTime(timezone=True), server_default=func.now())
    participants = Column(JSON, default=list)
    updated_by = Column(Integer, ForeignKey("users.id"))
