# Release workflow

The deployment path is deliberately small. GitHub verifies changes and Vercel
deploys them; GitHub does not store production deployment or application
credentials.

## Environments

| Environment | Git branch | URL | Data |
| --- | --- | --- | --- |
| Local | `codex/*` or another feature branch | `http://localhost:3000` | Development only |
| Staging | `staging` | `https://staging.league-house.com` | Isolated staging/development services |
| Production | `main` | `https://league-house.com` | Production services |

Never point a local or preview deployment at production credentials or data.

## Normal change

1. Create a feature branch from the latest `staging` branch.
2. Develop and test locally with development credentials supplied through
   1Password.
3. Push the feature branch and open a pull request into `staging`.
4. Wait for the GitHub `Verify` job and Vercel preview deployment to pass.
5. Review the preview and merge into `staging`.
6. Verify the change at `staging.league-house.com`.
7. Open a pull request from `staging` into `main` for a production release.
8. Merge only after required checks pass and the release owner approves the
   production change. Vercel deploys `main` to `league-house.com`.
9. Perform the relevant production smoke checks and record the result.

## Database changes

Database deployment is never an automatic side effect of CI or a Vercel build.
Use versioned Prisma migrations and the repository migration runbook. Rehearse
against staging, document backup and rollback steps, obtain explicit production
approval, and apply the production migration in the sequence required by the
code change. Prefer additive, backward-compatible migrations so the previous
application deployment remains usable during rollback.

## Rollback

For an application-only regression, restore the previous READY production
deployment in Vercel and verify `league-house.com`. Do not roll back a database
migration until its documented data-safety and restore procedure has been
reviewed. Fix forward when reverting the schema could lose or reinterpret data.

## Release ownership

- Pull requests into `main` require passing CI and Vercel checks.
- Production deployments, database changes, DNS changes, cron changes, and
  secret changes require explicit approval.
- Rehearsal drafts remain isolated and can never be promoted into official
  roster records.
