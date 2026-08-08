# Supabase setup checklist

## Architecture

- Supabase Auth owns passwordless email identities and sessions.
- Supabase Postgres stores application data.
- Prisma owns `public` application tables and all application migrations.
- The browser uses only the Supabase project URL and publishable key.
- All application data access goes through authenticated Next.js server code and Prisma. No service-role key is required.

Keeping Prisma as the single schema owner prevents Supabase CLI migrations and Prisma migrations from drifting apart.

## Create the development project

1. Create a new Supabase project named `football-pool-development`. Do not reuse or link the existing production database.
2. In **Connect**, collect:
   - the transaction pooler URL (port `6543`) for `DATABASE_URL`;
   - the session pooler URL (port `5432`) for `DIRECT_URL`.
3. In **Project Settings → API Keys**, collect the project URL and publishable key for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Store the four values in the development 1Password item described in [LOCAL_SETUP.md](./LOCAL_SETUP.md). Do not add a service-role key.
   Also store `DEVELOPMENT_COMMISSIONER_EMAIL`; the synthetic development seed uses it for the first commissioner profile so OTP sign-in can link safely.
5. Run `op run --env-file=.env.op -- npm run supabase:check` before applying a migration.
6. For a new empty development project only, run `op run --env-file=.env.op -- npm run db:setup`, then `op run --env-file=.env.op -- npm run db:seed:demo`.

## Configure email OTP

In **Authentication**:

1. Enable the Email provider and email signups.
2. Set the site URL to `http://localhost:3000` for development.
3. Add `http://localhost:3000/auth/confirm` and the Vercel preview origin as redirect URLs when needed.
4. Set email OTP length to 6 and expiration to 900 seconds.
5. In the Magic Link/OTP template, use `{{ .Token }}` rather than a confirmation link. The local version is [magic-link.html](../supabase/templates/magic-link.html).
6. Keep anonymous and phone sign-ins disabled.

Supabase's built-in hosted mailer is only suitable for initial testing: it has tight limits and may only send to project-team addresses. A custom SMTP provider is required before real pool members test sign-in. This does not require Twilio; Resend, Postmark, AWS SES, Brevo, and other SMTP providers work. Keep SMTP credentials in 1Password and configure them directly in Supabase—never in browser-exposed environment variables.

## User access model

A successful OTP proves control of an email address but does not grant league access. A commissioner must first create the member profile using that exact email. On first verified sign-in, the app links the Supabase Auth UUID to the existing profile. Users without an active pool membership remain unauthorized.

## Migration safety

- Use `npm run db:migrate` only against an isolated development database while creating a reviewed migration.
- Use `npm run db:deploy` to apply checked-in migrations.
- Do not use `prisma db push`.
- Do not use `supabase db push` for application tables.
- Never run `supabase db reset --linked`.
- Do not link this local Supabase directory to production until the 2025 backup/rehearsal process is complete and production work is explicitly approved.

## Readiness check

`npm run supabase:check` verifies, without printing credentials:

- all required environment variable names are present;
- Supabase Auth health is reachable;
- Prisma can query Postgres.

After it passes, verify one complete OTP flow and confirm that the signed-in member is linked to the expected pre-created profile.
