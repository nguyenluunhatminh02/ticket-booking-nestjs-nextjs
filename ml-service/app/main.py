"""
ML Service for Ticket Booking Platform.

A FastAPI microservice that trains and serves scikit-learn ML models:
- Fraud Detection (Isolation Forest)
- Demand Forecasting (Gradient Boosting + Logistic Regression)
- Dynamic Pricing (Gradient Boosting Regressor)

Reads directly from the same PostgreSQL database as the NestJS backend.
Models are persisted to disk and retrained on a configurable schedule.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.database import get_db_session
from app.routes import router
from app.fraud_model import fraud_model
from app.demand_model import demand_model
from app.pricing_model import pricing_model
from app.rate_limit import SlidingWindowRateLimiter

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def scheduled_retrain():
    """Background job: retrain all models periodically."""
    logger.info("Scheduled model retraining started...")
    try:
        with get_db_session() as db:
            fraud_result = fraud_model.train(db)
            logger.info(f"Fraud model: {fraud_result['status']}")

            demand_result = demand_model.train(db)
            logger.info(f"Demand model: {demand_result['status']}")

            pricing_result = pricing_model.train(db)
            logger.info(f"Pricing model: {pricing_result['status']}")
    except Exception as e:
        logger.error(f"Scheduled retraining failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initial training attempt
    logger.info("ML Service starting up...")
    try:
        with get_db_session() as db:
            fraud_model.train(db)
            demand_model.train(db)
            pricing_model.train(db)
        logger.info("Initial model training complete")
    except Exception as e:
        logger.warning(f"Initial training failed (will retry on schedule): {e}")

    # Schedule periodic retraining
    scheduler.add_job(
        scheduled_retrain,
        "interval",
        hours=settings.RETRAIN_INTERVAL_HOURS,
        id="retrain_all",
        replace_existing=True,
    )
    if not scheduler.running:
        scheduler.start()
    logger.info(
        f"Scheduled retraining every {settings.RETRAIN_INTERVAL_HOURS}h"
    )

    yield

    # Shutdown
    scheduler.shutdown(wait=True)
    logger.info("ML Service shutting down")


app = FastAPI(
    title="Ticket Booking ML Service",
    description=(
        "Machine Learning microservice for fraud detection, "
        "demand forecasting, and dynamic pricing optimization."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)

rate_limiter = SlidingWindowRateLimiter(max_requests=120, window_seconds=60)


@app.middleware("http")
async def rate_limit_middleware(request, call_next):
    if request.url.path.endswith("/health"):
        return await call_next(request)
    client_ip = request.client.host if request.client else "unknown"
    if not rate_limiter.allow(client_ip):
        return JSONResponse(status_code=429, content={"detail": "Too many requests"})
    return await call_next(request)


# Routes
app.include_router(router, prefix="/api/ml")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level=settings.LOG_LEVEL,
    )
