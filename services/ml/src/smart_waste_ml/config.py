from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    model_dir: Path = Path("../../ml/artifacts")
    ml_service_token: str = Field(min_length=32)


@lru_cache
def settings() -> Settings:
    return Settings()
