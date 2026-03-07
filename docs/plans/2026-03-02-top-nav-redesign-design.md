# Top Nav Redesign — Design

## Summary

Replace the left sidebar and per-view tab toggle with a unified horizontal top nav bar. Remove the vault path settings from the app (now managed in the dashboard). Keep the right Activity panel.

## Layout

```
┌───────────────────────────────────────────────────────────────────────┐
│ ⚡ GapStrike  [Chat] [Editor] [Anki]  │ 🏷tags...       [⚙ Dashboard] │
├───────────────────────────────────────────────────┬───────────────────┤
│                                                   │  ACTIVITY         │
│  Full-width main content                          │  History          │
│                                                   │                   │
└───────────────────────────────────────────────────┴───────────────────┘
```

## Nav Bar

- **Left zone:** GapStrike bolt icon + gradient name
- **Tabs:** Chat / Editor / Anki — pill-style buttons, same accent color active state
- **Center-right:** Tag filter chips from `vaultTags` — always visible, clickable toggle filter. Chips scroll horizontally if many tags.
- **Right zone:** Dashboard link — gear icon + "Dashboard" label, navigates to `/dashboard`

Height: ~52px. Background: `var(--bg-surface)`. Border-bottom: `1px solid var(--border)`.

## Removals

- Entire `.sidebar` element (268px left panel)
- `.sidebarHeader` (logo was here, moves to nav)
- `.viewToggle` + `.viewToggleDivider` (tabs move to nav)
- `.pathSection` / `.settingsBtn` / `.pathSettings` (vault path managed in dashboard)
- `showPathSettings`, `tempPath` state variables
- `handleSavePath` function

## Moves

| Element | From | To |
|---------|------|----|
| View tabs (Chat/Editor/Anki) | Sidebar `.viewToggle` | Top nav bar |
| Tag filter chips | Anki create card section only | Nav bar (visible in all views) |
| Editor note list | Sidebar `.editorNoteList` | Inline left column within editor content area (~240px) |
| Anki search bar | Sidebar | Inline header within anki content area |
| Note search input | Sidebar | Editor inline note panel |
| Chat session list | Sidebar | Inline panel within chat content area |

## CSS Grid Layout

Replace the current 3-column flex layout:

```css
.container {
  display: grid;
  grid-template-rows: auto 1fr;
  grid-template-columns: 1fr 272px;
  height: 100vh;
  background: var(--bg);
  color: var(--text);
}

.topNav {
  grid-column: 1 / -1;  /* spans full width */
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 52px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
}
```

## Editor View — Inline Note List

When `viewMode === "editor"`, the content area renders a flex row:

```
┌──────────────┬──────────────────────────────┐
│ Note list    │  Editor textarea              │
│ (240px)      │  (flex: 1)                    │
│ Search...    │                               │
│ note1        │                               │
│ note2 ←      │                               │
└──────────────┴──────────────────────────────┘
```

The note list panel uses `width: 240px; border-right: 1px solid var(--border)` inside the editor content area. Same styling as current `.editorNoteList` but contained within the editor view.

## Chat View — Inline Session List

Chat sessions list moves to a collapsible panel or left column within the chat content area, similar to editor note list.

## Anki View — Inline Search

The Anki search bar and results sit at the top of the anki content area as an inline header, not in a sidebar.

## Tag Chips Behavior

- `tagFilter` state already exists — shared across views
- Chips rendered from `vaultTags` (extracted from all notes)
- Active chip highlighted with accent border + background
- Clicking a chip toggles filter on/off
- Filters apply to: editor note list, anki create card note selector
- If many tags, chips wrap or scroll horizontally with `overflow-x: auto`

## Dashboard Link

- Navigates to `/dashboard` (the saas-shell at `gapstrike.vercel.app/dashboard`)
- Uses a simple `<a>` tag since it's a different app
- Gear icon + "Dashboard" text, ghost button style
