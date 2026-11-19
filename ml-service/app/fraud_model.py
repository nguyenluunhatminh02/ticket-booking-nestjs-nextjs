"""
Fraud Detection ML Model — trains a real scikit-learn model on booking data.

Features extracted per user:
  1. booking_velocity     – bookings in last 10 min
  2. cancel_ratio         – cancelled / total reservations
  3. payment_fail_ratio   – failed / total payments
  4. total_tickets_30d    – tickets purchased in 30 days
  5. night_booking_ratio  – % of bookings between 2-5 AM
  6. avg_amount           – average reservation amount
  7. unique_events        – distinct events booked
  8. time_since_first     – days since first booking

Training approach:
  - We use an Isolation Forest for anomaly detection (unsupervised).
  - Once we accumulate labeled data (admin-flagged), we switch to
    a Gradient Boosting Classifier (supervised).
  - Model is retrained periodically and persisted to disk.
"""

import logging
import numpy as np
import joblib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy import func, case, distinct, extract
from sqlalchemy.orm import Session

from sklearn.ensemble import IsolationForest, GradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from app.models_db import Reservation, Payment, ReservationStatus, PaymentStatus
from app.config import settings

logger = logging.getLogger(__name__)

FEATURE_NAMES = [
    "booking_velocity_10m",
    "cancel_ratio",
    "payment_fail_ratio",
    "total_tickets_30d",
    "night_booking_ratio",
    "avg_amount",
    "unique_events",
    "days_since_first_booking",
]

MODEL_FILE = "fraud_model.joblib"
SCALER_FILE = "fraud_scaler.joblib"


class FraudModel:
    """Wraps the fraud detection ML pipeline."""

    def __init__(self):
        self.model: Optional[Pipeline] = None
        self.scaler: Optional[StandardScaler] = None
        self._load_model()

    def _model_path(self, filename: str) -> Path:
        return settings.model_path / filename

    def _load_model(self):
        model_p = self._model_path(MODEL_FILE)
        scaler_p = self._model_path(SCALER_FILE)
        if model_p.exists() and scaler_p.exists():
            self.model = joblib.load(model_p)
            self.scaler = joblib.load(scaler_p)
            logger.info("Fraud model loaded from disk")
        else:
            logger.info("No trained fraud model found — will train on first call")

    def _save_model(self):
        if self.model and self.scaler:
            joblib.dump(self.model, self._model_path(MODEL_FILE))
            joblib.dump(self.scaler, self._model_path(SCALER_FILE))
            logger.info("Fraud model saved to disk")

    # ── Feature extraction ───────────────────────────────────────────────────

    def extract_user_features(self, db: Session, user_id: str) -> dict:
        """Extract ML features for a single user."""
        now = datetime.now(timezone.utc)
        ten_min_ago = now - timedelta(minutes=10)
        thirty_days_ago = now - timedelta(days=30)

        # booking_velocity_10m
        velocity = (
            db.query(func.count(Reservation.id))
            .filter(Reservation.user_id == user_id, Reservation.created_at >= ten_min_ago)
            .scalar() or 0
        )

        # Overall reservation stats
        total_reservations = (
            db.query(func.count(Reservation.id))
            .filter(Reservation.user_id == user_id)
            .scalar() or 0
        )
        cancelled = (
            db.query(func.count(Reservation.id))
            .filter(
                Reservation.user_id == user_id,
                Reservation.status == ReservationStatus.CANCELLED,
            )
            .scalar() or 0
        )
        cancel_ratio = cancelled / max(total_reservations, 1)

        # Payment failure ratio
        total_payments = (
            db.query(func.count(Payment.id))
            .filter(Payment.user_id == user_id)
            .scalar() or 0
        )
        failed_payments = (
            db.query(func.count(Payment.id))
            .filter(Payment.user_id == user_id, Payment.status == PaymentStatus.FAILED)
            .scalar() or 0
        )
        payment_fail_ratio = failed_payments / max(total_payments, 1)

        # total_tickets_30d
        tickets_30d = (
            db.query(func.coalesce(func.sum(Reservation.ticket_count), 0))
            .filter(
                Reservation.user_id == user_id,
                Reservation.created_at >= thirty_days_ago,
                Reservation.status.in_([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
            )
            .scalar() or 0
        )

        # night_booking_ratio (2-5 AM)
        night_bookings = (
            db.query(func.count(Reservation.id))
            .filter(
                Reservation.user_id == user_id,
                extract("hour", Reservation.created_at).between(2, 4),
            )
            .scalar() or 0
        )
        night_ratio = night_bookings / max(total_reservations, 1)

        # avg_amount
        avg_amount = (
            db.query(func.avg(Reservation.total_amount))
            .filter(Reservation.user_id == user_id)
            .scalar()
        )
        avg_amount = float(avg_amount) if avg_amount else 0.0

        # unique_events
        unique_events = (
            db.query(func.count(distinct(Reservation.event_id)))
            .filter(Reservation.user_id == user_id)
            .scalar() or 0
        )

        # days_since_first_booking
        first_booking = (
            db.query(func.min(Reservation.created_at))
            .filter(Reservation.user_id == user_id)
            .scalar()
        )
        if first_booking:
            if first_booking.tzinfo is None:
                first_booking = first_booking.replace(tzinfo=timezone.utc)
            days_since = (now - first_booking).days
        else:
            days_since = 0

        return {
            "booking_velocity_10m": velocity,
            "cancel_ratio": round(cancel_ratio, 4),
            "payment_fail_ratio": round(payment_fail_ratio, 4),
            "total_tickets_30d": int(tickets_30d),
            "night_booking_ratio": round(night_ratio, 4),
            "avg_amount": round(avg_amount, 2),
            "unique_events": unique_events,
            "days_since_first_booking": days_since,
        }

    def extract_all_user_features(self, db: Session) -> tuple[list[str], np.ndarray]:
        """Extract features for all users with recent activity."""
        since = datetime.now(timezone.utc) - timedelta(days=90)
        user_ids = [
            r[0]
            for r in db.query(distinct(Reservation.user_id))
            .filter(Reservation.created_at >= since)
            .all()
        ]

        if not user_ids:
            return [], np.array([])

        rows = []
        valid_ids = []
        for uid in user_ids:
            feats = self.extract_user_features(db, uid)
            rows.append([feats[f] for f in FEATURE_NAMES])
            valid_ids.append(uid)

        return valid_ids, np.array(rows, dtype=np.float64)

    # ── Training ─────────────────────────────────────────────────────────────

    def train(self, db: Session) -> dict:
        """
        Train the fraud detection model using Isolation Forest (unsupervised).
        Returns training summary.
        """
        user_ids, X = self.extract_all_user_features(db)

        if len(X) < 5:
            return {
                "status": "skipped",
                "reason": f"Not enough data ({len(X)} users, need >= 5)",
                "trained_at": datetime.now(timezone.utc).isoformat(),
            }

        # Fit scaler
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        # Isolation Forest — contamination auto-detected
        contamination = min(0.1, max(0.01, 2 / len(X)))
        self.model = IsolationForest(
            n_estimators=200,
            contamination=contamination,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X_scaled)

        # Compute anomaly scores for summary
        scores = self.model.decision_function(X_scaled)
        predictions = self.model.predict(X_scaled)
        n_anomalies = int((predictions == -1).sum())

        self._save_model()

        logger.info(
            f"Fraud model trained: {len(X)} users, {n_anomalies} anomalies detected"
        )

        return {
            "status": "trained",
            "total_users": len(X),
            "anomalies_detected": n_anomalies,
            "contamination": round(contamination, 4),
            "feature_names": FEATURE_NAMES,
            "score_range": {
                "min": round(float(scores.min()), 4),
                "max": round(float(scores.max()), 4),
                "mean": round(float(scores.mean()), 4),
            },
            "trained_at": datetime.now(timezone.utc).isoformat(),
        }

    # ── Prediction ───────────────────────────────────────────────────────────

    def predict(self, db: Session, user_id: str) -> dict:
        """Predict fraud risk for a single user."""
        features = self.extract_user_features(db, user_id)
        X = np.array([[features[f] for f in FEATURE_NAMES]], dtype=np.float64)

        if self.model is None or self.scaler is None:
            # Fallback: heuristic scoring
            return self._heuristic_score(features, user_id)

        X_scaled = self.scaler.transform(X)
        anomaly_score = float(self.model.decision_function(X_scaled)[0])
        prediction = int(self.model.predict(X_scaled)[0])

        # Convert Isolation Forest score to 0-100 risk score
        # decision_function: negative = anomaly, positive = normal
        # Map [-0.5, 0.5] → [100, 0]
        risk_score = max(0, min(100, int(50 - anomaly_score * 100)))

        risk_level = self._risk_level(risk_score)
        recommendation = self._recommendation(risk_score)

        signals = []
        # Break down signal contributions
        signal_configs = [
            ("VELOCITY", 30, features["booking_velocity_10m"] / 5),
            ("CANCEL_PATTERN", 20, features["cancel_ratio"] / 0.8),
            ("PAYMENT_FAILURES", 25, features["payment_fail_ratio"] / 0.5),
            ("BULK_PURCHASE", 15, min(1, features["total_tickets_30d"] / 20)),
            ("TIME_ANOMALY", 10, features["night_booking_ratio"] / 0.7),
        ]
        for name, weight, raw_value in signal_configs:
            value = max(0, min(1, raw_value))
            signals.append({
                "signal": name,
                "weight": weight,
                "value": round(value, 3),
                "description": self._signal_description(name, features),
            })

        return {
            "userId": user_id,
            "riskScore": risk_score,
            "riskLevel": risk_level,
            "signals": signals,
            "recommendation": recommendation,
            "features": features,
            "mlMetadata": {
                "anomalyScore": round(anomaly_score, 4),
                "isAnomaly": prediction == -1,
                "modelType": "IsolationForest",
            },
            "analyzedAt": datetime.now(timezone.utc).isoformat(),
        }

    def predict_bulk(self, db: Session) -> dict:
        """Bulk fraud analysis for all recent users."""
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        user_ids = [
            r[0]
            for r in db.query(distinct(Reservation.user_id))
            .filter(Reservation.created_at >= since)
            .all()
        ]

        analyses = []
        for uid in user_ids:
            analysis = self.predict(db, uid)
            if analysis["riskScore"] >= 50:
                analyses.append(analysis)

        analyses.sort(key=lambda a: a["riskScore"], reverse=True)

        summary = {
            "low": sum(1 for a in analyses if a["riskLevel"] == "LOW"),
            "medium": sum(1 for a in analyses if a["riskLevel"] == "MEDIUM"),
            "high": sum(1 for a in analyses if a["riskLevel"] == "HIGH"),
            "critical": sum(1 for a in analyses if a["riskLevel"] == "CRITICAL"),
        }

        return {
            "totalUsersAnalyzed": len(user_ids),
            "flaggedUsers": analyses,
            "summary": summary,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _heuristic_score(self, features: dict, user_id: str) -> dict:
        """Fallback scoring when no model is trained yet."""
        score = 0
        score += min(1, features["booking_velocity_10m"] / 5) * 30
        score += (features["cancel_ratio"] / 0.8) * 20
        score += (features["payment_fail_ratio"] / 0.5) * 25
        score += min(1, features["total_tickets_30d"] / 20) * 15
        score += (features["night_booking_ratio"] / 0.7) * 10
        risk_score = max(0, min(100, int(score)))

        return {
            "userId": user_id,
            "riskScore": risk_score,
            "riskLevel": self._risk_level(risk_score),
            "signals": [],
            "recommendation": self._recommendation(risk_score),
            "features": features,
            "mlMetadata": {"modelType": "heuristic_fallback"},
            "analyzedAt": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def _risk_level(score: int) -> str:
        if score >= 80:
            return "CRITICAL"
        if score >= 70:
            return "HIGH"
        if score >= 50:
            return "MEDIUM"
        return "LOW"

    @staticmethod
    def _recommendation(score: int) -> str:
        if score >= 70:
            return "BLOCK"
        if score >= 50:
            return "REVIEW"
        return "ALLOW"

    @staticmethod
    def _signal_description(signal: str, features: dict) -> str:
        descs = {
            "VELOCITY": f"{features['booking_velocity_10m']} bookings in last 10min",
            "CANCEL_PATTERN": f"{features['cancel_ratio']:.0%} cancellation rate",
            "PAYMENT_FAILURES": f"{features['payment_fail_ratio']:.0%} payment failure rate",
            "BULK_PURCHASE": f"{features['total_tickets_30d']} tickets in 30 days",
            "TIME_ANOMALY": f"{features['night_booking_ratio']:.0%} bookings between 2-5 AM",
        }
        return descs.get(signal, "")


# Singleton
fraud_model = FraudModel()
