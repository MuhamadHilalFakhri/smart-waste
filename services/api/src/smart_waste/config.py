from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./smart_waste.db"
    jwt_secret: str = Field(min_length=32)
    allowed_origins: list[str] = ["http://localhost:3000"]
    cookie_secure: bool = False
    storage_dir: Path = Path("storage")
    model_dir: Path = Path("../../ml/artifacts")
    admin_email: str = "admin@example.com"
    admin_password: str = ""
    access_minutes: int = 15
    refresh_days: int = 7


@lru_cache
def settings() -> Settings:
    return Settings()
