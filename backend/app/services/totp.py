# app/services/totp.py
import pyotp

def generate_totp_secret() -> str:
    return pyotp.random_base32()

def provisioning_uri(email: str, secret: str, issuer="Resonat") -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)

def verify_totp(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code, valid_window=1)
