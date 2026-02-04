# app/routers/messages.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import SessionLocal
from .. import models, schemas
from .dialogs import get_current_user  

router = APIRouter(
    prefix="/messages",
    tags=["messages"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{dialog_id}", response_model=list[schemas.MessageOut])
def list_messages(
    dialog_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    is_participant = (
        db.query(models.DialogParticipant)
        .filter(
            models.DialogParticipant.dialog_id == dialog_id,
            models.DialogParticipant.user_id == current_user.id,
        )
        .first()
    )
    if not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed in this dialog",
        )

    msgs = (
        db.query(models.Message)
        .filter(models.Message.dialog_id == dialog_id)
        .order_by(models.Message.created_at.asc())
        .all()
    )
    return msgs


@router.post("/", response_model=schemas.MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(
    data: schemas.MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    
    is_participant = (
        db.query(models.DialogParticipant)
        .filter(
            models.DialogParticipant.dialog_id == data.dialog_id,
            models.DialogParticipant.user_id == current_user.id,
        )
        .first()
    )
    if not is_participant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed in this dialog",
        )

    msg = models.Message(
        dialog_id=data.dialog_id,
        sender_id=current_user.id,
        ciphertext=data.ciphertext,
        nonce=data.nonce,
        has_links=data.has_links,
        has_files=data.has_files,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg
