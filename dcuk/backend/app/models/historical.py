from sqlalchemy import Column, Integer, String, Float, Date, Boolean, Text
from app.database import Base


class HistoricalTender(Base):
    __tablename__ = "historical_tenders"

    id = Column(Integer, primary_key=True)
    customer_name = Column(String, nullable=False)
    airline_type = Column(String)  # full_service|low_cost|charter|cargo
    contract_value_gbp = Column(Float)
    submission_date = Column(Date)
    outcome_date = Column(Date)
    outcome = Column(String)  # won|lost|withdrawn
    lost_stage = Column(String, nullable=True)
    won_lost_reason = Column(Text, nullable=True)
    contract_length_years = Column(Float, nullable=True)
    airports_covered = Column(String, nullable=True)
    is_historical = Column(Boolean, default=True)
    is_illustrative = Column(Boolean, default=True)
