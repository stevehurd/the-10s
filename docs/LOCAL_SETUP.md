# Local development with Supabase and 1Password

The application uses Supabase for Auth and hosted Postgres. Prisma remains the only owner of the application schema and migration history.

## Fast local stack

Prerequisites: Node 20+ and Docker Desktop.

1. Start Docker Desktop.
2. Run `npm run supabase:start`.
3. Run `npm run supabase:status` to find the local API, database, Studio, and Mailpit values. Do not paste those values into source files or chat.
4. Put the four required values in an ignored `.env.local` file using the names in `.env.example`. For the local stack, `DATABASE_URL` and `DIRECT_URL` can use the same local database URL.
5. Run `npm run db:setup` to apply the reviewed Prisma migrations.
6. Run `npm run db:seed:demo` to create the fully synthetic 15-person development pool, or `npm run db:seed:sportsdata` to use real SportsDataIO team identities and prior-season records with synthetic people and roster assignments.
7. Run `npm run supabase:check`, then `npm run dev`.
8. Open `http://127.0.0.1:54324` to read locally captured OTP emails. Local emails are never delivered externally.

Use `npm run supabase:stop` when finished. Do not use `supabase db reset --linked`; it destroys a linked remote database.

## Hosted development project

Use a dedicated non-production Supabase project. Follow [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) before connecting it to the app. Never point preview or local commands at the production project.

## 1Password flow

Create a 1Password item named `Football Pool Development` with these fields:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `DATABASE_URL`
- `DIRECT_URL`
- `DEVELOPMENT_COMMISSIONER_EMAIL`
- `SPORTSDATA_API_KEY`
- `CRON_SECRET`

Create an ignored `.env.op` file containing only references, not values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=op://Football Pool - 10s/Football Pool Development/NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=op://Football Pool - 10s/Football Pool Development/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
DATABASE_URL=op://Football Pool - 10s/Football Pool Development/DATABASE_URL
DIRECT_URL=op://Football Pool - 10s/Football Pool Development/DIRECT_URL
DEVELOPMENT_COMMISSIONER_EMAIL=op://Football Pool - 10s/Football Pool Development/DEVELOPMENT_COMMISSIONER_EMAIL
SPORTSDATA_API_KEY=op://Football Pool - 10s/Football Pool Development/SPORTSDATA_API_KEY
CRON_SECRET=op://Football Pool - 10s/Football Pool Development/CRON_SECRET
```

Then run commands with values injected only into the child process:

```sh
op run --env-file=.env.op -- npm run supabase:check
op run --env-file=.env.op -- npm run db:setup
op run --env-file=.env.op -- npm run db:seed:sportsdata
op run --env-file=.env.op -- npm run dev
```

The SportsDataIO seed refuses incomplete feeds before opening its database transaction. It expects 32 active NFL teams and 120-160 active FBS teams. It resets only the pool with slug `the-10s-development`; never use the command with production database URLs.

The public Supabase URL and publishable key are intentionally browser-safe. Database URLs, SportsDataIO keys, cron secrets, SMTP passwords, and any Supabase secret/service-role key are server-only. The application does not require a service-role key.

AI tools working in this repository are prohibited from invoking or reading 1Password references without explicit approval. A human can use the commands normally.

## Production boundary

Production gets a separate Supabase project and a separate 1Password item. Vercel receives production values as sensitive environment variables; preview deployments must use development values. The legacy 2025 migration must follow [MIGRATION_RUNBOOK.md](./MIGRATION_RUNBOOK.md) and cannot be replaced by `db:setup`.
