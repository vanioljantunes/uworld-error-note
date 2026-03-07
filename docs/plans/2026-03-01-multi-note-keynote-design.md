# Design: Multi-Note Generation + Key Note Synthesis
Date: 2026-03-01

## Overview

Replace the current single-note-per-session workflow with a multi-micro-note approach where the LLM identifies 1–3 distinct knowledge gaps per question and creates one focused note per gap. Add side-by-side editing in the Editor mode and a Key Note button that synthesizes all notes referencing the current note into a single integrated note.

---

## 1. Multi-Note Generation

### Approach
Extend the existing 3-task sequential crew (Approach A). Remove the format task; use template_a.md as the direct composition guide.

### Crew changes
- **`infer_error_pattern`** — returns a `gaps: List[GapItem]` (1–3), each with its own slug, action (create/update), system tag, topic tag, and concept tags. Analyst scans vault to avoid duplicates.
- **`compose_note`** — iterates over the gap list and writes one micro-note per gap using template_a.md format. Each note embeds `[[wikilinks]]` to:
  - Other notes created in the same session (sibling notes)
  - Existing relevant vault notes discovered during analysis
- **`format_note`** task is **removed** — template_a.md structure is applied directly during composition.

### template_a.md format (micro-note structure)
```
---
type: micro_mechanism
created: <date>
tags: [<question_id>, <system>, <topic>, <slug>, <concept_tags...>]
---

# <Mechanism Title>

<Paragraph: what the mechanism is + embedded [[wikilinks]]>

<Paragraph: disease context / disruption consequences + [[wikilinks]]>

<Paragraph: "In questions, [pattern] should make me think of [concept]">

**Why I missed this before:**
<1–2 lines of personal confusion pattern>
```

### Model changes

**`models.py`:**
```python
class GapItem(BaseModel):
    slug: str
    action: str  # "create" | "update"
    existing_file: Optional[str]
    system_tag: str
    topic_tag: str
    concept_tags: List[str]

class ErrorPatternOutput(BaseModel):
    gaps: List[GapItem]  # replaces single-gap fields

class GenerateResponse(BaseModel):
    notes: List[NoteResult]  # replaces single-note fields
```

### API response
```json
{
  "notes": [
    { "action": "created", "file_path": "snare-mechanism.md", "tags": [...], "note_content": "..." },
    { "action": "updated", "file_path": "botulism-vs-myasthenia.md", "tags": [...], "note_content": "..." }
  ]
}
```

### Frontend chat display
Each note in the list is shown as a collapsible result card in the chat message. Header shows `✅ Created snare-mechanism.md` with expand toggle to view content.

---

## 2. Editor: Side-by-Side Editing

### Layout
When a note is selected, the editor pane splits:
- **Left 50%** — raw markdown `<textarea>`, fully editable
- **Right 50%** — live-rendered preview, updates on input (300ms debounce)

### Header buttons (left to right)
`Save` (appears when dirty) · `Format` · `Key Note` · `Obsidian ↗`

### Save behavior
- Dirty flag set when textarea content differs from loaded content
- `Save` button calls `POST /api/save-note` (new Next.js API route)
- Route writes raw content to `path.join(vaultPath, notePath)`
- On success: dirty flag clears, note list reloads

### New Next.js API route
`POST /api/save-note`
```json
Request:  { "vaultPath": "...", "notePath": "...", "content": "..." }
Response: { "success": true }
```

---

## 3. Key Note Button

### Trigger
"Key Note" button in editor header. Enabled only when a note is selected.

### Backend: `POST /keynote`
1. Read the current note from disk
2. Derive the note's title (first `# heading`) and slug (filename without `.md`)
3. Scan all `.md` files in vault for those containing `[[<title>]]` or `[[<slug>]]`
4. Pass current note + all referencing notes to `build_keynote_crew`
5. Return `{ suggested_filename: str, content: str }`

### Crew: `build_keynote_crew`
- Single agent (`keynote_synthesizer`) with one task (`synthesize_keynote`)
- Takes: current note content + list of referencing note contents
- Produces: a prose Key Note in template_a.md style that integrates all referenced micro-notes into one coherent mechanism note
- YAML frontmatter type: `key_note`, tags merged from all source notes

### Frontend flow
1. Click "Key Note" → loading state on button
2. Response arrives → content loaded into editor panes (textarea + preview) as **unsaved new note**
3. Suggested filename shown in a small editable input above the editor
4. User reviews/edits → clicks Save → writes to vault as new file

### New models
```python
class KeyNoteRequest(BaseModel):
    vault_path: str
    note_path: str

class KeyNoteResponse(BaseModel):
    suggested_filename: str
    content: str
    source_notes: List[str]  # paths of notes that were synthesized
    success: bool
    error: str = ""
```

---

## Files Changed

### Backend
| File | Change |
|------|--------|
| `usmle_error_note/models.py` | Add `GapItem`, update `ErrorPatternOutput`, update `GenerateResponse`, add `KeyNoteRequest`/`KeyNoteResponse` |
| `usmle_error_note/config/tasks.yaml` | Update `infer_error_pattern` + `compose_note`, remove `format_note`, add `synthesize_keynote` |
| `usmle_error_note/config/agents.yaml` | Add `keynote_synthesizer` |
| `usmle_error_note/crew.py` | Update `build_error_note_crew`, add `build_keynote_crew` |
| `usmle_error_note/server.py` | Update `/generate` response handling, add `/keynote` endpoint |

### Frontend
| File | Change |
|------|--------|
| `obsidian-chat/src/app/page.tsx` | Update `ErrorNoteResult` type, multi-note chat display, side-by-side editor, Save button, Key Note button + flow |
| `obsidian-chat/src/app/page.module.css` | Add split-pane styles, Key Note button styles |
| `obsidian-chat/src/app/api/save-note/route.ts` | New Next.js API route for writing note content to disk |
