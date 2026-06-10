from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://dcuk:dcuk2026@localhost:5433/dcuk_tender"
    secret_key: str = "dcuk-demo-secret-2026"
    upload_dir: str = "./uploads"
    access_token_expire_minutes: int = 1440  # 24 hours

    class Config:
        env_file = ".env"


settings = Settings()
