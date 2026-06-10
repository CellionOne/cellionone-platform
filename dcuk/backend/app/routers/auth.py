from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.auth import verify_password, create_access_token
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/token")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "persona_key": user.persona_key,
            "job_title": user.job_title,
        }
    }


@router.get("/me")
def get_me(db: Session = Depends(get_db), current_user=Depends(__import__("app.core.auth", fromlist=["get_current_user"]).get_current_user)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "persona_key": current_user.persona_key,
        "job_title": current_user.job_title,
    }
