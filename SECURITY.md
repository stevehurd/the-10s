# Security policy

## Sensitive data

This application handles private member email addresses, authentication sessions, database credentials, and third-party API credentials. Member contact information is private to commissioners and the member who owns it.

Secrets belong in 1Password as the human-managed source of truth. Local commands should receive development secrets at runtime through 1Password CLI secret references. Production deployments receive separately scoped values through Vercel sensitive environment variables.

Do not commit plaintext `.env` files. `.env.example` documents names only.

## Environment separation

- Development and automated tests use an isolated Supabase project and non-production SportsDataIO credentials where available.
- Production credentials must not be made available to preview deployments.
- Supabase public/anon configuration may be exposed to the browser as designed; secret/service-role credentials are server-only.
- Prisma runtime traffic uses the transaction pooler; schema migrations use the separately scoped session/direct connection.
- Database roles and automation tokens must have the minimum necessary permissions.

## Production operations

Before a production schema migration:

1. Produce and verify an independent database backup.
2. Rehearse the migration against a restored copy.
3. Record row-count and standings checks.
4. Document rollback commands and the decision point for using them.
5. Obtain explicit approval for the production operation.

Commissioner actions that affect draft order, keeper eligibility, picks, season status, or completed standings must be audited.

## Reporting a vulnerability

Do not open a public issue containing credentials, member data, or an exploitable production detail. Contact the repository owner privately with the affected route, impact, reproduction steps, and any suggested mitigation.
