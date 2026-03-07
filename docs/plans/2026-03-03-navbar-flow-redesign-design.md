# Navbar & Flow Page Redesign

## Goal

Redesign the navbar and build the Flow page using the design system's typography (Inter), spacing, animations, and easing — while keeping the existing dark color palette.

## Design Decisions

- **Theme**: Dark colors preserved (`--bg`, `--bg-surface`, `--text`, `--accent`). Design system adopted for Inter font, spacing, easing curves, component patterns.
- **Navbar**: Minimal flat tabs with accent underline indicator (Linear/Notion style). Replaces current pill-shaped segmented control.
- **Flow page**: 3-panel adaptive layout with smooth focus expansion. Clicked panel grows to ~60%, others shrink to ~20%. All panels always visible.

---

## Navbar Design

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ◆ GapStrike     Flow  Chat  Editor  Anki  Templates    user│
│                  ────                                        │
└──────────────────────────────────────────────────────────────┘
```

- Height: 48px
- Background: `var(--bg-surface)` (unchanged)
- Bottom border: 1px `var(--border)`

### Brand (Left)

- Logo + "GapStrike" text
- No changes to brand styling beyond Inter font adoption

### Tabs (Center)

- **Remove** the pill container background (`.navTabs` bg)
- Tabs are flat text buttons with no background
- Typography: Inter 13px, font-weight 500
- Color states:
  - Default: `#888`
  - Hover: `var(--text)` (#dcddde)
  - Active: `white`
- Active indicator: 2px bottom border in `var(--accent)` (#5E6AD2)
  - Uses pseudo-element `::after` on the active tab
  - Smooth position transition when switching tabs (not sliding — each tab has its own `::after` that fades/scales in)
  - Transition: `opacity 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1)`
- Tab order: **Flow**, Chat, Editor, Anki, Templates, Dashboard
- Gap between tabs: 4px
- Tab padding: 8px 16px

### User Section (Right)

- Plan badge, status badge, divider, email, logout — same structure
- Refined with Inter font
- No functional changes

### CSS Changes

Replace `.navTabs` pill background with transparent. Replace `.navTabActive` pill styling with bottom-border approach. Add `::after` pseudo-element for accent underline.

---

## Flow Page Design

### ID Bar

```
┌──────────────────────────────────────────────────────────────┐
│  [▼ Choose extraction]     #483921 — Thiamine     [Upload]   │
│                         Educational objective...              │
└──────────────────────────────────────────────────────────────┘
```

- Full-width bar below navbar, inside `.flowContainer`
- Flex row: dropdown (left), active ID title (center, flex: 1), upload button (right)
- Active ID: Inter 14px/600, subtitle in `var(--text-secondary)` 12px/400
- Dropdown button: 13px, 1px border `var(--border)`, 8px 16px padding, 6px border-radius
- Upload button: accent background, white text, same sizing
- Bar height: auto, padding 12px 0
- Bottom border: 1px `var(--border)`

### 3-Panel Adaptive Layout

```
Default (no panel focused):
┌──────────────┬──────────────┬──────────────┐
│  Questions   │  Note Editor │    Anki      │
│   (33.3%)    │   (33.3%)    │   (33.3%)    │
│              │              │              │
└──────────────┴──────────────┴──────────────┘

Note Editor clicked/focused:
┌────────┬──────────────────────────┬────────┐
│ Quest. │     Note Editor          │  Anki  │
│ (20%)  │       (60%)              │ (20%)  │
│        │                          │        │
└────────┴──────────────────────────┴────────┘
```

**Container**: `max-width: 1400px`, `margin: 0 auto`, `padding: 0 32px`

**Panel behavior**:
- Default: all panels `flex: 1 1 33.3%`
- Focused panel: `flex: 1 1 60%`
- Unfocused panels: `flex: 1 1 20%`
- Transition: `flex-basis 400ms cubic-bezier(0.16, 1, 0.3, 1)` (expo-out easing from design system)
- Focus triggers on click anywhere inside the panel
- All panels remain fully visible and interactive at all sizes

**Panel card styling**:
- Background: `var(--bg-surface)`
- Border: 1px `var(--border)`
- Border-radius: 8px
- Overflow-y: auto
- Min-height: `calc(100vh - 48px - 60px - 32px)` (viewport minus navbar, ID bar, padding)

**Panel headers**:
- Design system label style: Inter 0.75rem, monospace feel, uppercase, letter-spacing 0.05em
- Color: `var(--text-secondary)` (#78716C adapted to dark)
- Padding: 12px 16px
- Bottom border: 1px `var(--border)`

**Panel content area**:
- Padding: 16px
- Overflow-y: auto (scroll within panel)

### Panel Content

#### Questions Panel (Left)

- Extraction summary: question stem, wrong answer, correct answer, educational objective
- "Generate Note" button: full-width, accent background, 8px border-radius
- After generation: shows error pattern name + tags as small badges

#### Note Editor Panel (Center)

- Empty state: centered muted text "Select an extraction and generate a note"
- After generation: full-height textarea, monospace font (design system code style)
- Save button in panel header area
- Transparent textarea background, subtle focus ring

#### Anki Panel (Right)

- "Make Card" button at top: dashed border, accent text
- Card list: queried from AnkiConnect by `tag:{questionId}`
- Card items: compact preview with front text truncated

### State

| State | Type | Purpose |
|---|---|---|
| `focusedPanel` | `"questions" \| "editor" \| "anki" \| null` | Which panel is expanded |
| `activeFlowExtraction` | `SavedExtraction \| null` | Selected extraction |
| `flowNoteContent` | `string` | Note content in editor |
| `flowNotePath` | `string` | Generated note file path |
| `flowAnkiCards` | `AnkiCard[]` | Cards matching active ID |
| `flowGenerating` | `boolean` | Note generation loading |
| `flowSavingNote` | `boolean` | Note save loading |

### Data Flow

1. User selects extraction from dropdown → all panels update
2. "Generate Note" → `POST /api/generate` → note appears in editor, Anki panel refreshes
3. Edit + save → `POST /api/save-note`
4. "Make Card" → `POST /api/create-card` → AnkiConnect `addNote` → refresh Anki panel

---

## What Changes

| Component | Change |
|---|---|
| `.navTabs` | Remove pill background, flat tabs |
| `.navTab` | Remove background states, add `::after` underline |
| `.navTabActive` | Bottom accent bar instead of filled pill |
| ViewMode type | Add `"flow"` option |
| New: Flow page | 3-panel adaptive layout with ID bar |
| New: `focusedPanel` state | Drives panel expansion |

## What Stays the Same

- Dark color palette (all `--var` tokens)
- Navbar height (48px), brand, user section structure
- Existing Chat, Editor, Anki, Templates functionality
- All API routes, Supabase schema, localStorage patterns
- AnkiConnect direct browser calls
- savedExtractions format
