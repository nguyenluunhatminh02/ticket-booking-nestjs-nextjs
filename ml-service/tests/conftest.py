import os
import sys
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test_db")
os.environ.setdefault("API_KEY", "test-api-key")
os.environ.setdefault("MODEL_DIR", str(Path(__file__).resolve().parent / "tmp_models"))
os.environ.setdefault("HOST", "127.0.0.1")
os.environ.setdefault("PORT", "8000")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
