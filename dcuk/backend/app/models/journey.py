from sqlalchemy import Column, Integer, String, Boolean, JSON, Float
from app.database import Base


class JourneyStage(Base):
    __tablename__ = "journey_stages"

    id = Column(Integer, primary_key=True)
    stage_key = Column(String, unique=True, nullable=False, index=True)
    day_label = Column(String, nullable=False)
    type = Column(String, nullable=False)  # stage|gate|stage_meeting|gate_meeting
    name = Column(String, nullable=False)
    time_description = Column(String)
    sla_hours = Column(Float, nullable=True)
    sequence_order = Column(Integer, nullable=False)
    is_branch_point = Column(Boolean, default=False)
    is_light_path_skip = Column(Boolean, default=False)
    meeting_chair_persona = Column(String, nullable=True)
    meeting_attendees_personas = Column(JSON, default=list)
    what = Column(String)
    when_condition = Column(String)
    include_items = Column(String)


class RASCIMatrix(Base):
    __tablename__ = "rasci_matrix"

    id = Column(Integer, primary_key=True)
    stage_key = Column(String, nullable=False, index=True)
    persona_key = Column(String, nullable=False)
    rasci_code = Column(String, nullable=False)  # AR|A|R|S|C|I|-
