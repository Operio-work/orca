---
name: Free-ORCA by Operio
description: Operational Remote Company Agents — the agent workspace drawn as a live map, on Operio v3 tokens.
colors:
  brand-orange: "#F5A623"
  brand-orange-bright: "#FFB84D"
  orange-ink-dark: "#F5A623"
  orange-ink-light: "#9A6700"
  status-green: "#22C55E"
  status-green-ink-light: "#1A7F4B"
  status-red: "#EF4444"
  status-red-ink-light: "#C0392B"
  tag-blue: "#3B82F6"
  tag-cyan: "#00CFE8"
  on-orange: "#0A0A0A"
  on-red: "#FFFFFF"
  night-bg: "#0A0A0A"
  night-surface: "#111111"
  night-surface-2: "#161616"
  night-surface-3: "#1C1C1C"
  night-border: "#1E1E1E"
  night-border-dim: "#141414"
  tile-line-dark: "#2A2A2A"
  terminal-black: "#050505"
  terminal-text: "#C8C8C8"
  text-primary-dark: "#F0F0F0"
  text-secondary-dark: "#999999"
  text-dim-dark: "#444444"
  zinc-bg: "#F4F4F5"
  zinc-surface: "#FFFFFF"
  zinc-surface-2: "#FAFAFB"
  zinc-border: "#E4E4E7"
  terminal-zinc: "#18181B"
  text-primary-light: "#18181B"
  text-secondary-light: "#52525B"
typography:
  display:
    fontFamily: "JetBrains Mono, Fira Code, Cascadia Code, ui-monospace, monospace"
    fontSize: "clamp(1.6rem, 6.4vw, 2.1rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.02em"
  headline:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
  title:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.82rem"
    fontWeight: 600
    lineHeight: 1.15
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 600
    lineHeight: 1.35
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.72rem"
    fontWeight: 600
    letterSpacing: "0.12em"
  label-tile:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
  mono-output:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  "8": "64px"
components:
  button-primary:
    backgroundColor: "{colors.brand-orange}"
    textColor: "{colors.on-orange}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.brand-orange-bright}"
    textColor: "{colors.on-orange}"
  button-secondary:
    backgroundColor: "{colors.night-surface-2}"
    textColor: "{colors.text-secondary-dark}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  chip:
    backgroundColor: "{colors.night-surface}"
    textColor: "{colors.text-secondary-dark}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.pill}"
    padding: "0 12px"
    height: "36px"
  chip-primary:
    backgroundColor: "{colors.brand-orange}"
    textColor: "{colors.on-orange}"
    rounded: "{rounded.pill}"
    padding: "0 12px 0 10px"
    height: "36px"
  count-needs-you:
    backgroundColor: "{colors.status-red}"
    textColor: "{colors.on-red}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    height: "36px"
  key:
    backgroundColor: "{colors.night-surface-2}"
    textColor: "{colors.text-secondary-dark}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    height: "44px"
  key-primary:
    backgroundColor: "{colors.brand-orange}"
    textColor: "{colors.on-orange}"
    rounded: "{rounded.md}"
    height: "44px"
  tab-block:
    backgroundColor: "{colors.night-surface}"
    rounded: "{rounded.lg}"
    padding: "8px"
  tile:
    backgroundColor: "{colors.night-surface-3}"
    textColor: "{colors.text-primary-dark}"
    typography: "{typography.title}"
    rounded: "{rounded.md}"
    padding: "7px 8px"
  tile-blocked:
    backgroundColor: "{colors.status-red}"
    textColor: "{colors.on-red}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.night-surface-2}"
    textColor: "{colors.text-primary-dark}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "44px"
  output:
    backgroundColor: "{colors.terminal-black}"
    textColor: "{colors.terminal-text}"
    typography: "{typography.mono-output}"
    rounded: "{rounded.md}"
    padding: "12px"
  sheet:
    backgroundColor: "{colors.night-surface}"
    rounded: "{rounded.xl}"
    padding: "8px 16px 16px"
---

# Design System: Free-ORCA by Operio

## Overview

**Creative North Star: "The Control-Room Floor Plan"**

ORCA by Operio is the agent workspace drawn as its own live map. Every workspace tab is a block, every pane a tile placed at its real split geometry, and every tile is painted by the state of the agent inside it. The page is read at a glance before it is read in detail: a red tile means a person is needed, an orange tile is working, a green hairline is calm. Everything else stays dark, flat and quiet so those three states carry the screen.

The world is an expression of the Operio Unified Design Tokens v3.0 (shipped verbatim as `tokens.css`, sections 1–3), not a new brand. It keeps the v3 dark default on the circuit grid and the cool-zinc light theme, Inter for prose and JetBrains Mono for every name, label and number. The app adds a small set of derived values (tile line, terminal black, muted text, on-orange / on-red ink) in `style.css`; everything else is referenced by token name.

Density is operational: a phone shows the header, the counts bar, tag filters and two columns of tab blocks; selecting a tile raises the agent sheet from the bottom (max 56vh). From 960px the sheet becomes a sticky right-hand panel beside the map. Motion is spent on one thing only: a status change repaints the tile in place with one pulse.

**Key Characteristics:**
- Workspace as a map: tab blocks hold tiles at their real pane proportions, not a list of identical cards.
- Status paints the tile: working = orange tint + elapsed bar, needs you = solid red, idle = green hairline, empty shell = dashed.
- Brand orange is reserved for state (working) and the primary action.
- Mono for every identifier and label; Inter only for prose and buttons.
- Dark default with circuit grid; cool-zinc light without the grid; the terminal output stays dark in both.
- Every visible string ships in English and Spanish; visible copy says ORCA, panes, workspace, never the underlying terminal tool.

## Colors

A near-black control room where colour appears only to report agent state or invite the next action.

### Primary
- **Brand Orange** (brand-orange): fills for the working state (tile tint gradient, elapsed bar, status dot), the primary action (New, Send, the big first key, Save) and focus rings via the orange glow. Hover lifts to **Bright Orange** (brand-orange-bright). Text sitting on orange uses **On-Orange** (on-orange), never white.
- **Orange Ink** (orange-ink-dark / orange-ink-light): orange as text: the APP half of the wordmark, the `//` before tab labels, working tile names and status, chevrons. On light it drops to the AA-safe amber (orange-ink-light).

### Secondary
- **Signal Red** (status-red): the needs-you state only. Solid fill for a blocked tile and for the non-zero NEEDS YOU count, the sheet border when the open agent is blocked, the armed (confirm) state of a destructive key. Text on red is **On-Red** (on-red). Red text on surfaces uses the per-theme red ink.
- **Idle Green** (status-green): idle and done. Appears as a 45% hairline on the tile border and as the IDLE label ink, never as a fill. Light theme uses status-green-ink-light for text.

### Tertiary
- **Tag Blue** (tag-blue) and **Tag Cyan** (tag-cyan): the first two tag slots. Tags are assigned one slot each in order of first use and render as 14% tinted pills, 45% outlines and 7px dots on tiles. The build currently cycles three further slots (green, yellow, strong orange) that collide with status hues; that is known drift, not part of the system. Further tag hues must stay off the status and brand-orange hues.

### Neutral
- **Night Background** (night-bg) with the circuit grid drawn in **Night Border Dim** (night-border-dim) at 48px: the page.
- **Night Surface / Surface 2 / Surface 3** (night-surface, night-surface-2, night-surface-3): tab blocks and chips; keys, inputs and secondary buttons; idle tiles.
- **Night Border** (night-border) and **Tile Line** (tile-line-dark): hairlines; tiles get the slightly brighter line so they read as objects inside the block.
- **Terminal Black** (terminal-black) with **Terminal Text** (terminal-text): agent output. In light theme the well switches to **Terminal Zinc** (terminal-zinc), staying a dark well.
- **Text Primary / Secondary / Dim** (dark and light pairs): names and titles; meta and resting controls; disabled counts and placeholders. Muted labels use a derived mix (80% secondary + 20% tertiary) because the token tertiary is only 3.3:1 on surfaces.
- **Zinc Background / Surface / Surface 2 / Border** (zinc-bg, zinc-surface, zinc-surface-2, zinc-border): the light theme. Light tiles sit on white with the zinc border as tile line.

### Named Rules
**The State-Or-Action Rule.** Brand orange appears only for the working state and the primary action. No decorative orange fills, no orange headings beyond the wordmark's APP and the `//` label mark.

**The One Red Rule.** Solid red means one thing: an agent is waiting on a person. It is never used for errors, branding or emphasis on a surface that has no blocked agent (error toasts use a 14% red tint, not a fill).

**The Hairline Calm Rule.** Idle is told by a green hairline and green label, never a green fill. Calm states recede.

## Typography

**Display Font:** JetBrains Mono (with Fira Code, Cascadia Code, ui-monospace)
**Body Font:** Inter (with system-ui, -apple-system)
**Label/Mono Font:** JetBrains Mono

**Character:** Mono carries identity and data (wordmark, agent names, tab labels, counts, keys, output); Inter carries sentences (agent titles, questions, button text, messages). Both are self-hosted at 400 and 600 only.

### Hierarchy
- **Display** (600, clamp(1.6rem, 6.4vw, 2.1rem), 1): the ORCA wordmark only, after the 40px logo mark, with *by Operio* below in italic mono 400 at 0.72rem, orange-ink.

### Logo
An island block from a 90s isometric sim map (blue water top, orange earth sides) with an orca leaping out of it (black, white eye patch and belly, white outline), framed by a strategy game's orange selection brackets and a green unit health bar. Source: `public/icons/icon.svg`; the PNGs (192, 512, maskable 512) are rendered from it.

### Views
Three views of the same data, switched by a segmented control at the right end of the status bar (Map · Office · Islands, remembered per device):
- **Map:** tab blocks and pane tiles (below).
- **Office:** 8-bit floors, rooms and desks (`office.js`).
- **Office contrast + characters:** lights on / lights off. A working desk's whole slot glows warm (orange 20% over the surface, brighter top edge), its monitor is lit solid orange with dark code scrolling, the desk lamp is on with a pool of light, and the name turns orange-ink; an idle desk goes dark (surface → bg), the worker sleeps head-down on the desk with z's rising, the screen is off with a blinking green standby dot, the name greys out; needs you = red-tinted slot and red name; done = green name. Every agent gets its own look, seeded from its name: hair style (short, long, bun, mohawk, cap, bald), hair colour (8), skin tone (4) and an accessory (glasses, headphones, beard or none); the shirt keeps the agent kind's colour. Codex stays a robot, Hermes keeps its winged helmet.
- **Islands:** a cartoon 90s sim (`island.js`), smooth vector shapes with dark-ink outlines at the screen's real resolution: each workspace a soft squircle island (grass with a light-to-dark gradient, sand beach, earth cliff, lapping dashed foam, shallow-water halo, tufts, flowers, palms with puffy leaves), named on a waving orange flag; each tab a little office with a hip roof, chimney smoke while working, glowing windows, a siren when someone needs you, a green flag when done, and a pill sign; each agent a big-headed character at the door (walking with a box while working, on a bench with drifting z's when idle, hopping and waving under a "!" balloon when it needs you, arms up with confetti when done; Codex is a robot, Hermes has wings). RTS selection brackets breathe around the selected agent; seagulls and a sailboat cross the sea; a beveled toolbar shows the date; an info bar the news. Tokens and token mixes only; light theme is a daytime sea. ~12 fps while visible; still under reduced motion.
- **Headline** (600, 1.5rem, 1.15, mono): the agent name at the top of the sheet; it is also the rename field.
- **Title** (600, 0.82rem, 1.15, mono): tile names, clamped to two lines; drops to 11px then 10px as the tile container narrows. Unnamed agents render in italic 400 secondary.
- **Body** (400, 1rem, 1.45, Inter): agent title in the sheet, message field, prose. Tile subtitles use 0.72rem Inter when the tile is at least 150 × 120px.
- **Body small** (600, 0.82rem, Inter): button and chip text, the needs-you question pill.
- **Label** (600, 0.72rem, mono, uppercase): tab-block heads at 0.12em tracking, preceded by an orange-ink `//`; count labels, DETAILS toggle and dialog labels at 0.06–0.08em. Tile status (NEEDS YOU, WORKING · 33S, IDLE) is the same voice at 10px, 0.08em.
- **Count numerals** (600, 1.15rem, mono, tabular): the numbers in the counts bar.
- **Output** (400, 0.72rem, 1.45, mono): terminal output, pre-wrapped.

### Named Rules
**The Mono-Names Rule.** Anything that identifies an agent, tab, pane, key or number is set in JetBrains Mono. Inter never names things.

**The Two-Weights Rule.** Only 400 and 600 ship. Hierarchy comes from size, case and colour, not from extra weights.

## Layout

A centred shell (max 1320px, 16px side padding, safe-area aware). The header is a two-column grid: wordmark left, action chips right (New, alerts, theme, language), expansion spanning below. The counts bar is sticky at the top with a 12px backdrop blur over the scrolled nav colour; counts (needs you · working · idle) double as the status filter and are followed by tag filter chips, which wrap to a full-width, edge-faded scrolling row under 600px.

The map is a CSS grid: two equal columns on phones (12px gap, dense flow), auto-fill columns of at least 260px from 960px. A tab block with three or more panes spans the full width. Inside each block the panes area keeps the tab's real aspect ratio (clamped 104–260px tall, 150–300px for wide blocks) and tiles are absolutely positioned at their real split geometry with a 2px gutter. Tabs with only shells collapse to a 40px strip; shell-only tabs are summarised in a dashed row at the end.

The sheet: fixed to the bottom on phones (max 56vh, 16px top corners, the map gets 58vh bottom padding while it is open). From 960px the work area becomes a two-column grid (map + 420px panel) and the sheet is a sticky panel at top 72px filling the viewport height, output growing to fill and actions pinned to the bottom.

Tile content adapts with container queries, not breakpoints: subtitle appears at 150 × 120px, elapsed time hides under 84px width, status hides under 46px height, tag dots hide under 70px width.

Spacing follows the v3 scale (4, 8, 12, 16, 24, 32, 64). Touch targets: 36px chips and buttons, 44px keys, inputs and send.

## Elevation & Depth

Mostly flat and tonal: the page, blocks and tiles separate by surface step and hairline, not shadow. Shadows are reserved for things that float above the map (the sheet, dialogs, toasts) and for the blocked tile, which gets the card shadow so the red reads as raised. Light theme uses the v3 light shadow values.

### Shadow Vocabulary
- **Floating panel** (`box-shadow: var(--shadow-lg)`): desktop sheet, dialogs, toasts.
- **Bottom sheet** (`box-shadow: 0 -14px 40px rgb(0 0 0 / 0.45)`): the phone sheet, cast upward over the map.
- **Raised alert** (`box-shadow: var(--shadow-card)`): blocked tiles only.
- **Selection ring** (`box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--text-primary)`): the selected tile, a white (text-primary) outline separated by a background-coloured gap.
- **Focus ring** (`box-shadow: 0 0 0 3px var(--glow-orange-sm)`): every focus-visible element; fields also switch border to brand orange.
- **Primary hover glow** (`box-shadow: 0 4px 14px var(--glow-orange-sm)`): the New chip on hover.

### Named Rules
**The Float-Only Shadow Rule.** Shadows mark what floats over the map or what demands a person. Nothing at rest on the map casts a shadow except a blocked tile.

## Shapes

Soft-cornered rectangles nested by size: tab blocks 12px, tiles, keys, buttons, inputs and the output well 8px, the sheet and dialogs 16px. Pills (999px) are reserved for chips, tags and the needs-you question. Borders are 1px hairlines; dashed borders mean absence (an empty shell pane, the shell-only row, the add-tag control, an unknown status tile). Status dots are 10px circles in the sheet, 7px tag dots on tiles. The elapsed bar is a 3px strip on the tile's bottom edge with a rounded leading end.

## Components

### Buttons
Calm surface buttons with one loud orange action per context.
- **Shape:** gently rounded (8px); min height 36px, 44px in dialogs and the composer.
- **Primary:** brand orange fill, on-orange text, Inter 600 0.82rem. Hover lifts to bright orange.
- **Secondary:** surface-2 fill, hairline border, secondary text; hover brightens text to primary and border to text-dim.
- **Ghost:** no fill or border; surface-2 on hover. Variants: suggest (orange-ink text) and danger (red-ink text).
- **Focus:** orange glow ring. On touch devices hover styling is suppressed.

### Chips
- **Style:** pill (999px), 36px tall, surface fill, hairline border, secondary text. Icon chips are 36px squares; the language chip is mono.
- **State:** pressed = orange border, orange-ink text, 20% orange glow fill. The New chip is the primary variant (orange fill). Tag chips carry their slot colour in text, and in the pressed border and 14% fill.

### Counts bar
The legend and the filter in one. Each count is an 8px-rounded 36px box: mono uppercase label at 0.72rem and a tabular numeral in the state ink. A non-zero NEEDS YOU count becomes a solid red box with on-red text; zero counts dim the numeral; the pressed count gets a 1px inset text-primary ring.

### Tab block and tiles (signature)
- **Tab block:** surface at 92% over the grid, hairline border, 12px radius, 8px padding. Head: mono uppercase label with an orange-ink `//`, pane count right-aligned.
- **Tile:** surface-3 (white in light) face, tile-line border, 8px radius, 7 × 8px padding; name top, status label bottom, up to three tag dots top-right.
- **Working:** vertical gradient from 7% to 24% orange over the tile surface, 60% orange border, orange-ink name and status; when timed, a 3px orange elapsed bar grows along the bottom edge (1s linear).
- **Needs you:** solid red face and border, on-red name and status, card shadow.
- **Idle / done:** green hairline (45% mix), green-ink status.
- **Unknown:** dashed border. **Empty shell:** transparent with dashed tile line, centred uppercase 10px dim label.
- **Selected:** white outline ring (see Elevation). **Filtered out:** 28% opacity.
- **Repaint:** a status change plays one 1.2s pulse in place: an orange glow ring that fades, or for a newly blocked tile a 1.06 scale with a 45% red ring that settles and holds. Pressed tiles scale to 0.98. Positions animate when the split changes. All motion is removed under reduced motion.

### Map fit
The map aims to fit the window with no scrolling. Tab blocks are compact (6px padding, 0.66rem heads, 8px gaps; desktop columns from 210px, wide tabs span 2 columns, not the whole row). Each block's panes keep the tab's real proportions under a height cap `--pane-max`: it starts at 124px (desktop) / 130px (phone) and `fitMap()` lowers it, down to a 56px floor, until the map ends above the window's bottom. It runs when the layout's shape or the window size changes, never on the 3 s poll. Short tiles keep the name on one line so the status word still shows; it hides only below 26px.

### Loading
Only the map ships on first load (`app.js`, `sound.js`, styles). Office, Islands and Holo load their script when first opened; Holo then imports three.js, and hovering or focusing the 3D button warms both. The server compresses text (brotli, else gzip; kept in memory per file version), sends ETags so unchanged files answer 304, and caches fonts for a year and `vendor/` for a week.

### Agent page (sheet)
- **Phone (<960px):** a full-screen page over the map (100dvh, surface fill), rising from the bottom in 0.3s on the iOS drawer curve, leaving in 0.2s. Opening adds a history entry, so the system Back closes it; the page behind does not scroll.
- **Desktop (≥960px):** a centred window, min(1040px, 100vw − 64px) × min(900px, 100dvh − 64px), 16px radius, deep shadow, over a scrim that blurs (8px) and dims the workspace. Enters from 8px below at 0.98 scale in 0.24s, leaves in 0.16s. Esc (when the reply box is empty), the X or a click on the scrim closes it; the reply box takes focus on open. A blocked agent gets a red border plus a 1px red ring.
- **Show on desktop** (the most used action) is a pill in the header: orange-tinted, monitor icon + "Show". Pressed: the screen blinks while it works; on success the pill fills orange, the monitor hops and shows a check, an orange ring flies off, the label reads "On screen!" for 1.8s, the phone buzzes once, and in the office view the worker cheers with a lit monitor for 2s (map view: the tile pulses). No toast on success. Then the agent page closes itself (0.65s later, so the confirmation is seen); from the 3D command card, the card closes and the camera returns to the table. Keyboard: D.
- **Order, top to bottom:** header (back/close, editable name in mono, a state line: status dot + status word and time in the status ink colour · workspace / tab, then the Show pill and a ⋯ More button); the More area when open (meta, tags, Move, Show on desktop, Clear name, name suggestion) on surface-2; the task title (2 lines max); the output well, which takes all remaining height; the dock: the question (red tint) and its full-width answer key when blocked, one row of keys, the reply box last, under the thumb.

- **Holo (3D)** (`holo.js`, three.js 0.185 vendored in `public/vendor/three`, loaded only when the view opens): a holographic command table that always fits one screen. A dark stage in both themes with scanlines, cyan corner brackets, a HUD (title + clock) and an info line; a cyan grid with a soft glow disc. Each workspace a translucent hex deck with bright cyan edges, a slow outer ring and an orange name tag; each tab a hex tower (taller with more agents) with spinning rings while someone works, a fibre to the deck's hub with an orange pulse riding it; each agent a light core orbiting its tower: orange with rising data while working, green breathing when idle, a green halo when done, dim when starting; needs you = red tower, a red light column and a shockwave ring across the table, the deck edge and the frame flash red. Drag to orbit (elevation 18–81°), pinch/scroll to zoom, double-click to re-fit, tap a core to open it; mouse hover highlights. The camera fits the real deck corners and tower tops, drifts gently until touched, and looks more from above in portrait; phones hide tab names. Under reduced motion it renders still. Key 3.
  - **Focus (RTS select → command):** the first tap on a core (or J/K/B with no agent page open) flies the camera to it in 0.95s and opens a command card (name, status + time, title, OPEN ⏎ / SHOW D) beside the core on desktop, docked at the bottom on phones; a second tap or Enter opens the agent page; a tap on empty table or Esc flies back to the overview. An orange ring marks the focused core.
  - **Glow:** computers (fine pointer, ≥960px) get real bloom (UnrealBloomPass 0.55 / 0.35 / threshold 0.62) with the fake sprite glows halved and the table disc off; phones keep sprite glow. `?glow` forces it for testing. Addons vendored in `public/vendor/three/addons` with the bare `three` import rewritten.
  - **Boot (once per page load):** a cyan scan line sweeps the table while the decks rise one by one from below and the title counts BOOTING TABLE 0–100%; labels fade in last.

### Keyboard shortcuts
One-key, navigation only (none ever types into an agent), ignored while typing or in a dialog: N new · B next agent that needs you · J/K next/previous agent · D show on desktop · R reply (focus) · E rename · M/O/I/3 map/office/islands/3D · ? hide/show the cheat sheet · Esc close (with a draft, Esc first leaves the reply box). The cheat sheet is one quiet line of kbd chips (mono 0.68rem, muted) under the header, hidden on touch-only screens and under 600px; a used key flashes orange on its chip. The agent page no longer grabs focus on open, so shortcuts work at once.

### Sound
Off by default, remembered per device (`orca-sound`); a speaker toggle sits left of the view switch (orange when on) and S toggles it. All synthesised with Web Audio in `sound.js` (no files), quiet and short, each throttled to once per 250 ms: needs you = two-note rising chime (A5→D6); done = soft C-major arpeggio; select = tiny tick; 3D focus = rising sweep + ping; show on desktop = zap + bell; sent = two-note blip; key = tick; view switch = short glide; 3D boot = a rising hum with four blips and a bell. Status sounds fire on transitions only, never on first load.

### Zoom
A second pill next to Show, same look and feedback (frame-corners icon whose centre fills, "Zoomed!", haptic, page closes 0.65s later): brings the agent to the front on the desktop and sets its pane zoomed to fill the tab (Show does the reverse: if the tab is zoomed it un-zooms it, so you see where the agent sits) (`herdr pane zoom --on`, never a toggle, so pressing twice keeps it zoomed). Also on the 3D command card and the Z key. Phones: both pills icon-only.

### Crew (reusable names)
The names you reuse, learned on the server from every rename / new agent (count, weighted to the last 14 days), plus pins; at most 12, pinned first, shared by every device. Shown as mono pill chips: free names first (1–9 key hints while renaming), names already in use greyed with a strike-through and disabled. Where: a "NAME IT" row under the agent page header for an unnamed agent and while the name field is focused (E); 1–9 picks while the field is empty or fully selected (a name can't start with a digit); the New-agent dialog under Name; ⋯ More → CREW to pin (orange pin) or remove (×) names. A reused name brings back its usual tags (remembered per name whenever tags change) if the agent has none, and the same name always gets the same office/islands character. Unnamed agents' map tiles carry a dashed "name?" pill. Names follow herdr's rule (lowercase letter first, then lowercase letters, digits, - or _, 32 max); the server checks it before calling herdr.

### Context badge
In the agent page header, between the name and Show: a 40px pill with a ring gauge and the percentage in bold mono, tokens used / total underneath (phones: ring + percentage only, and Show goes icon-only to keep room for the name). Green under 50%, orange 50–79%, red from 80%. Read from the agent's own output: Claude's "ctx 65% (654k/1.0M)" (context-gauge) or status bar "ctx ███ 26% 260k/1.0M", Codex's "N% context left"; the last mention wins and the last good reading per agent is kept (a cut-off total reuses the previous one). Agents that print neither (Hermes, Antigravity) show no badge.

### Status badge
The agent page shows its state as a 40px round badge left of the name instead of a red border: working = orange tint + bolt (blinks), idle = green tint + moon, done = solid green + check, starting = grey + hourglass, needs you = solid red + raised hand that waves every few seconds, with a red halo pulsing out.

### Keys
One row of 44px mono keys (6px gap, surface-2 with hairline); on a phone the row scrolls sideways with a fade on the right edge while keys are hidden; on desktop keys narrow to 36px so all fit. Enter is the primary (orange, icon + word) unless an answer key is shown: for numbered choices a full-width orange "1 · <choice>" key sits above the row. Ctrl-C uses red-ink text and arms to a solid red fill on first press, requiring a second press to send. Pressed keys scale to 0.96.

### Inputs / Fields
- **Style:** surface-2 fill, hairline border, 8px radius, 44px minimum. The composer is Inter 1rem; dialog fields and the tag input are mono.
- **Focus:** border turns brand orange plus the orange glow ring. The caret is orange everywhere.
- **Inline rename:** the sheet name is a borderless field that shows a hairline on hover and the orange focus treatment when editing.

### Tags
Pills 26px tall, mono 0.72rem, tinted 14% with a 45% outline in the slot colour and text mixed 72% toward the slot colour. Add-tag is a dashed pill that turns orange on hover.

### Toast
Fixed at the top, max 520px, 12px radius, floating shadow; success is a 14% green tint with a 50% green border, error the same in red.

## Do's and Don'ts

### Do:
- **Do** reference v3 token names (`--color-*`, `--text-*`, `--space-*`, `--radius-*`) and keep `tokens.css` a verbatim copy of v3 sections 1–3; add app values only as derived custom properties in `style.css`.
- **Do** paint agent state on the tile itself: orange tint + elapsed bar, solid red, green hairline, dashed for shells.
- **Do** keep one primary orange action per context (New in the header, the first key and Send in the sheet).
- **Do** use orange-ink, green-ink and red-ink for coloured text so light theme stays AA.
- **Do** set names, labels, counts and keys in JetBrains Mono; prose and buttons in Inter.
- **Do** keep the output well dark in both themes.
- **Do** require a second press before a destructive key (Ctrl-C) sends.
- **Do** ship every visible string in English and Spanish, and say ORCA, panes and workspace in visible copy.

### Don't:
- **Don't** use brand orange for decoration, headings or non-primary controls.
- **Don't** use a solid red fill for anything but an agent waiting on a person.
- **Don't** fill idle tiles green; idle is a hairline.
- **Don't** flatten the map into a list of identical cards; tiles keep their real split geometry.
- **Don't** add motion beyond the single repaint pulse, the agent page entrance/exit, press feedback and layout transitions; respect reduced motion.
- **Don't** name the underlying terminal tool in visible copy.
- **Don't** load external fonts, scripts or icon packs; icons are inline SVG symbols, fonts self-hosted.
