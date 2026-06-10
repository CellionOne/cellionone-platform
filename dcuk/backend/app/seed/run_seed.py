"""Idempotent seed runner. Safe to run multiple times."""
from app.database import SessionLocal
from app.seed.users import seed_users
from app.seed.journey import seed_journey
from app.seed.airlines import seed_airlines
from app.seed.reference_data import seed_reference_data
from app.seed.historical_tenders import seed_historical_tenders
from app.seed.tenders import seed_tenders


def run():
    db = SessionLocal()
    try:
        print("Seeding database...")
        seed_users(db)
        seed_journey(db)
        seed_airlines(db)
        seed_reference_data(db)
        seed_historical_tenders(db)
        seed_tenders(db)
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
