# Anki Card Editor Design
Date: 2026-03-01

## Overview

Three enhancements to the Anki tab in the obsidian-chat frontend:
1. Show all tags on each card (not just matching ones)
2. Inline card editing — raw cloze text, like Anki's native editor
3. Format button — LLM agent restructures card content using templates

## Approach

**Option A — Inline expand** (selected): Edit mode expands the card in place with raw-text textareas. Save/Format/Cancel buttons appear inline. No layout shift or modal needed.

## Component Changes

### Frontend (`obsidian-chat/src/app/page.tsx`)

**All tags:**
- Remove the `matchingTags`/`displayTags` filtering logic
- Always render the full `card.tags` array

**Edit state (new):**
```ts
const [editingCard, setEditingCard] = useState<number | null>(null);
const [editFront, setEditFront] = useState("");
const [editBack, setEditBack] = useState("");
const [ankiSaving, setAnkiSaving] = useState(false);
const [ankiFormatting, setAnkiFormatting] = useState(false);
const [ankiCardTemplates, setAnkiCardTemplates] = useState<{name:string; filename:string}[]>([]);
const [selectedCardTemplate, setSelectedCardTemplate] = useState("");
```

**Edit button:** visible when card is expanded and not in edit mode.
- `onClick`: set `editingCard = card.note_id`, `editFront = card.front`, `editBack = card.back`

**Edit mode UI (replaces rendered HTML when `editingCard === card.note_id`):**
- `<textarea>` for front (raw cloze)
- `<textarea>` for back (raw HTML/text)
- Template dropdown (populated from `GET /anki/card-templates`)
- **Save** button → `handleSaveCard(card.note_id)`
- **Format** button → `handleFormatCard(card.note_id)`
- **Cancel** button → `setEditingCard(null)`

**Handlers:**
- `handleSaveCard(note_id)` → `POST /anki/update {note_id, front: editFront, back: editBack}`; on success update the card in `ankiCards` state and exit edit mode
- `handleFormatCard(note_id)` → `POST /anki/format-card {front: editFront, back: editBack, template_filename: selectedCardTemplate}`; on success fill `editFront`/`editBack` with returned values (user reviews then saves)
- Load templates on Anki tab mount: `GET /anki/card-templates`

### CSS (`page.module.css`)

New classes: `.ankiEditTextarea`, `.ankiEditButtons`, `.ankiTemplateDropdown`, `.ankiSavingSpinner`

## Backend Changes

### `server.py`

**`POST /anki/update`** (sync def, runs in thread pool)
```
Request:  { note_id: int, front: str, back: str }
Response: { success: bool, error: str }
```
- Calls AnkiConnect `updateNoteFields` with `{id: note_id, fields: {"Text": front, "Extra": back}}`
- Returns 503 if AnkiConnect unreachable

**`POST /anki/format-card`** (async def, delegates to CrewAI)
```
Request:  { front: str, back: str, template_filename: str }
Response: { front: str, back: str, success: bool, error: str }
```
- Loads template from `crewAI/templates/anki/<template_filename>`
- Calls `build_anki_format_crew(front, back, template_content)`
- Returns reformatted front/back strings

**`GET /anki/card-templates`**
- Lists `.md` files from `crewAI/templates/anki/`
- Returns `{ templates: [{name, filename}] }`

### `models.py`

New models:
```python
class AnkiUpdateRequest(BaseModel):
    note_id: int
    front: str
    back: str

class AnkiUpdateResponse(BaseModel):
    success: bool
    error: str = ""

class AnkiFormatCardRequest(BaseModel):
    front: str
    back: str
    template_filename: str = ""

class AnkiFormatCardResponse(BaseModel):
    front: str
    back: str
    success: bool
    error: str = ""

class AnkiCardFormatOutput(BaseModel):
    front: str
    back: str
```

### `crew.py`

New function `build_anki_format_crew(front, back, template_content)`:
- Single agent: `anki_card_formatter`
- Single task: `format_anki_card`
- `output_pydantic=AnkiCardFormatOutput`

### `config/agents.yaml`

New agent `anki_card_formatter`:
- Role: Anki card structural formatter
- Goal: Restructure card front/back to match template format without changing content

### `config/tasks.yaml`

New task `format_anki_card`:
- Description: receives raw front, back, template; returns reformatted front and back
- Rules: preserve all cloze syntax `{{cN::...}}`; do not add or remove facts; match template structure only

### New Files

`crewAI/templates/anki/cloze_basic.md` — example template showing ideal cloze card structure:
- Front: concise question with blanked term as cloze
- Back: brief explanation, key context, optional mnemonic

## Data Flow

```
User clicks Edit
  → editingCard = note_id, editFront/editBack = raw card fields
  → textareas shown

User clicks Format
  → POST /anki/format-card {front, back, template_filename}
  → build_anki_format_crew → LLM returns {front, back}
  → editFront/editBack updated (user reviews)

User clicks Save
  → POST /anki/update {note_id, front, back}
  → AnkiConnect updateNoteFields
  → card state updated in ankiCards[]
  → editingCard = null
```

## Error Handling

- AnkiConnect unreachable → 503 with user-visible message
- LLM format fails → return original content, show error toast
- Save fails → stay in edit mode, show error inline

## Out of Scope

- Rich text / WYSIWYG editing
- Adding/removing cloze numbers
- Deleting cards
- Creating new cards
