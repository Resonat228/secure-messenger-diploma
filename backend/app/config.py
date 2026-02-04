from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:360024@localhost:5432/resonat"

    JWT_SECRET: str = "super-secret-change-me"
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    MEDIA_ROOT: str = "media"

    class Config:
        env_file = ".env"


settings = Settings()
