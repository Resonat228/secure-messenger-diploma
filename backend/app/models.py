import uuid
from sqlalchemy import Column, DateTime, Boolean, ForeignKey, String, Text, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Column, Boolean, DateTime, ForeignKey, func
from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    totp_secret = Column(String, nullable=True)
    public_key = Column(String, nullable=True)

    dialog_participants = relationship(
        "DialogParticipant",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    messages = relationship(
        "Message",
        back_populates="sender",
        cascade="all, delete-orphan",
    )


class Dialog(Base):
    __tablename__ = "dialogs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(), 
    )
    is_group = Column(Boolean, default=False, nullable=False)

    participants = relationship(
        "DialogParticipant",
        back_populates="dialog",
        cascade="all, delete-orphan",
    )
    messages = relationship(
        "Message",
        back_populates="dialog",
        cascade="all, delete-orphan",
    )

class DialogParticipant(Base):
    __tablename__ = "dialog_participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    dialog_id = Column(
        UUID(as_uuid=True),
        ForeignKey("dialogs.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    user = relationship("User", back_populates="dialog_participants")
    dialog = relationship("Dialog", back_populates="participants")

class File(Base):
    __tablename__ = "files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    path = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)
    size = Column(Integer, nullable=True)
    is_safe = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())

    owner = relationship("User")

class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dialog_id = Column(UUID(as_uuid=True), ForeignKey("dialogs.id"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    ciphertext = Column(Text, nullable=True)
    nonce = Column(Text, nullable=True)

    file_id = Column(UUID(as_uuid=True), ForeignKey("files.id"), nullable=True)
    file = relationship("File")

    has_links = Column(Boolean, nullable=False, default=False)
    has_files = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, nullable=False, server_default=func.now())

    dialog = relationship("Dialog", back_populates="messages")
    sender = relationship("User")
