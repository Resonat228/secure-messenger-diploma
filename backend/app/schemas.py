# app/schemas.py (фрагменты)

from datetime import datetime
from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Any
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr
    username: str | None = None
    password: str
    public_key: str | None = None

class UserShort(BaseModel):
    id: UUID
    email: str
    public_key: str | None = None

    class Config:
        from_attributes = True

class UserOut(BaseModel):
    id: UUID
    email: EmailStr
    username: str

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class PublicKeyIn(BaseModel):
    public_key: str


class PublicKeyOut(BaseModel):
    user_id: UUID
    public_key: str

# ==== Диалоги ====


class DialogCreate(BaseModel):
    target_user_id: UUID


class DialogOut(BaseModel):
    id: UUID
    is_group: bool
    created_at: datetime
    other_user_email: str | None = None
    other_user_public_key: str | None = None
    
    other_user_id: UUID | None = None
    other_user_email: str | None = None
    other_user_public_key: str | None = None

# ==== Сообщения ====


class MessageCreate(BaseModel):
    dialog_id: str
    ciphertext: str
    nonce: str
    has_links: bool = False
    has_files: bool = False


class MessageOut(BaseModel):
    id: UUID
    dialog_id: UUID
    sender_id: UUID
    ciphertext: str | None = None
    nonce: str | None = None
    has_links: bool = False
    has_files: bool = False
    created_at: datetime
    file: FileMetaOut | None = None

    class Config:
        from_attributes = True

class FileMetaOut(BaseModel):
    id: UUID
    url: str
    filename: str
    size: int | None = None
    mime: str | None = None
