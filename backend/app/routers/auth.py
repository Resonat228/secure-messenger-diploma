# backend/app/routers/auth.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import SessionLocal         
from .. import models, schemas
from ..security import hash_password, verify_password, create_access_token
from ..services import totp

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/register", response_model=schemas.UserOut)
def register(data: schemas.UserCreate, db: Session = Depends(get_db)):
    username = data.username or data.email.split("@")[0]

    user = models.User(
        email=data.email,
        username=username,
        password_hash=hash_password(data.password),
        public_key=data.public_key, 
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=schemas.Token)
def login(data: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(str(user.id))
    return {"access_token": token, "token_type": "bearer"}
