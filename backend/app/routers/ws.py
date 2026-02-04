# app/routers/ws.py

from typing import Dict, List
from uuid import UUID
from typing import Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from ..deps import get_db
from .. import models
from ..security import verify_access_token

router = APIRouter(
    prefix="/ws",
    tags=["ws"],
)

active_connections: Dict[UUID, List[WebSocket]] = {}


def _add_connection(dialog_id: UUID, ws: WebSocket) -> None:
    conns = active_connections.get(dialog_id)
    if conns is None:
        conns = []
        active_connections[dialog_id] = conns
    conns.append(ws)


def _remove_connection(dialog_id: UUID, ws: WebSocket) -> None:
    conns = active_connections.get(dialog_id)
    if not conns:
        return
    if ws in conns:
        conns.remove(ws)
    if not conns:
        active_connections.pop(dialog_id, None)

async def broadcast_dialog(dialog_id: UUID, payload: dict[str, Any]) -> None:
    for conn in list(active_connections.get(dialog_id, [])):
        try:
            await conn.send_json(payload)
        except RuntimeError:
            _remove_connection(dialog_id, conn)


@router.websocket("/dialog/{dialog_id}")
async def dialog_ws(
    websocket: WebSocket,
    dialog_id: UUID,
    db: Session = Depends(get_db),
):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008) 
        return

    user_id_str = verify_access_token(token)
    if user_id_str is None:
        await websocket.close(code=1008)
        return

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        await websocket.close(code=1008)
        return

    dialog = db.get(models.Dialog, dialog_id)
    if dialog is None:
        await websocket.close(code=1008)
        return

    participant = (
        db.query(models.DialogParticipant)
        .filter(
            models.DialogParticipant.dialog_id == dialog_id,
            models.DialogParticipant.user_id == user_id,
        )
        .first()
    )
    if participant is None:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    _add_connection(dialog_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()

            ciphertext = data.get("ciphertext")
            nonce = data.get("nonce")
            has_links = bool(data.get("has_links", False))
            has_files = bool(data.get("has_files", False))

            if not ciphertext or not nonce:
                continue

            message = models.Message(
                dialog_id=dialog_id,
                sender_id=user_id,
                ciphertext=ciphertext,
                nonce=nonce,
                has_links=has_links,
                has_files=has_files,
            )
            db.add(message)
            db.commit()
            db.refresh(message)

            payload = {
                "id": str(message.id),
                "dialog_id": str(message.dialog_id),
                "sender_id": str(message.sender_id),
                "ciphertext": message.ciphertext,
                "nonce": message.nonce,
                "has_links": message.has_links,
                "has_files": message.has_files,
                "created_at": message.created_at.isoformat() if message.created_at else None,
            }

            await broadcast_dialog(dialog_id, payload)

    except WebSocketDisconnect:
        _remove_connection(dialog_id, websocket)
