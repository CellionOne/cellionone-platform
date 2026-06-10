from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base

PERSONA_KEYS = [
    "sales_director",
    "head_of_sales",
    "sales_strategy",
    "finance_director",
    "head_of_function",
    "executive_team",
    "group",
    "supporting_functions",
]


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    persona_key = Column(String, nullable=False)  # one of PERSONA_KEYS
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    job_title = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
