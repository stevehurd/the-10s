# The 10s Design System

## Direction

The 10s should feel like an editorial football publication fused with a live draft board. The interface is direct, athletic, information-rich, and confident. Its palette is inspired by classic Denver football colors without using team marks or copying a team identity.

Team marks, records, standings, and people are the content. Interface chrome stays quiet so those elements carry the energy.

## Themes

Both themes are first-class and must retain identical hierarchy, spacing, and functionality.

- Light: cool-cloud `#f4f6fb` canvas, white working surfaces, deep-navy ink `#080d24`, blue-gray hairlines.
- Dark: midnight `#070a18` canvas, navy `#0e1530` working surfaces, cool-white text, blue-charcoal hairlines.
- A saved explicit choice overrides the operating-system preference.
- Never communicate state through theme-dependent color alone.

## Color roles

- Primary ink: `#080d24` light, `#f7f8fc` dark
- Canvas: `#f4f6fb` light, `#070a18` dark
- Raised surface: `#ffffff` light, `#0e1530` dark
- Hairline: `#c8cedd` light, `#2b365d` dark
- Muted text: `#68738e` light, `#a5aec6` dark
- Classic blue: `#001489`; use brighter `#1b32b0` or `#91a1ff` where dark-mode contrast requires it
- Classic orange: `#fa4616`; use darker `#c42f07` for small text on light surfaces and lighter `#ff8a68` on dark surfaces
- Powder blue support: `#e1e6ff` light, `#111b5a` dark
- Warm cream support: `#fff3ee` light, `#2b1007` dark
- Celebration gold: `#f6c453` dark, `#966000` light
- Success mint: `#066544` light, `#6bd8af` dark
- Warning: competition orange plus explicit warning text
- Error: `#d30005` light, `#fb7185` dark
- Info: `#1151ff` light, `#93c5fd` dark

Use classic blue for primary actions, navigation, selection, and key totals. Use classic orange for urgency, countdowns, commissioner attention, and high-energy moments. Gold is reserved for winners and exceptional milestones. Reserve mint for explicit success states. Team logos should still provide most of the page-level color.

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
