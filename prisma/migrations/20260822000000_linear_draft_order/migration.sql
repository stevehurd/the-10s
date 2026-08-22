-- Existing draft sessions retain the historical snake behavior. The check
-- constraint keeps the application-level draft order type closed and explicit.
ALTER TABLE "public"."draft_sessions"
ADD COLUMN "order_type" TEXT NOT NULL DEFAULT 'SNAKE';

ALTER TABLE "public"."draft_sessions"
ADD CONSTRAINT "draft_sessions_order_type_check"
CHECK ("order_type" IN ('SNAKE', 'LINEAR'));
