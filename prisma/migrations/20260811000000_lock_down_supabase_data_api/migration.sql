-- Football Pool uses Supabase Auth, but all application-table access flows
-- through authorized Next.js handlers and Prisma's server-only connection.
-- Keep the public schema unavailable to Supabase Data API roles.

-- Existing objects may have inherited Supabase's historical automatic grants.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public
  FROM anon, authenticated, service_role;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public
  FROM PUBLIC, anon, authenticated, service_role;

-- Future Prisma-created objects must remain private unless a reviewed migration
-- explicitly opts an object into the Data API.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES
  FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES
  FROM anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS
  FROM PUBLIC, anon, authenticated, service_role;

-- Defense in depth: even if a table grant is accidentally restored later, no
-- Data API role can access application rows without an explicit RLS policy.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_season_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings_sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_team_eligibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
