-- AlterTable: Make reservationId optional, add resaleListingId
ALTER TABLE "payments" ALTER COLUMN "reservation_id" DROP NOT NULL;
ALTER TABLE "payments" ADD COLUMN "resale_listing_id" UUID;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_resale_listing_id_fkey" FOREIGN KEY ("resale_listing_id") REFERENCES "resale_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "payments_resale_listing_id_idx" ON "payments"("resale_listing_id");
