# Today I Did design system

The UI uses a calm Focus Workspace language. All reusable values live in `:root` in `styles.css`; the light theme overrides only color tokens.

## Color tokens

| Token | Purpose |
| --- | --- |
| `--bg` | Page background |
| `--surface` | Cards, panels, sidebar |
| `--surface-solid` | Opaque nested surfaces |
| `--surface-soft` | Selected controls and subtle fills |
| `--text` / `--muted` | Primary and secondary text |
| `--border` | Dividers and control borders |
| `--primary` | Sage actions, selected states, progress |
| `--accent` | Warm amber labels and highlights |
| `--danger` | Destructive actions and errors |

## Typography

Use the system sans-serif stack. The scale runs from `--font-2xs` through `--font-2xl`, with `--font-heading` and `--font-display` for responsive headings. Body copy uses `--font-md`; labels and buttons use `--font-sm`; metadata and badges use `--font-xs`.

## Spacing and shape

Spacing follows six tokens: `--space-1` (6px), `--space-2` (10px), `--space-3` (16px), `--space-4` (24px), `--space-5` (32px), and `--space-6` (48px).

Radii use `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl`, and `--radius-pill`. Cards use the large radius, controls use the medium radius, and badges use the pill radius.

## Components

- Primary buttons use the sage action color, 48px control height, medium radius, and a restrained lift on hover.
- Secondary buttons use a bordered surface. Text buttons are reserved for low-emphasis actions.
- Cards share the same surface, border, shadow, and large radius. Hover lift is limited to 2px.
- Inputs, selects, and textareas share control height, border, focus ring, font size, and radius.
- Badges use muted text, a soft surface, compact spacing, and pill shape. Status badges may change semantic color.
- Empty states use a dashed card border, centered icon tile, short heading, and one sentence of guidance.

## Responsive rules

- Above 940px: vertical sidebar and two-column activity dashboard.
- 940px and below: navigation becomes horizontal and the dashboard becomes one column.
- 760px and below: forms, filters, missions, and classrooms stack vertically.
- 520px and below: single-column stats, reduced panel padding, compact typography, and reorganized activity actions.
- Interactive targets remain at least 40px high; primary controls use 48px.
- Reduced-motion preferences disable nonessential animation and transitions.
