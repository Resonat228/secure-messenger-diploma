# app/security.py

import bcrypt
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt

from .config import settings


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            hashed.encode("utf-8"),
        )
    except ValueError:
        return False


def create_access_token(sub: str) -> str:
    expire = datetime.utcnow() + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": sub, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALG)


def verify_access_token(token: str) -> Optional[str]:

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALG],
        )
        sub = payload.get("sub")
        if not isinstance(sub, str):
            return None
        return sub
    except JWTError:
        return None
