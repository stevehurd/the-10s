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

### CFB historical standings and scoring parity — release blocker

The current SportsDataIO development key does not expose the season-specific CFB `Standings/2025` or `Schedules/2025` endpoints. `LeagueHierarchy` returns 138 active FBS teams with completed aggregate W-L-T records, which is sufficient for realistic keeper and draft rehearsals, but it does not provide a trustworthy regular-season versus postseason split.

Before production standings synchronization is approved:

- Confirm the SportsDataIO product/feed that provides season-specific CFB results for the required historical and active seasons, or derive records from finalized game results.
- Count regular-season games, conference championships, bowls, and College Football Playoff games; record ties without counting them as wins.
- Verify the feed's season identifier so a current hierarchy response can never be written into the wrong season.
- Create fixture-based regression cases for both regular and postseason CFB results and compare the calculated 2025 totals with the preserved production totals.
- Store aggregate and regular/postseason fields accurately in `TeamSeasonRecord`, including source and source-update timestamps.
- Keep finalized seasons immutable unless a commissioner explicitly reopens them through an audited workflow.

Until these checks pass, SportsDataIO-backed local rehearsal data must be described as aggregate prior-season records, not as a fully characterized production CFB scoring feed.
