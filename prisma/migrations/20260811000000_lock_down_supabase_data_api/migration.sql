-- Football Pool uses Supabase Auth, but all application-table access flows
-- through authorized Next.js handlers and Prisma's server-only connection.
-- Keep the public schema unavailable to Supabase Data API roles.

-- Existing objects may have inherited Supabase's historical automatic grants.
-- Production currently uses Neon, where Supabase's Data API roles do not
-- exist, so revoke them only when the target database defines them.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

DO $$
DECLARE
  data_api_role name;
BEGIN
  FOR data_api_role IN
    SELECT rolname
    FROM pg_roles
    WHERE rolname = ANY (ARRAY['anon', 'authenticated', 'service_role'])
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I',
      data_api_role
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I',
      data_api_role
    );
    EXECUTE format(
      'REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM %I',
      data_api_role
    );

    -- Future Prisma-created objects must remain private unless a reviewed
    -- migration explicitly opts an object into the Data API. Use the actual
    -- migration owner (`postgres` on Supabase, `neondb_owner` on Neon).
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM %I',
      current_user,
      data_api_role
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE USAGE, SELECT ON SEQUENCES FROM %I',
      current_user,
      data_api_role
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I',
      current_user,
      data_api_role
    );
  END LOOP;

  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
    current_user
  );
END $$;

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
