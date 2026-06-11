from sqlalchemy import Column, Integer, String, Float, Date, Boolean, JSON, Text
from app.database import Base


class Airline(Base):
    __tablename__ = "airlines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    iata_code = Column(String, nullable=True)
    type = Column(String, nullable=False)  # full_service|low_cost|charter|cargo
    hq_country = Column(String, nullable=False)
    other_countries_operated = Column(JSON, default=list)
    uk_airports_served = Column(JSON, default=list)  # list of IATA codes
    estimated_annual_spend_gbp_m = Column(Float, nullable=True)
    estimated_next_review_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    is_illustrative = Column(Boolean, default=True)
    is_acs_customer = Column(Boolean, default=False)


class AirportPresence(Base):
    __tablename__ = "airport_presence"

    id = Column(Integer, primary_key=True)
    airline_id = Column(Integer, nullable=False, index=True)
    airport_code = Column(String, nullable=False)
    current_caterer = Column(String, nullable=False)  # "acs" | competitor name | "unknown"
    is_acs = Column(Boolean, default=False)
