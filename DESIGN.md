# The 10s Design System

## Direction

The 10s should feel like an editorial football publication fused with a live draft board. The interface is direct, athletic, information-rich, and confident. It borrows the restraint of monochrome sports retail without copying another brand's identity.

Team marks, records, standings, and people are the content. Interface chrome stays quiet so those elements carry the energy.

## Themes

Both themes are first-class and must retain identical hierarchy, spacing, and functionality.

- Light: soft-cloud `#f5f5f5` canvas, white working surfaces, ink `#111111` text, gray hairlines.
- Dark: near-black `#090909` canvas, ink `#111111` working surfaces, soft-cloud text, charcoal hairlines.
- A saved explicit choice overrides the operating-system preference.
- Never communicate state through theme-dependent color alone.

## Color roles

- Primary ink: `#111111`
- Canvas: `#f5f5f5` in light, `#090909` in dark
- Raised surface: `#ffffff` in light, `#111111` in dark
- Hairline: `#cacacb` in light, `#242424` in dark
- Muted text: `#707072` in light, `#9e9ea0` in dark
- Primary cobalt: `#1746b8` light, `#6f98ff` dark
- Competition orange: `#c54910` light, `#ff7a35` dark
- Success green: `#007d48` light, `#6ee7b7` dark
- Warning: competition orange plus explicit warning text
- Error: `#d30005` light, `#fb7185` dark
- Info: `#1151ff` light, `#93c5fd` dark

Use cobalt for primary actions, navigation, selection, and key totals. Use orange for urgency, countdowns, commissioner attention, and celebratory accents. Reserve green for explicit success states. Team logos should still provide most of the page-level color.

## Typography

- UI and body: Inter, Helvetica Neue, Helvetica, Arial, sans-serif.
- Display fallback: Arial Black, Inter Black, Helvetica Neue, sans-serif.
- Major season, champion, and live-draft moments may use oversized uppercase display type with tight line height.
- Ordinary UI should remain calm at 12–16px. Avoid filling the middle with many competing type sizes.
- Totals, clocks, draft positions, and records use tabular numerals.
- Uppercase labels are short, infrequent, and letter-spaced.

## Spacing and layout

- Base spacing unit: 8px.
- Major section rhythm: 48px.
- Dense team grids: 8px gutters.
- Content maximum: 1440px with responsive edge gutters.
- Mobile touch targets are at least 44px.
- Keep standings and roster information scannable without hiding essential data behind hover.

## Shape and depth

- Content sections are flat and separated by spacing or a 1px hairline.
- Do not stack multiple rounded cards inside rounded cards.
- Data cards use 0–12px radius; editorial moments may be square.
- Buttons, filters, status chips, and compact controls may be full pills.
- Avoid decorative drop shadows and gradients. Use contrast, scale, and team imagery for depth.

## Components

### Team identity

- Show the team logo whenever a team name or abbreviation identifies a specific team.
- Use an abbreviation tile if no logo exists.
- Logos are decorative when the adjacent text already names the team.

### Buttons

- Primary: high-contrast filled pill, 48px minimum height.
- Secondary: quiet surface pill.
- Destructive: red only at the point of destructive action.
- Do not present several equally loud primary buttons in one region.

### Standings

- Rank, player, and total wins establish hierarchy in that order.
- Total wins are the hero number; NFL and college subtotals remain internal tie-break data.
- The player's ten teams and their records appear directly with the standing.

### Draft room

- Dark mode is the preferred dramatic presentation, but light mode remains complete.
- Current turn, clock, and available-team decision are the visual priorities.
- Commissioner controls are grouped and visually subordinate until needed.

### Feedback

- Success, warning, and errors use restrained semantic color plus explicit text.
- Loading and empty states explain what is happening and what the user can do next.

## Responsive behavior

- Desktop layouts can be dense and multi-column.
- Tablet layouts reduce columns before reducing readable type.
- Mobile surfaces become single-column; tables may scroll horizontally when their comparisons must remain intact.
- Sticky actions must not cover the final content row and must coexist with the theme control.

## Guardrails

- Do not use another company's logo, proprietary fonts, or signature campaign artwork.
- Do not add color merely for decoration.
- Do not use gradients as a substitute for hierarchy.
- Do not make every container a floating rounded card.
- Do not hide critical draft or roster information for aesthetic minimalism.

## Inspiration

Adapted for this product from the publicly documented monochrome, typography, spacing, and component principles in the Nike-inspired DESIGN.md maintained by the awesome-design-md project. This is a product-specific interpretation, not a reproduction.
