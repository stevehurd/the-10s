# The 10s Design System

## Direction

The 10s should feel like a friendly group trip app reimagined for a football pool: approachable, lively, spacious, and immediately understandable. It takes cues from welcoming marketplace products without copying another company’s brand, assets, or exact components.

Team marks, records, standings, and people are the content. Interface chrome stays quiet so those elements carry the energy.

## Themes

Both themes are first-class and must retain identical hierarchy, spacing, and functionality.

- Light: warm-cloud `#f7f7f3` canvas, white working surfaces, soft-black `#20231d` text, warm-gray hairlines.
- Dark: soft-black `#121510` canvas, charcoal-olive `#1b1f18` working surfaces, warm-white text, quiet olive-gray hairlines.
- A saved explicit choice overrides the operating-system preference.
- Never communicate state through theme-dependent color alone.

## Color roles

- Primary ink: `#20231d` light, `#f7f8f4` dark
- Canvas: `#f7f7f3` light, `#121510` dark
- Raised surface: `#ffffff` light, `#1b1f18` dark
- Hairline: `#d9ddd5` light, `#353d31` dark
- Muted text: `#6c7367` light, `#a6ada0` dark
- Product primary: tennis-ball green `#ccff00`
- Primary hover: `#b7e500`
- Primary ink: `#20231d`; never place white text on the tennis green
- Success mint: `#066544` light, `#6bd8af` dark
- Warning: restrained amber plus explicit warning text
- Error: restrained red plus explicit error text

Tennis green is the only product accent. Use it for primary actions, selected navigation, the active draft state, focus, and key totals. Do not introduce a second decorative accent. Reserve mint, amber, and red strictly for success, warning, and error states. Team logos provide the rest of the page-level color.

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

- Content cards use a 16px radius, a complete 1px border, and a quiet surface fill.
- Controls use a 12px radius and a minimum 44px touch target.
- Nested data rows use a 12px radius only when they are individually actionable or selectable.
- Do not stack multiple rounded cards inside rounded cards.
- Full pills are reserved for filters, statuses, avatars, and rank markers. They are not the default button shape.
- Adjacent surfaces at the same hierarchy must use the same radius and border treatment.
- Avoid decorative drop shadows and gradients. Use contrast, scale, and team imagery for depth.

## Components

### Team identity

- Show the team logo whenever a team name or abbreviation identifies a specific team.
- Use an abbreviation tile if no logo exists.
- Logos are decorative when the adjacent text already names the team.

### Buttons

- Primary: tennis-green fill, soft-black label, 12px radius, 48px preferred height.
- Secondary: quiet surface, complete hairline border, soft-black or warm-white label, 12px radius.
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

The system is informed by approachable marketplace products: generous whitespace, friendly geometry, obvious actions, calm neutral surfaces, and concise feedback. This is a product-specific interpretation, not a reproduction of another company’s design system.
