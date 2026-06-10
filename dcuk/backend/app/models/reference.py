from sqlalchemy import Column, Integer, String, Float, Date, Boolean, JSON, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database import Base


class RateCard(Base):
    __tablename__ = "rate_cards"

    id = Column(Integer, primary_key=True)
    category = Column(String, nullable=False)  # fb|non_fb
    line_item_name = Column(String, nullable=False)
    description = Column(Text)
    cost_gbp = Column(Float, nullable=False)
    unit = Column(String, default="per_item")
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    is_illustrative = Column(Boolean, default=True)


class APLItem(Base):
    __tablename__ = "apl_items"

    id = Column(Integer, primary_key=True)
    product_name = Column(String, nullable=False)
    category = Column(String, nullable=False)  # food|beverage|equipment|packaging|consumable
    sub_category = Column(String, nullable=True)
    supplier = Column(String, nullable=False)
    agreed_price_gbp = Column(Float, nullable=False)
    unit = Column(String, default="per_item")
    effective_from = Column(Date, nullable=False)
    effective_to = Column(Date, nullable=True)
    status = Column(String, default="active")  # active|pending_review|withdrawn
    is_illustrative = Column(Boolean, default=True)


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    cabin_class = Column(String, nullable=True)  # economy|business|first|crew
    ingredients = Column(JSON, default=list)  # [{apl_item_id, quantity, unit}]
    calculated_cost_gbp = Column(Float, nullable=True)
    last_reviewed_date = Column(Date, nullable=True)
    is_illustrative = Column(Boolean, default=True)


class PricingGuideline(Base):
    __tablename__ = "pricing_guidelines"

    id = Column(Integer, primary_key=True)
    effective_from = Column(Date, nullable=False)
    min_margin_pct = Column(Float, nullable=False)
    target_margin_pct = Column(Float, nullable=False)
    floor_formula_description = Column(Text)
    exception_threshold_gbp = Column(Float)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    is_illustrative = Column(Boolean, default=True)


class AppSetting(Base):
    __tablename__ = "app_settings"

    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(JSON, nullable=False)
    description = Column(Text)
    category = Column(String, default="general")  # sla|branch_routing|pricing|general
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_by_name = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
