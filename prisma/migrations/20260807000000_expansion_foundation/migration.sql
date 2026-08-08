-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "auth_user_id" TEXT;

-- AlterTable
ALTER TABLE "public"."teams" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sportsdata_global_team_id" TEXT,
ADD COLUMN     "sportsdata_team_id" TEXT,
ADD COLUMN     "ties" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "public"."seasons" ADD COLUMN     "finalized_at" TIMESTAMP(3),
ADD COLUMN     "pool_id" TEXT,
ADD COLUMN     "previous_season_id" TEXT;

-- CreateTable
CREATE TABLE "public"."pools" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pool_memberships" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pool_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pool_seats" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pool_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."season_participants" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "pool_seat_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "base_draft_order" INTEGER,
    "final_rank" INTEGER,
    "total_wins" INTEGER NOT NULL DEFAULT 0,
    "nfl_wins" INTEGER NOT NULL DEFAULT 0,
    "college_wins" INTEGER NOT NULL DEFAULT 0,
    "is_replacement" BOOLEAN NOT NULL DEFAULT false,
    "release_override" BOOLEAN NOT NULL DEFAULT false,
    "decisions_submitted_at" TIMESTAMP(3),
    "decisions_locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_season_records" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "ties" INTEGER NOT NULL DEFAULT 0,
    "regular_wins" INTEGER NOT NULL DEFAULT 0,
    "regular_losses" INTEGER NOT NULL DEFAULT 0,
    "postseason_wins" INTEGER NOT NULL DEFAULT 0,
    "postseason_losses" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'SPORTSDATAIO',
    "source_updated_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_season_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."season_team_eligibility" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'SPORTSDATAIO',
    "review_reason" TEXT,
    "name_snapshot" TEXT NOT NULL,
    "abbreviation_snapshot" TEXT NOT NULL,
    "conference_snapshot" TEXT,
    "division_snapshot" TEXT,
    "league_snapshot" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_team_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roster_slots" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "season_participant_id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "team_id" TEXT,
    "inherited_team_id" TEXT,
    "retention_choice" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT NOT NULL DEFAULT 'DRAFT',
    "decision_at" TIMESTAMP(3),
    "decision_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roster_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."draft_sessions" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'OFFICIAL',
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "pick_seconds" INTEGER NOT NULL DEFAULT 90,
    "starts_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "current_turn_index" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draft_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."draft_turns" (
    "id" TEXT NOT NULL,
    "draft_session_id" TEXT NOT NULL,
    "season_participant_id" TEXT NOT NULL,
    "roster_slot_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "order_in_round" INTEGER NOT NULL,
    "overall_index" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "deadline_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "draft_turns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."draft_selections" (
    "id" TEXT NOT NULL,
    "draft_session_id" TEXT NOT NULL,
    "draft_turn_id" TEXT NOT NULL,
    "season_participant_id" TEXT NOT NULL,
    "roster_slot_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "selection_type" TEXT NOT NULL DEFAULT 'MANUAL',
    "picked_by_user_id" TEXT,
    "prior_wins" INTEGER NOT NULL DEFAULT 0,
    "prior_losses" INTEGER NOT NULL DEFAULT 0,
    "prior_ties" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_events" (
    "id" TEXT NOT NULL,
    "pool_id" TEXT NOT NULL,
    "season_id" TEXT,
    "draft_session_id" TEXT,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pools_slug_key" ON "public"."pools"("slug");

-- CreateIndex
CREATE INDEX "pool_memberships_user_id_idx" ON "public"."pool_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "pool_memberships_pool_id_user_id_key" ON "public"."pool_memberships"("pool_id", "user_id");

-- CreateIndex
CREATE INDEX "pool_seats_pool_id_active_idx" ON "public"."pool_seats"("pool_id", "active");

-- CreateIndex
CREATE INDEX "season_participants_pool_seat_id_idx" ON "public"."season_participants"("pool_seat_id");

-- CreateIndex
CREATE INDEX "season_participants_user_id_idx" ON "public"."season_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "season_participants_season_id_pool_seat_id_key" ON "public"."season_participants"("season_id", "pool_seat_id");

-- CreateIndex
CREATE UNIQUE INDEX "season_participants_season_id_user_id_key" ON "public"."season_participants"("season_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "season_participants_season_id_base_draft_order_key" ON "public"."season_participants"("season_id", "base_draft_order");

-- CreateIndex
CREATE INDEX "team_season_records_team_id_idx" ON "public"."team_season_records"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_season_records_season_id_team_id_key" ON "public"."team_season_records"("season_id", "team_id");

-- CreateIndex
CREATE INDEX "season_team_eligibility_season_id_status_idx" ON "public"."season_team_eligibility"("season_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "season_team_eligibility_season_id_team_id_key" ON "public"."season_team_eligibility"("season_id", "team_id");

-- CreateIndex
CREATE INDEX "roster_slots_season_id_number_idx" ON "public"."roster_slots"("season_id", "number");

-- CreateIndex
CREATE INDEX "roster_slots_inherited_team_id_idx" ON "public"."roster_slots"("inherited_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "roster_slots_season_participant_id_number_key" ON "public"."roster_slots"("season_participant_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "roster_slots_season_id_team_id_key" ON "public"."roster_slots"("season_id", "team_id");

-- CreateIndex
CREATE INDEX "draft_sessions_season_id_mode_status_idx" ON "public"."draft_sessions"("season_id", "mode", "status");

-- CreateIndex
CREATE INDEX "draft_turns_season_participant_id_idx" ON "public"."draft_turns"("season_participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "draft_turns_draft_session_id_overall_index_key" ON "public"."draft_turns"("draft_session_id", "overall_index");

-- CreateIndex
CREATE UNIQUE INDEX "draft_turns_draft_session_id_roster_slot_id_key" ON "public"."draft_turns"("draft_session_id", "roster_slot_id");

-- CreateIndex
CREATE UNIQUE INDEX "draft_selections_draft_turn_id_key" ON "public"."draft_selections"("draft_turn_id");

-- CreateIndex
CREATE INDEX "draft_selections_season_participant_id_idx" ON "public"."draft_selections"("season_participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "draft_selections_draft_session_id_team_id_key" ON "public"."draft_selections"("draft_session_id", "team_id");

-- CreateIndex
CREATE INDEX "audit_events_pool_id_created_at_idx" ON "public"."audit_events"("pool_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_draft_session_id_created_at_idx" ON "public"."audit_events"("draft_session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "public"."users"("auth_user_id");

-- CreateIndex
CREATE INDEX "teams_league_active_idx" ON "public"."teams"("league", "active");

-- CreateIndex
CREATE INDEX "teams_sportsdata_team_id_idx" ON "public"."teams"("sportsdata_team_id");

-- CreateIndex
CREATE INDEX "teams_sportsdata_global_team_id_idx" ON "public"."teams"("sportsdata_global_team_id");

-- CreateIndex
CREATE INDEX "seasons_status_idx" ON "public"."seasons"("status");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_pool_id_year_key" ON "public"."seasons"("pool_id", "year");

-- AddForeignKey
ALTER TABLE "public"."pool_memberships" ADD CONSTRAINT "pool_memberships_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pool_memberships" ADD CONSTRAINT "pool_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pool_seats" ADD CONSTRAINT "pool_seats_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."seasons" ADD CONSTRAINT "seasons_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."seasons" ADD CONSTRAINT "seasons_previous_season_id_fkey" FOREIGN KEY ("previous_season_id") REFERENCES "public"."seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_participants" ADD CONSTRAINT "season_participants_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_participants" ADD CONSTRAINT "season_participants_pool_seat_id_fkey" FOREIGN KEY ("pool_seat_id") REFERENCES "public"."pool_seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_participants" ADD CONSTRAINT "season_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_season_records" ADD CONSTRAINT "team_season_records_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."team_season_records" ADD CONSTRAINT "team_season_records_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_team_eligibility" ADD CONSTRAINT "season_team_eligibility_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_team_eligibility" ADD CONSTRAINT "season_team_eligibility_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."season_team_eligibility" ADD CONSTRAINT "season_team_eligibility_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roster_slots" ADD CONSTRAINT "roster_slots_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roster_slots" ADD CONSTRAINT "roster_slots_season_participant_id_fkey" FOREIGN KEY ("season_participant_id") REFERENCES "public"."season_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roster_slots" ADD CONSTRAINT "roster_slots_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roster_slots" ADD CONSTRAINT "roster_slots_inherited_team_id_fkey" FOREIGN KEY ("inherited_team_id") REFERENCES "public"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."roster_slots" ADD CONSTRAINT "roster_slots_decision_by_user_id_fkey" FOREIGN KEY ("decision_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."draft_sessions" ADD CONSTRAINT "draft_sessions_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."draft_turns" ADD CONSTRAINT "draft_turns_draft_session_id_fkey" FOREIGN KEY ("draft_session_id") REFERENCES "public"."draft_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."draft_turns" ADD CONSTRAINT "draft_turns_season_participant_id_fkey" FOREIGN KEY ("season_participant_id") REFERENCES "public"."season_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."draft_turns" ADD CONSTRAINT "draft_turns_roster_slot_id_fkey" FOREIGN KEY ("roster_slot_id") REFERENCES "public"."roster_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."draft_selections" ADD CONSTRAINT "draft_selections_draft_session_id_fkey" FOREIGN KEY ("draft_session_id") REFERENCES "public"."draft_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."draft_selections" ADD CONSTRAINT "draft_selections_draft_turn_id_fkey" FOREIGN KEY ("draft_turn_id") REFERENCES "public"."draft_turns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."draft_selections" ADD CONSTRAINT "draft_selections_season_participant_id_fkey" FOREIGN KEY ("season_participant_id") REFERENCES "public"."season_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."draft_selections" ADD CONSTRAINT "draft_selections_roster_slot_id_fkey" FOREIGN KEY ("roster_slot_id") REFERENCES "public"."roster_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."draft_selections" ADD CONSTRAINT "draft_selections_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."draft_selections" ADD CONSTRAINT "draft_selections_picked_by_user_id_fkey" FOREIGN KEY ("picked_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_events" ADD CONSTRAINT "audit_events_pool_id_fkey" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_events" ADD CONSTRAINT "audit_events_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_events" ADD CONSTRAINT "audit_events_draft_session_id_fkey" FOREIGN KEY ("draft_session_id") REFERENCES "public"."draft_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
