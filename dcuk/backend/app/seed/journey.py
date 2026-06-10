"""Seed journey stages and RASCI matrix from config files. Idempotent."""
import json
from pathlib import Path


def seed_journey(db):
    from app.models.journey import JourneyStage, RASCIMatrix

    if db.query(JourneyStage).count() > 0:
        return

    config_dir = Path(__file__).parent.parent / "config"
    stages = json.loads((config_dir / "journey_stages.json").read_text())
    matrix = json.loads((config_dir / "rasci_matrix.json").read_text())

    for s in stages:
        db.add(JourneyStage(**s))

    for stage_key, personas in matrix.items():
        for persona_key, rasci_code in personas.items():
            db.add(RASCIMatrix(stage_key=stage_key, persona_key=persona_key, rasci_code=rasci_code))

    db.commit()
    print(f"  Seeded {len(stages)} journey stages and {sum(len(v) for v in matrix.values())} RASCI entries")
