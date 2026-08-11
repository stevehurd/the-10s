-- CreateTable
CREATE TABLE "public"."standings_sync_runs" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "requested_by_user_id" TEXT,
    "requested_league" TEXT NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "updated_teams" INTEGER NOT NULL DEFAULT 0,
    "nfl_records" INTEGER NOT NULL DEFAULT 0,
    "college_records" INTEGER NOT NULL DEFAULT 0,
    "messages" JSONB,
    "errors" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "standings_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "standings_sync_runs_season_id_started_at_idx" ON "public"."standings_sync_runs"("season_id", "started_at");

-- CreateIndex
CREATE INDEX "standings_sync_runs_status_started_at_idx" ON "public"."standings_sync_runs"("status", "started_at");

-- AddForeignKey
ALTER TABLE "public"."standings_sync_runs" ADD CONSTRAINT "standings_sync_runs_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."standings_sync_runs" ADD CONSTRAINT "standings_sync_runs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
