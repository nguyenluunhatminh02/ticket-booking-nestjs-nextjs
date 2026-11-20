-- P1-03: At most one active (LISTED or LOCKED) resale listing per ticket.
-- Prisma schema indexes cannot express a partial WHERE clause, so this
-- constraint is maintained as a raw SQL migration.
--
-- Existing data may contain more than one active listing for the same ticket
-- (e.g. created before this invariant existed). Keep the oldest active listing
-- per ticket and cancel the newer duplicates BEFORE creating the unique index.
-- CANCELLED and EXPIRED are both valid "resale_listings_status_enum" values;
-- CANCELLED is used because a duplicate listing was superseded, not timed out.
WITH ranked_active AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY ticket_id
            ORDER BY created_at ASC, id ASC
        ) AS active_rank
    FROM "resale_listings"
    WHERE status IN ('LISTED', 'LOCKED')
)
UPDATE "resale_listings" AS listing
SET status = 'CANCELLED',
    cancelled_at = COALESCE(listing.cancelled_at, CURRENT_TIMESTAMP),
    updated_at = CURRENT_TIMESTAMP
FROM ranked_active
WHERE ranked_active.id = listing.id
  AND ranked_active.active_rank > 1;

CREATE UNIQUE INDEX "resale_listings_one_active_per_ticket_idx"
  ON "resale_listings" ("ticket_id")
  WHERE "status" IN ('LISTED', 'LOCKED');
