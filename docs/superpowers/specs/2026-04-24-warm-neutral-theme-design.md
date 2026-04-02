# Warm Neutral Theme Design

## Goal

Replace the current cold slate-blue color scheme with a warm neutral palette to achieve a refined, premium look while keeping the light background.

## Scope

- `app/globals.css` — CSS variables and SVG overrides
- `components/skill-flow-studio.tsx` — Graphviz node/edge theme colors

## CSS Variables

| Variable | Current | New | Notes |
|----------|---------|-----|-------|
| `--background` | `#f8fafc` | `#faf9f7` | Warm off-white |
| `--background-soft` | `#ffffff` | `#ffffff` | Unchanged |
| `--foreground` | `#334155` | `#3c3836` | Warm dark gray |
| `--muted` | `#64748b` | `#8b7e6a` | Warm muted |
| `--muted-strong` | `#475569` | `#5c5347` | Warm muted strong |
| `--accent` | `#2563eb` | `#b8860b` | Dark gold |
| `--panel` | `rgba(255,255,255,0.92)` | `rgba(255,255,255,0.92)` | Unchanged |
| `--panel-strong` | `rgba(255,255,255,0.96)` | `rgba(255,255,255,0.96)` | Unchanged |
| `--preview` | `#ffffff` | `#ffffff` | Unchanged |
| `--line` | `#e2e8f0` | `#e8e4de` | Warm border |
| `--line-strong` | `#cbd5e1` | `#d4cfc7` | Warm strong border |

## Selection Highlight

`::selection` background: `rgba(184, 134, 11, 0.14)` (gold tint, replacing blue tint).

## Graphviz Node Themes

### Action nodes (box)
- Border: `#b8860b` (dark gold)
- Fill: `#faf5eb` (warm cream)
- Text: `#3c3836`

### Decision nodes (diamond)
- Border: `#a0522d` (sienna)
- Fill: `#fdf6f0` (warm apricot)
- Text: `#3c3836`

### Start/End nodes (doublecircle)
- Border: `#6b5b3e` (dark brown)
- Fill: `#f7f4ee` (warm white)
- Text: `#3c3836`

### Edges
- Line color: `#8b7e6a` (warm gray)
- Label color: `#a0522d` (sienna, replacing red)

## SVG Overrides in globals.css

- `.graphviz-stage .node text` fill: `#3c3836`
- `.graphviz-stage .edge text` fill: `#a0522d`, stroke: `#ffffff`

## Files Changed

1. `app/globals.css` — Update CSS variables and SVG style overrides
2. `components/skill-flow-studio.tsx` — Update `getNodeTheme()` colors and edge attributes in `buildStyledGraph()`

## Out of Scope

- Dark mode support
- Font changes
- Layout or spacing changes
- Component structure changes
