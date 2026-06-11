from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://acs:acs2026@localhost:5433/acs_tender"
    secret_key: str = "acs-demo-secret-2026"
    upload_dir: str = "./uploads"
    access_token_expire_minutes: int = 1440  # 24 hours

    class Config:
        env_file = ".env"


settings = Settings()
