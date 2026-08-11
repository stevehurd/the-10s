# League House

League House is a private football pool for drafting NFL and FBS college teams,
tracking their wins through the season, and preserving league history from year
to year. It includes passwordless authentication, keeper decisions, a live
snake draft, commissioner tools, season standings, and historical rosters.

- Production: [league-house.com](https://league-house.com)
- Staging: [staging.league-house.com](https://staging.league-house.com)

## How the pool works

Each participant has a ten-team roster for a season:

- 2 NFL teams
- 8 active FBS college teams

Before the next draft, returning participants choose which teams to **Keep** or
**Release**. They must release at least one NFL team and two college teams unless
a commissioner records an override. A keeper remains in the same numbered
roster slot; a release opens that slot in the corresponding draft round.

Draft order begins with the previous season's last-place participant and snakes
each round. Participants with a keeper in a round are skipped. The live draft
supports commissioner controls, pick clocks, queued teams, deterministic
autopicks, rehearsal drafts, and concurrent-pick protection.

NFL regular-season and postseason wins count. College regular-season,
conference championship, bowl, and playoff wins count. Ties are recorded but do
not count as wins. SportsDataIO is the operational source for NFL and FBS team
and standings data.

## Application lifecycle

The dashboard changes with the selected season:

- **Preseason:** keeper decisions, draft order, draft logistics, team research,
  and the live draft.
- **In season:** league standings, player rosters, and team W-L-T records.
- **Complete:** final standings, historical rosters, and the season champion.

Completed seasons are immutable unless a commissioner explicitly reopens one;
any such change must be audited. Rehearsal drafts are permanently isolated from
official roster records.

## Technology

- Next.js 16, React 19, and TypeScript
- Prisma as the sole owner of the application schema and migration history
- PostgreSQL for application and historical data
- Supabase Auth for passwordless email sign-in
- SportsDataIO for NFL and FBS data
- Resend for commissioner-triggered invitation email and Supabase SMTP
- Vercel for Preview, staging, production, and the daily production standings job
- 1Password for development and production credential storage

Supabase owns authentication identities; Prisma-owned `public` tables contain
the pool, membership, season, roster, draft, and audit data. The application
does not use a Supabase service-role key.

## Environments

| Environment | Git source | URL | Services and data |
| --- | --- | --- | --- |
| Local | Feature branch | `http://localhost:3000` | Development credentials and isolated data only |
| Staging | `staging` | `https://staging.league-house.com` | Branch-scoped Preview configuration and non-production services |
| Production | `main` | `https://league-house.com` | Production Supabase, database, email, and SportsDataIO configuration |

Never use production database or authentication credentials in local,
automated-test, or Preview environments.

## Local development

Prerequisites:

- Node.js 22 and npm
- Docker Desktop when using the local Supabase stack
- Supabase CLI
- 1Password CLI with desktop-app integration enabled

Install dependencies:

```sh
npm ci
```

For the local Supabase stack:

```sh
npm run supabase:start
npm run supabase:status
npm run db:setup
npm run db:seed:demo
npm run dev
```

Use `npm run db:seed:sportsdata` instead of the demo seed when real team
identities and prior-season team records are needed. Both seeds are guarded for
development-only use.

For the hosted development environment, keep only 1Password references in the
ignored `.env.op` file and inject values into the child process:

```sh
op run --account my.1password.com --env-file=.env.op -- npm run dev
```

Do not paste credential values into source files, terminal logs, chat, fixtures,
or commits. See [Local development](docs/LOCAL_SETUP.md) for the full Supabase,
Mailpit, SportsDataIO, and 1Password setup.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local Next.js server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm test` | Verify migrations and run the deterministic test suite |
| `npm run build` | Generate Prisma Client and create the production build |
| `npm run db:setup` | Apply reviewed Prisma migrations to development |
| `npm run db:seed:demo` | Seed a fully synthetic development pool |
| `npm run db:seed:sportsdata` | Seed real team data with synthetic people and rosters |
| `npm run db:verify:demo` | Verify the development seed |
| `npm run supabase:check` | Validate the configured Supabase development project |
| `npm run migration:check` | Verify migration files and recorded checksums |

## CI and deployments

GitHub verifies the application; Vercel deploys it. GitHub does not store the
application's production credentials.

The `CI` workflow runs for pull requests into `staging` or `main`, and for
pushes to those branches. Its required `Verify` job performs:

1. `npm ci`
2. `npm run lint`
3. `npm run typecheck`
4. `npm test`
5. `npm run build`

Both `staging` and `main` require pull requests plus successful `Verify` and
Vercel checks. Force pushes and branch deletion are disabled.

The normal promotion path is:

```text
feature branch → pull request to staging → staging verification
               → pull request to main → production deployment
```

1. Branch from the latest `staging`.
2. Develop and test locally with development credentials.
3. Open a pull request into `staging`.
4. Wait for GitHub CI and the Vercel Preview deployment.
5. Merge and verify the fixed staging URL.
6. Open a `staging` → `main` pull request.
7. Merge only after explicit production approval.
8. Verify authentication and the affected workflow on production.

Merging `main` automatically deploys to `league-house.com`. A Vercel deployment
can be rolled back to the previous READY deployment for application-only
regressions. See [Release workflow](docs/RELEASE_WORKFLOW.md) for the complete
promotion and rollback procedure.

## Database and production safety

Database migrations are never run by GitHub CI or a Vercel build. Use versioned
Prisma migrations, rehearse against staging, document backup and rollback steps,
and obtain explicit approval before any production database operation.

Do not use `prisma db push` against a shared or production database. Do not use
`supabase db reset --linked`. Historical team identity, completed standings,
and the original 2025 source records must be preserved.

Changes to the draft engine require deterministic coverage for keeper skipping,
snake order, roster quotas, autopick, ties, and simultaneous-pick protection.
Sports-data changes require fixture-based NFL and college regression tests.
Authorization changes require anonymous, member, and commissioner tests.

## Repository map

| Path | Contents |
| --- | --- |
| `src/app` | Next.js pages, route handlers, and season/draft interfaces |
| `src/lib` | Authorization, draft engine, standings, data rules, and services |
| `src/components` | Shared application UI |
| `prisma` | Prisma schema, reviewed migrations, and migration manifest |
| `scripts` | Development setup, guarded seeds, backup, and migration tooling |
| `.github/workflows/ci.yml` | Required GitHub verification workflow |
| `docs` | Setup, migration, rehearsal, readiness, and release runbooks |

## Operational documentation

- [Local development and 1Password](docs/LOCAL_SETUP.md)
- [Supabase setup](docs/SUPABASE_SETUP.md)
- [Release workflow](docs/RELEASE_WORKFLOW.md)
- [Migration runbook](docs/MIGRATION_RUNBOOK.md)
- [Production readiness checklist](docs/PRODUCTION_READINESS.md)
- [Expansion plan and product rules](docs/EXPANSION_PLAN.md)
- [Rehearsal record template](docs/REHEARSAL_RECORD_TEMPLATE.md)

Repository-wide operating and safety rules for humans and AI tools are in
[`AGENTS.md`](AGENTS.md).
