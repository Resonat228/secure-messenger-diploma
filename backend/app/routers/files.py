# app/routers/files.py
import os
import uuid
import shutil
from uuid import UUID

from fastapi import APIRouter, UploadFile, File, Depends, Form, HTTPException
from sqlalchemy.orm import Session
from fastapi.responses import FileResponse

from app import models
from app.deps import get_current_user, get_db
from app.routers.ws import broadcast_dialog  

router = APIRouter(prefix="/files", tags=["files"])

UPLOAD_DIR = "uploads"


@router.post("/upload")
async def upload_file(
    dialog_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    
    dialog = db.get(models.Dialog, dialog_id)
    if dialog is None:
        raise HTTPException(status_code=404, detail="Dialog not found")

    participant = (
        db.query(models.DialogParticipant)
        .filter(
            models.DialogParticipant.dialog_id == dialog_id,
            models.DialogParticipant.user_id == current_user.id,
        )
        .first()
    )
    if participant is None:
        raise HTTPException(status_code=403, detail="Not a participant of this dialog")

    
    file_id = uuid.uuid4()
    safe_name = (file.filename or "file").replace("/", "_").replace("\\", "_")
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{safe_name}")

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    size = os.path.getsize(file_path)

   
    db_file = models.File(
        id=file_id,
        owner_id=current_user.id,
        path=file_path,
        original_name=safe_name,
        mime_type=file.content_type or "application/octet-stream",
        size=size,  
        
    )
    db.add(db_file)
    db.flush()  

   
    msg = models.Message(
        dialog_id=dialog_id,
        sender_id=current_user.id,
        ciphertext="",  
        nonce="",
        file_id=db_file.id,
        has_links=False,
        has_files=True,
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    db.refresh(db_file)

    
    file_meta = {
        "id": str(db_file.id),
        "url": f"/{db_file.path.replace(os.sep, '/')}",  
        "filename": db_file.original_name,
        "size": db_file.size,
        "mime": db_file.mime_type,
    }

    payload = {
        "id": str(msg.id),
        "dialog_id": str(msg.dialog_id),
        "sender_id": str(msg.sender_id),
        "ciphertext": msg.ciphertext,
        "nonce": msg.nonce,
        "has_links": msg.has_links,
        "has_files": msg.has_files,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
        "file": file_meta,
    }

    
    await broadcast_dialog(dialog_id, payload)

    
    return payload

@router.get("/{file_id}/download")
def download_file(
    file_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_file = db.get(models.File, file_id)
    if db_file is None:
        raise HTTPException(status_code=404, detail="File not found")

    msg = (
        db.query(models.Message)
        .filter(models.Message.file_id == file_id)
        .first()
    )
    if msg is None:
        raise HTTPException(status_code=404, detail="File not linked to any message")

    participant = (
        db.query(models.DialogParticipant)
        .filter(
            models.DialogParticipant.dialog_id == msg.dialog_id,
            models.DialogParticipant.user_id == current_user.id,
        )
        .first()
    )
    if participant is None:
        raise HTTPException(status_code=403, detail="No access")

    return FileResponse(
        path=db_file.path,
        media_type=db_file.mime_type or "application/octet-stream",
        filename=db_file.original_name,  
    )