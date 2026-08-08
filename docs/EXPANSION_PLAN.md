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
- Sign-in is invitation-only using Supabase email OTP. League data requires authentication. Member contact information is private.

## Delivery phases

1. Preserve the 2025 production data and characterize current SportsDataIO scoring with fixtures.
2. Establish governance, secret boundaries, versioned migrations, and isolated development infrastructure.
3. Introduce pools, stable pool seats, season participants, season-specific records, and audited lifecycle state.
4. Add Supabase email OTP and server-side member/commissioner authorization.
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
- The invited user must prove control of the assigned address through Supabase
  email OTP before `auth_user_id` is linked.
- The UI shows the legacy player name and proposed email, distinguishes
  unclaimed, waiting, and claimed profiles, and explains that assigning an
  address does not itself send an email.
- Duplicate emails, already-claimed profiles, and attempts to move an auth
  identity between profiles are rejected.
- Invitation assignment, correction, removal, and first successful claim are
  audited without storing OTP codes, auth tokens, or email addresses in audit
  metadata.
- Unclaimed profiles remain visible in historical standings but have no
  authenticated access.
- Invitation delivery now has explicit `NEEDS_EMAIL`, `READY_TO_INVITE`,
  `INVITATION_SENT`, `SEND_FAILED`, and `JOINED` states backed by additive,
  nullable timestamps and an attempt counter. Saving an address never implies
  that a message was sent.
- The commissioner UI exposes send, resend, and retry controls while delivery
  remains visibly disabled until a verified domain and Resend configuration
  are present. The invitation CTA opens a prefilled OTP login; it never embeds
  an auth token.
- Invitation send requests are commissioner-only, idempotent per player and
  attempt, and audited without storing provider responses or credentials.

Remaining before member onboarding:

- Exercise the full Supabase OTP claim with a real legacy-player address in
  development once outbound email is configured.
- Verify a sending domain, connect Resend to Supabase SMTP for OTP delivery,
  and add the server-only Resend invitation variables documented in
  `.env.example` before enabling outbound invitations.
- Add a separate, explicit account-recovery workflow before allowing the email
  or auth identity on a claimed profile to change.

### CFB historical standings and scoring parity — production comparison remains

SportsDataIO documents season-specific schedules and separate regular/postseason standings. The application now calculates college records from final games returned by `Schedules/{season}` and rejects a payload containing another season, duplicate games, invalid final scores, or an implausible FBS catalog. It counts SeasonType 1 regular-season games (including conference championships when classified there) and SeasonType 3 bowls/College Football Playoff games. Ties are recorded without counting as wins. The unversioned `LeagueHierarchy` record is no longer used by production standings synchronization.

The current development subscription may not expose `Schedules/2025`. `LeagueHierarchy` aggregate records remain acceptable only for local draft rehearsals and are explicitly stored without a claimed regular/postseason split.

Before production standings synchronization is approved:

- Confirm the production SportsDataIO subscription includes `Schedules/{season}` for active and required historical seasons.
- Compare the game-derived 2025 totals with the preserved production totals after a read-only production export is explicitly approved.
- Investigate and document every mismatch before approving production synchronization.
- Keep finalized seasons immutable unless a commissioner explicitly reopens them through an audited workflow.

Until the production comparison passes, SportsDataIO-backed local rehearsal data must still be described as aggregate prior-season records rather than production-approved CFB scoring data.
