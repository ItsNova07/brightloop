from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    member2_database_url: str = "sqlite:///./member2.db"
    jwt_secret: str  # required: no default secret in source control
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "brightloop-sms"
    access_token_minutes: int = 60
    reset_token_minutes: int = 30
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173"
    smtp_host: str = "localhost"
    smtp_port: int = 1025
    mail_from: str = "no-reply@brightloop.local"
    admin_username: str | None = None
    admin_email: str | None = None
    admin_password: str | None = None
    rate_limit_enabled: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
