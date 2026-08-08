-- Additive invitation-delivery state. Existing user identities and historical
-- roster records are intentionally left unchanged.
ALTER TABLE "public"."users"
ADD COLUMN "invitation_sent_at" TIMESTAMP(3),
ADD COLUMN "invitation_failed_at" TIMESTAMP(3),
ADD COLUMN "invitation_claimed_at" TIMESTAMP(3),
ADD COLUMN "invitation_send_attempts" INTEGER NOT NULL DEFAULT 0;
