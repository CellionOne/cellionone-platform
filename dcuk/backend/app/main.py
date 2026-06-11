from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, tenders, airlines, reference, dashboards, upload

app = FastAPI(
    title="ACS Tender Management System",
    description="Illustrative prototype — for stakeholder review, not a committed system.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(tenders.router)
app.include_router(airlines.router)
app.include_router(reference.router)
app.include_router(dashboards.router)
app.include_router(upload.router)


@app.get("/")
def root():
    return {
        "service": "ACS Tender Management System",
        "status": "running",
        "note": "ILLUSTRATIVE PROTOTYPE — for stakeholder review, not a committed system.",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
