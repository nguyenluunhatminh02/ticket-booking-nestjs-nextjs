-- Add the indexes declared by the @@index attributes in schema.prisma.
-- IF NOT EXISTS keeps this migration safe on databases where an equivalent
-- index was already created manually.
CREATE INDEX IF NOT EXISTS "reservations_user_id_created_at_idx" ON "reservations"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "reservations_status_expires_at_idx" ON "reservations"("status", "expires_at");

CREATE INDEX IF NOT EXISTS "tickets_user_id_issued_at_idx" ON "tickets"("user_id", "issued_at");
CREATE INDEX IF NOT EXISTS "tickets_reservation_id_status_idx" ON "tickets"("reservation_id", "status");

CREATE INDEX IF NOT EXISTS "payments_reservation_id_status_created_at_idx" ON "payments"("reservation_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "payments_user_id_status_idx" ON "payments"("user_id", "status");

CREATE INDEX IF NOT EXISTS "resale_listings_seller_id_status_idx" ON "resale_listings"("seller_id", "status");
CREATE INDEX IF NOT EXISTS "resale_listings_status_lock_expires_at_idx" ON "resale_listings"("status", "lock_expires_at");

CREATE INDEX IF NOT EXISTS "check_ins_event_id_checked_in_at_idx" ON "check_ins"("event_id", "checked_in_at");

CREATE INDEX IF NOT EXISTS "queue_entries_event_id_user_id_status_idx" ON "queue_entries"("event_id", "user_id", "status");
CREATE INDEX IF NOT EXISTS "queue_entries_event_id_status_position_idx" ON "queue_entries"("event_id", "status", "position");
