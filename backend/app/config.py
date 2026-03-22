from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Agent Testing Platform"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://vat:vat@localhost:5432/vat"
    redis_url: str = "redis://localhost:6379/0"

    openai_api_key: str = ""

    # Auth (JWT, minimal for now)
    jwt_secret: str = "dev-change-me"
    jwt_algorithm: str = "HS256"

    # Dev-friendly default. In production, set `CORS_ORIGINS` explicitly.
    cors_origins: list[str] = ["*"]

    # SMTP email (optional — invites fall back to link-only if not configured)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    app_base_url: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
