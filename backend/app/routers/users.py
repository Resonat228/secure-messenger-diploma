from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session, object_session
from jose import JWTError, jwt

from ..db import SessionLocal
from .. import models, schemas
from ..config import settings
from ..deps import get_db, get_current_user
from uuid import UUID

router = APIRouter(prefix="/users", tags=["users"])

bearer_scheme = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.put("/me/public-key")
def set_my_public_key(
    data: schemas.PublicKeyIn,
    current_user: models.User = Depends(get_current_user),
):
    
    current_user.public_key = data.public_key

    
    db = object_session(current_user)
    if db is None:
        raise HTTPException(status_code=500, detail="DB session not found")

    db.commit()
    db.refresh(current_user)

    return {"status": "ok"}



@router.get("/{user_id}/public-key", response_model=schemas.PublicKeyOut)
def get_user_public_key(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    user = db.get(models.User, user_id)
    if not user or not user.public_key:
        raise HTTPException(status_code=404, detail="Public key not found")
    return {"user_id": user.id, "public_key": user.public_key}

def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    token = creds.credentials

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALG],
        )
        user_id = payload.get("sub")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return user


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.get("/search", response_model=List[schemas.UserOut])
def search_users(
    q: str = Query(..., min_length=2, max_length=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Поиск других пользователей по email.
    Себя из результатов убираем.
    """

    pattern = f"%{q.lower()}%"

    users = (
        db.query(models.User)
        .filter(models.User.id != current_user.id)
        .filter(models.User.email.ilike(pattern))
        .order_by(models.User.email)
        .limit(20)
        .all()
    )

    return users
