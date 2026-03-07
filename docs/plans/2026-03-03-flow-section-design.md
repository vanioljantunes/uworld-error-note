# Flow Section Design

## Goal

Add a "Flow" view to GapStrike — a three-column layout (Questions | Note Editor | Anki) where all panels are visible simultaneously, tied to a single question ID. The user selects an extraction, generates a note, edits it, and creates Anki cards — all in one screen.

## Approach

New `"flow"` ViewMode added alongside existing tabs. Reuses existing state, handlers, and API routes. Existing Chat/Editor/Anki/Templates tabs remain unchanged.

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Navbar (full width)                                            │
│  [Flow] [Chat] [Editor] [Anki] [Templates] [Dashboard]         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│    ┌─────────────────────────────────────────────────────┐      │
│    │  [▼ Choose extraction]        [Upload Screenshot]   │      │
│    │                                                     │      │
│    │              #483921 — Thiamine Deficiency           │      │
│    │                                                     │      │
│    │  ┌──────────┐  ┌──────────────────┐  ┌──────────┐  │      │
│    │  │Questions │  │  Note Editor     │  │  Anki    │  │      │
│    │  │  (25%)   │  │  (50%)           │  │  (25%)   │  │      │
│    │  │          │  │                  │  │          │  │      │
│    │  │          │  │                  │  │          │  │      │
│    │  └──────────┘  └──────────────────┘  └──────────┘  │      │
│    │                                                     │      │
│    └─────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Centered container: `max-width: 1400px`, `margin: 0 auto`, horizontal padding
- ID bar on top with action buttons
- Centered active ID label between buttons and panels
- Three panels with `gap: 16px` between them
- Note Editor gets 50% width; Questions and Anki get 25% each
- Each panel is a distinct card with border and its own scroll
- No sidebar or right activity panel in Flow view

## Data Flow

### Selecting an ID

1. **"Choose from extractions"** — dropdown populated from `savedExtractions` (localStorage). Selecting one sets `activeFlowExtraction`.
2. **"Upload Screenshot"** — triggers `/api/extract`, saves result to `savedExtractions`, auto-selects it.

### Panel Behavior Once ID Is Selected

| Panel | Content |
|---|---|
| **Questions (left)** | Shows extraction summary: question stem, user's wrong answer, correct answer, educational objective. "Generate Note" button. After generation: shows error pattern and tags. |
| **Note Editor (center)** | Empty until note is generated. After "Generate Note": loads the created note, fully editable with save and format toolbar. |
| **Anki (right)** | Immediately queries AnkiConnect for cards matching `tag:{questionId}`. Shows card list. Always shows "Make Card" button at top. |

### Simplified Flow

```
Select ID
  → All panels show ID-related content
  → Click "Generate Note"
  → POST /api/generate with extraction + template
  → Note appears in editor (fully editable, saveable)
  → Anki panel refreshes
  → "Make Card" reads note content → POST /api/create-card → addNote via AnkiConnect
```

## Component Structure

### New File: `FlowView.tsx`

Client component. Renders the three-column layout. Manages:
- `activeFlowExtraction: SavedExtraction | null`
- `flowNoteContent: string` — generated note content
- `flowNotePath: string` — path of generated note in vault
- `flowAnkiCards: AnkiCard[]` — cards matching active ID

### Props from page.tsx

- `savedExtractions` — list of available IDs
- `userTemplates` — for note generation and card creation
- `vaultPath` — for note save/read operations
- `onExtract(images)` — trigger extraction from uploaded screenshots
- Callbacks: `onSaveExtraction`, `onGenerateNote`, etc.

### CSS Classes (in page.module.css)

- `.flowContainer` — centered max-width wrapper with padding
- `.flowIdBar` — flex row, action buttons
- `.flowActiveId` — centered text showing current ID + title
- `.flowPanels` — `display: flex; gap: 16px`
- `.flowPanel` — card styling, border, overflow-y auto, 25% flex basis
- `.flowPanelWide` — 50% flex basis (Note Editor)

### Reused Logic

- `ankiConnect()` — direct browser calls to AnkiConnect
- `/api/generate` — note generation with template
- `/api/create-card` — LLM card generation
- `/api/read-note`, `/api/save-note` — note persistence
- `savedExtractions` state + localStorage persistence

## State Summary

| State | Type | Purpose |
|---|---|---|
| `activeFlowExtraction` | `SavedExtraction \| null` | Currently selected question ID |
| `flowNoteContent` | `string` | Note content in editor panel |
| `flowNotePath` | `string` | Path of generated/loaded note |
| `flowAnkiCards` | `AnkiCard[]` | Cards matching active ID |
| `flowGenerating` | `boolean` | Loading state for note generation |
| `flowSavingNote` | `boolean` | Loading state for note save |

## What's NOT Changing

- Existing Chat, Editor, Anki, Templates tabs — unchanged
- Server actions, API routes, Supabase schema — unchanged
- savedExtractions storage format — unchanged
- AnkiConnect direct browser calls — reused as-is
