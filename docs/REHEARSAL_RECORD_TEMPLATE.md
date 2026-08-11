# Production-data rehearsal record (private copy only)

Copy this file outside the repository before filling it in. Do not enter player
emails, database URLs, API keys, passwords, or 1Password references here.

## Source and authorization

- Explicit production-backup approval date/time:
- Operator:
- Source deployment label:
- Source database provider:
- Production write activity paused: yes / no / not required for snapshot

## Backup evidence

- Archive creation time (UTC):
- Archive location (outside repository):
- Archive byte size:
- Archive SHA-256:
- Included schema: `public`
- Restore command independently reviewed by:

## Isolated target

- Rehearsal project label:
- Evidence target is not production:
- Rehearsal preview URL:
- Production credentials absent from preview: yes / no
- Contact/auth fields sanitized before preview: yes / no
- Real player names intentionally retained: yes / no

## Migration

- Git commit SHA:
- Prisma migration check result:
- Legacy baseline resolution result:
- Prisma deploy result:
- 2025 preflight source fingerprint:
- Commissioner legacy user ID confirmed privately: yes / no
- Apply start/end time (UTC):
- Reconciliation result:

## Acceptance checks

- 2025 participant count matches production:
- Every 2025 roster is 2 NFL + 8 college:
- Every numbered roster slot matches production:
- Every team W-L-T record matches production:
- Every player win total and final rank matches production:
- Player names match production:
- 2025 is finalized and mutation is rejected:
- 2026 created through commissioner UI in `SETUP`:
- 2026 participants and inherited slots are correct:
- 2026 draft order defaults to reverse 2025 standings:
- Keep/Release begins pending:
- SportsDataIO `LeagueHierarchy` active FBS total:
- Unchanged / changed / new / removed counts:
- Unchanged teams auto-approved:
- Only changed/new/removed teams require review:
- Pac-12 contains Boise State, Colorado State, Fresno State, Oregon State, San Diego State, Texas State, Utah State, and Washington State:
- Re-sync preserves a test commissioner override:
- 2025 eligibility snapshots and rosters unchanged after 2026 sync:
- Only approved 2026 college teams appear in draft preparation:
- Authentication works with rehearsal-only users:

## Rollback and disposal

- Restore-based rollback test result:
- Acceptance owner/sign-off:
- Temporary unsanitized restore deleted at (UTC):
- Temporary preview/database disposition:
- Follow-up defects:
