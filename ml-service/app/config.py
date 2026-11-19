from pydantic_settings import BaseSettings
from pathlib import Path

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str
    API_KEY: str
    MODEL_DIR: str = str(Path(__file__).resolve().parent.parent / "models")
    RETRAIN_INTERVAL_HOURS: int = 6
    PORT: int = 8000
    HOST: str = "127.0.0.1"
    LOG_LEVEL: str = "info"
    CORS_ORIGINS: str = "http://localhost:3000"

    class Config:
        env_file = str(_ENV_FILE)
        env_file_encoding = "utf-8"

    @property
    def model_path(self) -> Path:
        p = Path(self.MODEL_DIR)
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()
