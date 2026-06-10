"""Seed 14 demo users. Idempotent."""
from app.core.auth import hash_password

DEMO_PASSWORD = hash_password("demo2026")

USERS = [
    {"email": "sarah.mitchell@dcuk.demo", "full_name": "Sarah Mitchell", "persona_key": "sales_director", "job_title": "Sales Director"},
    {"email": "james.patel@dcuk.demo", "full_name": "James Patel", "persona_key": "head_of_sales", "job_title": "Head of Sales / BG+P"},
    {"email": "priya.sharma@dcuk.demo", "full_name": "Priya Sharma", "persona_key": "sales_strategy", "job_title": "Sales Strategy Manager"},
    {"email": "michael.oconnor@dcuk.demo", "full_name": "Michael O'Connor", "persona_key": "finance_director", "job_title": "Finance Director"},
    {"email": "aisha.begum@dcuk.demo", "full_name": "Aisha Begum", "persona_key": "head_of_function", "job_title": "Head of F&B Cost"},
    {"email": "marcus.thompson@dcuk.demo", "full_name": "Marcus Thompson", "persona_key": "head_of_function", "job_title": "Head of Culinary"},
    {"email": "rebecca.singh@dcuk.demo", "full_name": "Rebecca Singh", "persona_key": "head_of_function", "job_title": "Head of Procurement"},
    {"email": "david.kowalski@dcuk.demo", "full_name": "David Kowalski", "persona_key": "head_of_function", "job_title": "Head of Ops Solution"},
    {"email": "helen.ashworth@dcuk.demo", "full_name": "Helen Ashworth", "persona_key": "executive_team", "job_title": "Chief Executive Officer"},
    {"email": "robert.fitzgerald@dcuk.demo", "full_name": "Robert Fitzgerald", "persona_key": "executive_team", "job_title": "Chief Operating Officer"},
    {"email": "sophia.williams@dcuk.demo", "full_name": "Sophia Williams", "persona_key": "executive_team", "job_title": "Chief Financial Officer"},
    {"email": "tom.henderson@dcuk.demo", "full_name": "Tom Henderson", "persona_key": "group", "job_title": "Group Commercial Director"},
    {"email": "vikram.mehta@dcuk.demo", "full_name": "Vikram Mehta", "persona_key": "supporting_functions", "job_title": "Head of Legal"},
    {"email": "jenny.liu@dcuk.demo", "full_name": "Jenny Liu", "persona_key": "supporting_functions", "job_title": "Head of H&S / Compliance"},
]


def seed_users(db):
    from app.models.user import User
    if db.query(User).count() > 0:
        return
    for u in USERS:
        db.add(User(hashed_password=DEMO_PASSWORD, **u))
    db.commit()
    print(f"  Seeded {len(USERS)} users")
