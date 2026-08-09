# Football Pool expansion plan

## Approved product rules

- Each roster has 10 numbered slots containing exactly 2 NFL and 8 active FBS teams.
- A participant chooses **Keep** or **Release** for each inherited team before the next draft.
- A keeper occupies the same numbered slot in the new season. A release opens that round's slot and makes the team available.
- Returning seats normally release at least 1 NFL and 2 college teams. Commissioners may override this rule.
- A replacement participant inherits the prior pool seat, roster, and draft position, while historical seasons continue to identify the prior participant.
- New pool seats have ten open slots and receive a commissioner-assigned base order.
- Base order follows the prior final standings from fewest wins to most wins. Odd rounds use base order and even rounds reverse it. Seats with keepers are skipped.
- Picks can be NFL or college in any round, but every completed roster must contain exactly 2 NFL and 8 college teams.
- The default pick clock is 90 seconds and is configurable before the draft.
- A timeout selects the eligible available team with the best prior-season record: wins descending, losses ascending, ties descending, then team name.
- The browser requests an autopick immediately when its visible clock expires. A server-owned cron worker checks once per minute and advances any expired official turn even when no draft room is open.
- Commissioners may pause, resume, pick for a participant, undo, and correct a draft. Every such action is audited.
- Sign-in is invitation-only using Supabase passwordless email links. League data requires authentication. Member contact information is private.

## Delivery phases

1. Preserve the 2025 production data and characterize current SportsDataIO scoring with fixtures.
2. Establish governance, secret boundaries, versioned migrations, and isolated development infrastructure.
3. Introduce pools, stable pool seats, season participants, season-specific records, and audited lifecycle state.
4. Add Supabase passwordless email links and server-side member/commissioner authorization.
5. Build season setup, FBS eligibility review, succession, and Keep/Release management.
6. Build the deterministic draft engine, quota-aware autopick, and concurrency constraints.
7. Build rehearsal mode and automated 15-seat simulations.
8. Build the responsive draft room: persistent turn status, available-team records and filters, roster slots, full board, and activity feed.
9. Move standings synchronization to immutable season records and verify it against 2025 totals.
10. Add historical final-roster CSV import. Imports without round data are history-only.
11. Rehearse migration and rollback, run human draft rehearsals, and only then cut over production.

## Draft-room acceptance criteria

- Every participant can immediately identify the current drafter, round, pick, timer, and their next expected turn.
- Every available team shows its prior-season W-L-T record and NFL division or college conference.
- Search can explain why an unavailable team is unavailable.
- Every roster clearly distinguishes keepers, open slots, manual picks, and autopicks.
- Mobile users can complete every draft action without a desktop-sized grid.
- Two simultaneous attempts to select the same team yield exactly one committed pick.
- Refreshing or reconnecting reconstructs the canonical state from the server.
- Every completed roster has exactly 2 NFL and 8 college teams.
- Rehearsal activity can never mutate an official draft or roster.

## Draft Test Lab

The commissioner-only test lab is restricted to the synthetic development pool and harness-named rehearsal sessions. It runs database-backed checks for competing player/commissioner picks, pause and resume, expired-clock autopick, reconnect state reconstruction, undo, full 15-seat completion, final 2-NFL/8-college quotas, and official-roster fingerprint isolation.

## Standings tiebreaker

Standings rank by total wins, then the best single NFL team's win total, then the best single college team's win total. An exact tie after those competitive criteria uses player name only for deterministic display until a commissioner records the final order.

## Outstanding data work

### Legacy player invitation and identity claiming

The verified 2025 production snapshot contains 15 complete legacy profiles but
no email addresses. The historical migration therefore preserves those users
and rosters without inventing contact information, and assigns the initial
commissioner by immutable legacy user ID.

Implemented in development:

- Commissioners can assign, correct, or remove an invitation email on an
  unclaimed legacy profile instead of creating a duplicate player.
- The invited user must prove control of the assigned address through a
  Supabase passwordless email link before `auth_user_id` is linked.
- The UI shows the legacy player name and proposed email, distinguishes
  unclaimed, waiting, and claimed profiles, and explains that assigning an
  address does not itself send an email.
- Duplicate emails, already-claimed profiles, and attempts to move an auth
  identity between profiles are rejected.
- Invitation assignment, correction, removal, and first successful claim are
  audited without storing auth links, auth tokens, or email addresses in audit
  metadata.
- Unclaimed profiles remain visible in historical standings but have no
  authenticated access.
- Invitation delivery now has explicit `NEEDS_EMAIL`, `READY_TO_INVITE`,
  `INVITATION_SENT`, `SEND_FAILED`, and `JOINED` states backed by additive,
  nullable timestamps and an attempt counter. Saving an address never implies
  that a message was sent.
- The commissioner UI exposes send, resend, and retry controls while delivery
  remains visibly disabled until a verified domain and Resend configuration
  are present. The invitation CTA opens a prefilled passwordless login; it never embeds
  an auth token.
- Invitation send requests are commissioner-only, idempotent per player and
  attempt, and audited without storing provider responses or credentials.

Remaining before member onboarding:

- Exercise the full Supabase email-link claim with a real legacy-player address in
  development once outbound email is configured.
- Verify a sending domain, connect Resend to Supabase SMTP for auth-link delivery,
  and add the server-only Resend invitation variables documented in
  `.env.example` before enabling outbound invitations.
- Add a separate, explicit account-recovery workflow before allowing the email
  or auth identity on a claimed profile to change.

### CFB standings and historical preservation

The configured SportsDataIO subscription exposes current aggregate FBS records through `LeagueHierarchy`, but it does not expose the season-specific CFB standings, historical schedules, or postseason game feeds. The application therefore retains the established aggregate source for active-season college W-L-T totals and stores each finalized season as the durable historical record. It does not claim a regular/postseason split for college teams.

The read-only 2025 comparison passed in development: all 138 active FBS aggregate records matched the preserved 2025 team records exactly, and zero finalized standings rows changed. NFL validation also matched all 32 teams.

Before a new season can write college standings, the sync compares the provider snapshot with the most recent prior season. If the complete snapshot is unchanged, the provider has not rolled over and the write is rejected. Malformed records, duplicate teams, invalid totals, implausible FBS counts, and unmapped teams are also rejected before any write.

Remaining operational checks:

- Observe the first real 2026 CFB update and confirm the rollover guard releases only after the provider changes the aggregate snapshot.
- Verify representative records during the first two weeks and after conference championship, bowl, and playoff results.
- Keep finalized seasons immutable unless a commissioner explicitly reopens them through an audited workflow.
- Treat season-specific historical replay as an optional future capability requiring additional SportsDataIO entitlement; it is not required to preserve or display saved historical seasons.

Implemented in development:

- The commissioner standings workspace can run NFL, college, or combined synchronization for any mutable season.
- Every manual or scheduled attempt records its requester, source scope, start/completion time, success/partial/failure state, updated counts, and sanitized errors without retaining provider payloads or credentials.
- NFL synchronization rejects the feed before writing unless it contains 32 unique, season-matched teams with valid nonnegative records. Regular and postseason totals remain separately recorded and are combined for pool scoring.
- College synchronization validates the official aggregate FBS catalog, rejects incomplete or invalid snapshots, and blocks an unchanged prior-season snapshot from being written into a new season.
- Provider requests bypass application caching and time out instead of leaving a commissioner action pending indefinitely.
- Empty or unavailable feeds are recorded as failed attempts with zero writes and a commissioner-readable availability message.
- Finalized seasons expose a separate read-only validation action. It recalculates NFL and college totals from SportsDataIO, compares them team-by-team with preserved records, retains match/mismatch/missing-team results, and records that zero standings rows changed.
- Finalized seasons remain immutable and direct commissioners to the audited reopen workflow for corrections.
