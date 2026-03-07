# Format Bar Redesign — Design Doc

**Date:** 2026-03-02
**Status:** Approved

---

## Goal

Add four new formatting modes (Feynman, Flowchart, Expand, Concise) to the editor's format bar, replace the `<select>` dropdown with a semantic chip toolbar, and stream LLM output live into the editor instead of showing a blocking overlay.

---

## New Format Modes

| Mode | Behavior | Works on |
|---|---|---|
| **Feynman** | Rewrites selection in plain, student-friendly language — analogies, no jargon, active voice | Selection only |
| **Flowchart** | Keeps original text, appends a ` ```mermaid ` flowchart visualizing the causal/logical chain | Selection only |
| **Expand** | Adds mechanism steps, clinical context, and detail to the selection | Selection only |
| **Concise** | Strips selection to its essential point, no filler | Selection only |

Existing modes (List, Table, Split, Sections) remain unchanged and continue to work on selection or full note.

---

## Architecture

### 1. New task prompts — `tasks.yaml`

Four new task configs added alongside `format_selection`:

- `feynman_selection` — rewrites selected text as if explaining to a medical student with no prior knowledge. Use analogies, simple terms, active voice. Replace jargon with plain language.
- `flowchart_selection` — preserve the original selected text exactly, then append a ` ```mermaid ` flowchart TD block that maps the causal/logical chain described in the text.
- `expand_selection` — add clinical detail, mechanism steps, or context that deepens understanding of the selected text. Never invent facts.
- `concise_selection` — distill the selected text to its essential point. Remove filler, repetition, and padding. Preserve all key facts.

### 2. Streaming endpoint — `/format/stream`

New FastAPI endpoint alongside the existing `/format`:

```python
POST /format/stream
Content-Type: application/json
→ text/event-stream (SSE)
```

**Request body** (extends `FormatRequest`):
```json
{
  "vault_path": "...",
  "note_path": "...",
  "selected_template": "",
  "selected_text": "...",
  "format_mode": "feynman | flowchart | expand | concise | list | table | split | sections"
}
```

**Implementation:**
1. `format_mode` selects the appropriate `tasks.yaml` task key
2. CrewAI LLM is initialized with `streaming=True` and a token callback that pushes chunks into an `asyncio.Queue`
3. The crew runs in a background thread (`asyncio.to_thread`)
4. FastAPI streams from the queue via `StreamingResponse` with `media_type="text/event-stream"`
5. Each SSE event: `data: <token_chunk>\n\n`
6. Terminal event: `data: [DONE]\n\n`

**Mode → task mapping:**
```
feynman   → feynman_selection
flowchart → flowchart_selection
expand    → expand_selection
concise   → concise_selection
list      → format_selection  (custom_instructions: "Make a list")
table     → format_selection  (custom_instructions: "Make a table")
split     → format_selection  (custom_instructions: "Divide into shorter ideas...")
sections  → format_selection  (custom_instructions: "Divide into sub paragraphs...")
```

### 3. Frontend — `page.tsx` + `page.module.css`

#### Format bar layout

Replace the `<select>` + Send with a chip toolbar:

```
┌───────────────────────────────────────────────────────────────────┐
│  EDITOR AREA                                                      │
│                                                                   │
│  ┌─ Targeting Selection pill ──────────────────────────────────┐  │
│  │ ◉  Targeting Selection:    "...selected text..."        ✕   │  │
│  │    [↗ Expand]   [↙ Concise]   ← quick buttons, sel only    │  │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
├── FORMAT BAR ─────────────────────────────────────────────────────┤
│  [🧠 Feynman]  [⬡ Flowchart]  [≡ List]  [⊞ Table]  [÷ Split]   │
│   violet          cyan          ──── neutral chips ────           │
│                                                      [⟲]  [▶]   │
└───────────────────────────────────────────────────────────────────┘
```

#### Chip behavior
- Clicking a chip immediately calls `formatNote(mode)` — no separate Apply needed
- Feynman chip: `#7C3AED` violet accent (signals conceptual/teaching)
- Flowchart chip: `#0891B2` cyan accent (signals structural/visual)
- Neutral chips: dark background, amber border on hover

#### Expand / Concise
- Rendered **inside the Targeting Selection pill** when `selectedFormatText` is set
- Hidden when no text is selected
- Immediately call `formatNote("expand")` / `formatNote("concise")` on click

#### Streaming state (replaces formattingOverlay)
- `formattingOverlay` **removed entirely**
- While streaming: editor gets a glowing amber border (`box-shadow: 0 0 0 2px rgba(245,158,11,0.5)`)
- Active chip shows a small pulsing dot
- Editor textarea is set to `readOnly` during stream
- Tokens update `noteContent` progressively as they arrive

#### `formatNote(mode)` rewrite
```typescript
const formatNote = async (mode: string) => {
  // 1. Build request body
  // 2. fetch('/format/stream', { method: 'POST', ... })
  // 3. response.body.getReader() → read chunks in loop
  // 4. Parse SSE: split on '\n\n', extract 'data: ' prefix
  // 5. On [DONE]: finalize, save history, clear selectedFormatText
  // 6. Replace selected text range in noteContent with streamed result
  //    OR replace full noteContent for whole-note ops
}
```

---

## Design System (UI/UX)

- **Style:** Dark OLED, high contrast
- **Accent colors:** Amber CTA, violet for Feynman, cyan for Flowchart, neutral for structural ops
- **Icons:** SVG only (no emojis in UI)
- **Transitions:** 150–200ms on all interactive states
- **Touch targets:** Minimum 44×44px for all chips and action buttons
- **Streaming indicator:** Glowing amber editor border + pulsing dot on active chip
- **Accessibility:** `aria-label` on icon-only buttons, focus rings on all chips

---

## Files Changed

| File | Change |
|---|---|
| `usmle_error_note/config/tasks.yaml` | Add `feynman_selection`, `flowchart_selection`, `expand_selection`, `concise_selection` tasks |
| `usmle_error_note/server.py` | Add `/format/stream` SSE endpoint; add `format_mode` routing logic |
| `obsidian-chat/src/app/page.tsx` | Rewrite `formatNote()` to use SSE; replace select+send with chip toolbar; add Expand/Concise in selection pill; remove `formattingOverlay` |
| `obsidian-chat/src/app/page.module.css` | Add chip styles, streaming border animation, remove overlay styles |
