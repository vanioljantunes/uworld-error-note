# Activity History Panel, Card Detection & Unsuspend

Date: 2026-03-01

## Overview

Three related features that make the right sidebar more useful across all views:

1. **Unified Activity Feed** — right panel always shows a persisted history of note saves and card edits
2. **Note→Card Detection** — editor shows which question IDs in the current note have Anki cards
3. **Unsuspend Cards** — button on suspended Anki cards to unsuspend them from the app

---

## Linking Mechanism

Notes and Anki cards are linked by **question ID** (e.g. `2513`). Both store it the same way:
- Obsidian note frontmatter: `tags: [2513, neuro]`
- Anki card tag: `tag::2513`

Numeric tags are treated as question IDs; non-numeric tags are ignored for linking.

---

## Section 1: Unified Activity Feed (Right Panel)

### Data Shape

```ts
interface ActivityItem {
  type: "note" | "card";
  questionId: string;        // numeric tag, e.g. "2513"
  title: string;             // note title or card front (truncated)
  notePath?: string;         // for note items — used for navigation
  noteId?: number;           // for card items — Anki note_id
  savedAt: number;           // Unix ms timestamp
}
```

### Persistence

Stored in `localStorage` under key `"obsidianChatActivity"`. Loaded on mount via `useEffect`. Max 50 items — oldest pruned when limit is exceeded.

### Panel Structure

The right panel always renders "Activity" regardless of `viewMode`.

**Zone 1 — Context (only when editor + note selected):**
Shows question IDs from the current note's numeric frontmatter tags. For each ID, queries `/anki/direct-search` once on note selection. Results:
- `2513 · ✅ 3 cards [→ view]` — click: switch to Anki view, set query = `"2513"`, auto-search
- `1997 · ⬜ No cards [→ create]` — click: switch to Anki view, set `ankiCreateNote` = note path, scroll to Create Card section
- If Anki unreachable: shows `? unavailable` with no link

**Zone 2 — History (always):**
Newest-first chronological list. Each item shows:
- Icon: `📝` for note, `🃏` for card
- Title (truncated to ~50 chars)
- Question ID badge
- Relative timestamp

Clicking a note item → switches to Editor, opens that note.
Clicking a card item → switches to Anki, searches for that question ID.

**Workflow stepper** stays at the top of the panel, visible only during active workflow (above both zones).

### When items are added

- **Note item**: when `saveNote()` succeeds — adds item with `type: "note"`, path, title, and numeric tags from frontmatter
- **Card item**: when `handleSaveCard()` succeeds — adds item with `type: "card"`, `note_id`, front text, and numeric tags from card's tag list

---

## Section 2: Note Editor — Card Detection

**Trigger:** when `selectedNote` changes in editor view.

**Steps:**
1. Extract numeric tags from `noteContent` frontmatter
2. For each numeric tag, call `/anki/direct-search` with query `tag:*::<id>`
3. Store results in local state: `Map<string, number>` (questionId → card count, -1 = unavailable)
4. Display in Zone 1 of the right panel (see above)

**State added to page:**
```ts
const [noteCardCounts, setNoteCardCounts] = useState<Record<string, number | null>>({});
// null = loading, -1 = unavailable, 0 = none, N = count
```

**No new API routes** — reuses existing `/anki/direct-search`.

---

## Section 3: Unsuspend Cards

### Backend changes (`server.py`)

**`AnkiCard` model** gains `card_id: int` and `suspended: bool` (derived from `queue === -1` in cardsInfo).

**`direct-search` response** populates both new fields:
```python
cards.append(AnkiCard(
    note_id=card["note"],
    card_id=card["cardId"],        # new
    suspended=card.get("queue", 0) == -1,   # new
    ...
))
```

**New endpoint** `POST /anki/unsuspend`:
```python
class AnkiUnsuspendRequest(BaseModel):
    card_ids: list[int]

@app.post("/anki/unsuspend")
def anki_unsuspend(req: AnkiUnsuspendRequest):
    _direct_anki("unsuspendCards", cards=req.card_ids)
    return {"success": True}
```

### Frontend changes (`page.tsx`)

**`AnkiCard` interface** gains:
```ts
card_id: number;
suspended: boolean;
```

**Per-card UI**: when `card.suspended`:
- Show a muted `suspended` badge next to the deck name
- Show `Unsuspend ↑` button alongside `Edit`

**`handleUnsuspend(card)`** function:
- Calls `POST /anki/unsuspend` with `card_ids: [card.card_id]`
- On success: updates `ankiCards` state to set `suspended: false` for that card
- On error: shows inline error message

---

## Files Changed

| File | Change |
|------|--------|
| `obsidian-chat/src/app/page.tsx` | Add `ActivityItem` type, history state, localStorage load/save, right panel rewrite, card detection logic, unsuspend handler, `AnkiCard` interface update |
| `obsidian-chat/src/app/page.module.css` | New classes for activity feed, context zone, suspended badge |
| `usmle_error_note/server.py` | Add `card_id` + `suspended` to `AnkiCard` model and direct-search; add `/anki/unsuspend` endpoint |
| `usmle_error_note/models.py` | Update `AnkiCard` Pydantic model |
