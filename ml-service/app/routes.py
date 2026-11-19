"""
FastAPI routes for ML service.
"""

import hmac
import logging
import threading
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.fraud_model import fraud_model
from app.demand_model import demand_model
from app.pricing_model import pricing_model

logger = logging.getLogger(__name__)

router = APIRouter()

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

_training_lock = threading.Lock()


def verify_api_key(api_key: str | None = Security(api_key_header)):
    if not api_key or not hmac.compare_digest(api_key, settings.API_KEY):
        raise HTTPException(status_code=403, detail="Forbidden")


def _train_with_lock(train_fn, db: Session):
    if not _training_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="Training already in progress")
    try:
        return train_fn(db)
    finally:
        _training_lock.release()


@router.get("/health")
def health():
    models = {
        "fraud": "loaded" if fraud_model.model else "not_trained",
        "demand": "loaded" if demand_model.demand_model else "not_trained",
        "pricing": "loaded" if pricing_model.model else "not_trained",
    }
    ready = all(v == "loaded" for v in models.values())
    return JSONResponse(
        status_code=200 if ready else 503,
        content={"status": "healthy" if ready else "models_not_ready", "models": models},
    )


@router.post("/train/all", dependencies=[Depends(verify_api_key)])
def train_all(db: Session = Depends(get_db)):
    def _train_all(session: Session):
        results = {}
        results["fraud"] = fraud_model.train(session)
        results["demand"] = demand_model.train(session)
        results["pricing"] = pricing_model.train(session)
        return results

    return _train_with_lock(_train_all, db)


@router.post("/train/fraud", dependencies=[Depends(verify_api_key)])
def train_fraud(db: Session = Depends(get_db)):
    return _train_with_lock(fraud_model.train, db)


@router.post("/train/demand", dependencies=[Depends(verify_api_key)])
def train_demand(db: Session = Depends(get_db)):
    return _train_with_lock(demand_model.train, db)


@router.post("/train/pricing", dependencies=[Depends(verify_api_key)])
def train_pricing(db: Session = Depends(get_db)):
    return _train_with_lock(pricing_model.train, db)


@router.get("/fraud/analyze/{user_id}", dependencies=[Depends(verify_api_key)])
def analyze_fraud(user_id: UUID, db: Session = Depends(get_db)):
    try:
        return fraud_model.predict(db, str(user_id))
    except Exception:
        logger.exception("Fraud analysis failed for user %s", user_id)
        raise HTTPException(status_code=500, detail="Analysis failed")


@router.get("/fraud/report", dependencies=[Depends(verify_api_key)])
def fraud_report(db: Session = Depends(get_db)):
    try:
        return fraud_model.predict_bulk(db)
    except Exception:
        logger.exception("Bulk fraud report failed")
        raise HTTPException(status_code=500, detail="Report generation failed")


@router.get("/forecast/{event_id}", dependencies=[Depends(verify_api_key)])
def forecast_event(event_id: UUID, db: Session = Depends(get_db)):
    try:
        return demand_model.forecast(db, str(event_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Event not found")
    except Exception:
        logger.exception("Forecast failed for event %s", event_id)
        raise HTTPException(status_code=500, detail="Forecast failed")


@router.get("/forecast/{event_id}/heatmap", dependencies=[Depends(verify_api_key)])
def forecast_heatmap(event_id: UUID, db: Session = Depends(get_db)):
    try:
        return demand_model.get_heatmap(db, str(event_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Event not found")
    except Exception:
        logger.exception("Heatmap failed for event %s", event_id)
        raise HTTPException(status_code=500, detail="Heatmap generation failed")


@router.get("/pricing/{event_id}", dependencies=[Depends(verify_api_key)])
def pricing_signals(event_id: UUID, db: Session = Depends(get_db)):
    try:
        return demand_model.get_pricing_signals(db, str(event_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Event not found")
    except Exception:
        logger.exception("Pricing signals failed for event %s", event_id)
        raise HTTPException(status_code=500, detail="Pricing signals failed")


@router.get("/pricing/{event_id}/tier/{tier_id}", dependencies=[Depends(verify_api_key)])
def tier_price(event_id: UUID, tier_id: UUID, db: Session = Depends(get_db)):
    try:
        return pricing_model.predict_price(db, str(event_id), str(tier_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Event or tier not found")
    except Exception:
        logger.exception("Tier price failed for event %s tier %s", event_id, tier_id)
        raise HTTPException(status_code=500, detail="Price prediction failed")


@router.get("/models/status", dependencies=[Depends(verify_api_key)])
def model_status():
    model_dir = settings.model_path

    def file_info(filename):
        p = model_dir / filename
        if p.exists():
            stat = p.stat()
            return {
                "exists": True,
                "size_kb": round(stat.st_size / 1024, 1),
                "modified": stat.st_mtime,
            }
        return {"exists": False}

    return {
        "fraud_model": file_info("fraud_model.joblib"),
        "fraud_scaler": file_info("fraud_scaler.joblib"),
        "demand_model": file_info("demand_model.joblib"),
        "sellout_model": file_info("sellout_model.joblib"),
        "demand_scaler": file_info("demand_scaler.joblib"),
        "pricing_model": file_info("pricing_model.joblib"),
        "pricing_scaler": file_info("pricing_scaler.joblib"),
    }
