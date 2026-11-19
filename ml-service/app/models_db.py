"""
SQLAlchemy models mirroring the NestJS TypeORM entities (read-only).
Only the columns needed for ML feature extraction are mapped.
"""

from sqlalchemy import Column, String, Integer, Numeric, DateTime, Enum as SAEnum, text
from sqlalchemy.orm import declarative_base
import enum

Base = declarative_base()


# ── Enums ────────────────────────────────────────────────────────────────────

class ReservationStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REFUNDED = "REFUNDED"


class SeatStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    RESERVED = "RESERVED"
    SOLD = "SOLD"
    BLOCKED = "BLOCKED"


class EventStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ON_SALE = "ON_SALE"
    PRESALE = "PRESALE"
    SOLD_OUT = "SOLD_OUT"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"


# ── Tables ───────────────────────────────────────────────────────────────────

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    event_id = Column(String, nullable=False, index=True)
    status = Column(SAEnum(ReservationStatus, name="reservationstatus", create_type=False))
    total_amount = Column(Numeric(10, 2))
    ticket_count = Column(Integer)
    currency = Column(String, default="USD")
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    discount_amount = Column(Numeric(10, 2), default=0)
    coupon_id = Column(String, nullable=True)


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True)
    reservation_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False, index=True)
    amount = Column(Numeric(10, 2))
    currency = Column(String)
    provider = Column(String)
    status = Column(SAEnum(PaymentStatus, name="paymentstatus", create_type=False))
    failure_reason = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
    completed_at = Column(DateTime(timezone=True), nullable=True)


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True)
    name = Column(String)
    status = Column(SAEnum(EventStatus, name="eventstatus", create_type=False))
    event_date = Column(DateTime(timezone=True), nullable=True)
    total_tickets = Column(Integer, nullable=True)
    available_tickets = Column(Integer, nullable=True)
    category = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))


class TicketTier(Base):
    __tablename__ = "ticket_tiers"

    id = Column(String, primary_key=True)
    event_id = Column(String, nullable=False, index=True)
    name = Column(String)
    price = Column(Numeric(10, 2))
    currency = Column(String, default="USD")
    total_quantity = Column(Integer, nullable=True)
    available_quantity = Column(Integer, nullable=True)


class Seat(Base):
    __tablename__ = "seats"

    id = Column(String, primary_key=True)
    event_id = Column(String, nullable=False, index=True)
    tier_id = Column(String, nullable=True)
    seat_number = Column(Integer)
    row_name = Column(String, nullable=True)
    section = Column(String, nullable=True)
    status = Column(SAEnum(SeatStatus, name="seatstatus", create_type=False))
    price_override = Column(Numeric(10, 2), nullable=True)


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String, primary_key=True)
    ticket_code = Column(String, unique=True)
    user_id = Column(String, nullable=False, index=True)
    event_id = Column(String, nullable=False, index=True)
    tier_id = Column(String, nullable=True)
    seat_id = Column(String, nullable=True)
    status = Column(String)
    issued_at = Column(DateTime(timezone=True), nullable=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("NOW()"))
