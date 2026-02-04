# app/routers/dialogs.py

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from app.models import User
from ..db import SessionLocal
from .. import models, schemas
from ..config import settings

from uuid import UUID
from sqlalchemy.orm import joinedload

router = APIRouter(prefix="/dialogs", tags=["dialogs"])


bearer_scheme = HTTPBearer()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user = db.get(models.User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    return user

@router.post("/", response_model=schemas.DialogOut)
def create_dialog(
    data: schemas.DialogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    second_user = (
        db.query(models.User)
        .filter(models.User.id == data.target_user_id)
        .first()
    )
    if not second_user:
        raise HTTPException(status_code=404, detail="Second user not found")

    dialog = models.Dialog(is_group=False)
    db.add(dialog)
    db.flush()

    participants = [
        models.DialogParticipant(dialog_id=dialog.id, user_id=current_user.id),
        models.DialogParticipant(dialog_id=dialog.id, user_id=second_user.id),
    ]
    db.add_all(participants)

    db.commit()
    db.refresh(dialog)

    return schemas.DialogOut(
        id=dialog.id,
        is_group=dialog.is_group,
        created_at=dialog.created_at,
        other_user_email=second_user.email,
    )




@router.get("/", response_model=list[schemas.DialogOut])
def list_my_dialogs(db: Session = Depends(get_db),
                    current_user: models.User = Depends(get_current_user)):

    dialog_ids = [
        dp.dialog_id
        for dp in db.query(models.DialogParticipant)
        .filter(models.DialogParticipant.user_id == current_user.id)
        .all()
    ]
    if not dialog_ids:
        return []

    dialogs = (
        db.query(models.Dialog)
        .filter(models.Dialog.id.in_(dialog_ids))
        .order_by(models.Dialog.created_at.desc())
        .all()
    )

    out = []
    for d in dialogs:
        other_dp = (
            db.query(models.DialogParticipant)
            .filter(
                models.DialogParticipant.dialog_id == d.id,
                models.DialogParticipant.user_id != current_user.id,
            )
            .first()
        )

        other_user = db.get(models.User, other_dp.user_id) if other_dp else None

        out.append(schemas.DialogOut(
            id=d.id,
            is_group=d.is_group,
            created_at=d.created_at,
            other_user_id=other_user.id if other_user else None,
            other_user_email=other_user.email if other_user else None,
            other_user_public_key=other_user.public_key if other_user else None,
        ))

    return out



@router.get("/{dialog_id}/messages", response_model=list[schemas.MessageOut])
def get_dialog_messages(dialog_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    messages = (
        db.query(models.Message)
        .options(joinedload(models.Message.file))
        .filter(models.Message.dialog_id == dialog_id)
        .order_by(models.Message.created_at)
        .all()
    )

    out: list[schemas.MessageOut] = []

    for m in messages:
        file_meta = None
        if m.file is not None:
            file_meta = schemas.FileMetaOut(
                id=str(m.file.id),
                url=f"/{m.file.path}",              
                filename=m.file.original_name,     
                size=m.file.size,
                mime=m.file.mime_type,
            )

        out.append(
            schemas.MessageOut(
                id=str(m.id),
                dialog_id=str(m.dialog_id),
                sender_id=str(m.sender_id),
                ciphertext=m.ciphertext,
                nonce=m.nonce,
                has_links=bool(m.has_links),
                has_files=bool(m.has_files),
                created_at=m.created_at,
                file=file_meta,                     
            )
        )

    return out