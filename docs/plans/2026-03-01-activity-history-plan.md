# Activity History Panel, Card Detection & Unsuspend — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unified persisted activity feed in the right panel, note↔card linking by question ID, and unsuspend button on Anki cards.

**Architecture:** All linking is done via numeric question IDs shared between note frontmatter tags and Anki card tags (`tag::2513`). Activity history is stored in `localStorage`. Suspension status comes from AnkiConnect's `cardsInfo.queue` field. No new Next.js API routes — everything hits the existing FastAPI server or existing Next.js routes.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, CSS Modules, FastAPI (Python), AnkiConnect (local HTTP at port 8765).

**Design doc:** `docs/plans/2026-03-01-activity-history-design.md`

---

## Task 1: Add `card_id` and `suspended` to the Pydantic `AnkiCard` model

**Files:**
- Modify: `usmle_error_note/models.py` (lines 82-88)

**Step 1: Edit the `AnkiCard` model**

In `usmle_error_note/models.py`, replace:
```python
class AnkiCard(BaseModel):
    note_id: int
    front: str
    back: str
    deck: str
    tags: List[str]
    field_names: List[str] = []
```
With:
```python
class AnkiCard(BaseModel):
    note_id: int
    card_id: int = 0
    front: str
    back: str
    deck: str
    tags: List[str]
    field_names: List[str] = []
    suspended: bool = False
```

**Step 2: Commit**
```bash
git add usmle_error_note/models.py
git commit -m "feat: add card_id and suspended fields to AnkiCard model"
```

---

## Task 2: Populate `card_id` and `suspended` in the direct-search endpoint

**Files:**
- Modify: `usmle_error_note/server.py` (the `for card in cards_info:` loop, around line 672)

**Step 1: Update the `cards.append(AnkiCard(...))` call**

Find the existing `AnkiCard(...)` constructor call in `anki_direct_search` and add the two new fields:
```python
cards.append(AnkiCard(
    note_id=card["note"],
    card_id=card["cardId"],                         # new
    front=front,
    back=back,
    deck=card.get("deckName", ""),
    tags=tags_by_note.get(card["note"], []),
    field_names=field_keys[:2],
    suspended=card.get("queue", 0) == -1,           # new — queue -1 = suspended
))
```

**Step 2: Verify manually**

Start the FastAPI server (`uvicorn usmle_error_note.server:app --reload`) and make sure Anki is open. Run:
```bash
curl -s -X POST http://localhost:8000/anki/direct-search \
  -H "Content-Type: application/json" \
  -d '{"query": "deck:*"}' | python -m json.tool | grep -E "card_id|suspended"
```
Expected: each card object shows `"card_id": <number>` and `"suspended": false` (or `true` for suspended cards).

**Step 3: Commit**
```bash
git add usmle_error_note/server.py
git commit -m "feat: expose card_id and suspended in direct-search response"
```

---

## Task 3: Add `/anki/unsuspend` endpoint

**Files:**
- Modify: `usmle_error_note/models.py` (add request model)
- Modify: `usmle_error_note/server.py` (add endpoint after `/anki/update`)

**Step 1: Add request model to `models.py`**

After the `AnkiUpdateResponse` class, add:
```python
class AnkiUnsuspendRequest(BaseModel):
    card_ids: List[int]
```

**Step 2: Add endpoint to `server.py`**

After the `anki_update` endpoint, add:
```python
# ── POST /anki/unsuspend — Unsuspend Anki cards ───────────────────────────

@app.post("/anki/unsuspend")
def anki_unsuspend(req: AnkiUnsuspendRequest):
    """Unsuspend Anki cards by card ID via AnkiConnect."""
    try:
        _direct_anki("unsuspendCards", cards=req.card_ids)
        return {"success": True}
    except OSError:
        raise HTTPException(
            status_code=503,
            detail="AnkiConnect not reachable. Open Anki with the AnkiConnect plugin installed.",
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
```

Also add the import at the top of server.py — `AnkiUnsuspendRequest` must be imported from models. Find the existing import line for Anki models and add it:
```python
from models import (
    ...
    AnkiUnsuspendRequest,   # add this
)
```

**Step 3: Verify manually**

With Anki open, find a suspended card ID from a direct-search response and run:
```bash
curl -s -X POST http://localhost:8000/anki/unsuspend \
  -H "Content-Type: application/json" \
  -d '{"card_ids": [<card_id_here>]}'
```
Expected: `{"success": true}`. The card should now be unsuspended in Anki.

**Step 4: Commit**
```bash
git add usmle_error_note/models.py usmle_error_note/server.py
git commit -m "feat: add /anki/unsuspend endpoint"
```

---

## Task 4: Update TypeScript interfaces and add `ActivityItem` type

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx` (top of file, interfaces section)

**Step 1: Update `AnkiCard` interface**

Find the existing `AnkiCard` interface and add the two new fields:
```typescript
interface AnkiCard {
  note_id: number;
  card_id: number;        // new
  front: string;
  back: string;
  deck: string;
  tags: string[];
  field_names: string[];
  suspended: boolean;     // new
}
```

**Step 2: Add `ActivityItem` interface**

Add after the `AnkiCard` interface:
```typescript
interface ActivityItem {
  type: "note" | "card";
  questionId: string;       // numeric tag, e.g. "2513"
  title: string;            // note title or card front (truncated to 50 chars)
  notePath?: string;        // for note items
  noteId?: number;          // for card items (Anki note_id)
  savedAt: number;          // Unix ms timestamp
}
```

**Step 3: Commit**
```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: add card_id/suspended to AnkiCard interface, add ActivityItem type"
```

---

## Task 5: Add activity history state and localStorage persistence

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

**Step 1: Add state and load from localStorage on mount**

In the state declarations section, add after the `ankiEditHistory` state:
```typescript
const [activityHistory, setActivityHistory] = useState<ActivityItem[]>([]);
```

Add a new `useEffect` after the existing mount effects (e.g. after the `useEffect` that loads notes):
```typescript
// Load activity history from localStorage on mount
useEffect(() => {
  try {
    const stored = localStorage.getItem("obsidianChatActivity");
    if (stored) setActivityHistory(JSON.parse(stored));
  } catch { }
}, []);
```

**Step 2: Add helper to append an activity item**

Add this function near the other helper functions (after `stripHtml`):
```typescript
const addActivity = (item: Omit<ActivityItem, "savedAt">) => {
  setActivityHistory((prev) => {
    const next = [{ ...item, savedAt: Date.now() }, ...prev].slice(0, 50);
    try { localStorage.setItem("obsidianChatActivity", JSON.stringify(next)); } catch { }
    return next;
  });
};
```

**Step 3: Call `addActivity` when a note is saved**

In the `saveNote` function, after `const data = await resp.json();` and inside the success branch (where `data.success` is confirmed), add:
```typescript
// Extract numeric question IDs from note's tags
const qId = (selectedNote.tags || []).find((t) => /^\d+$/.test(t)) || "";
addActivity({
  type: "note",
  questionId: qId,
  title: selectedNote.title,
  notePath: selectedNote.path,
});
```

**Step 4: Call `addActivity` when a card is saved**

In `handleSaveCard`, inside the `if (data.success)` block, replace the existing `setAnkiEditHistory(...)` call with:
```typescript
const qId = card.tags.find((t) => /^\d+$/.test(t)) || "";
addActivity({
  type: "card",
  questionId: qId,
  title: stripHtml(editFront).slice(0, 50),
  noteId: card.note_id,
});
```

You can also remove the old `ankiEditHistory` state and its `setAnkiEditHistory` call since the unified feed replaces it. Search for `ankiEditHistory` and `setAnkiEditHistory` and delete those lines.

**Step 5: Verify manually**

Open the app, save a note in editor mode, then save a card in Anki mode. Open browser devtools → Application → Local Storage → `obsidianChatActivity`. It should contain a JSON array with two items (the note and card you just saved).

**Step 6: Commit**
```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: add activity history state with localStorage persistence"
```

---

## Task 6: Add card-detection state for the editor

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

**Step 1: Add card-detection state**

In the state declarations, add after `activityHistory`:
```typescript
const [noteCardCounts, setNoteCardCounts] = useState<Record<string, number | null>>({});
// null = loading, -1 = Anki unavailable, 0 = no cards, N = card count
```

**Step 2: Add the detection effect**

Add a `useEffect` that fires when `selectedNote` or `noteContent` changes:
```typescript
useEffect(() => {
  if (!selectedNote || !noteContent) {
    setNoteCardCounts({});
    return;
  }
  // Extract numeric tags
  const numericTags = (selectedNote.tags || []).filter((t) => /^\d+$/.test(t));
  if (numericTags.length === 0) {
    setNoteCardCounts({});
    return;
  }
  // Initialise all to null (loading)
  const initial: Record<string, number | null> = {};
  numericTags.forEach((t) => (initial[t] = null));
  setNoteCardCounts(initial);

  // Query each tag independently
  numericTags.forEach(async (qId) => {
    try {
      const resp = await fetch(`${CREWAI_URL}/anki/direct-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: qId }),
      });
      if (!resp.ok) { setNoteCardCounts((p) => ({ ...p, [qId]: -1 })); return; }
      const data = await resp.json();
      setNoteCardCounts((p) => ({ ...p, [qId]: data.cards?.length ?? 0 }));
    } catch {
      setNoteCardCounts((p) => ({ ...p, [qId]: -1 }));
    }
  });
}, [selectedNote]);
```

**Step 3: Commit**
```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: add card-detection effect for editor note selection"
```

---

## Task 7: Rewrite the right panel as unified Activity Feed

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx` (the `{/* Right Sidebar */}` section, lines ~1714-1818)

**Step 1: Replace the right panel JSX**

Find the entire `{/* Right Sidebar */}` block starting at `<div className={styles.sourcesPanel}>` and ending at the closing `</div>` before `</div>` at the end of the return. Replace it entirely with:

```tsx
{/* Right Sidebar — always Activity */}
<div className={styles.sourcesPanel}>
  <h3>Activity</h3>

  {/* Workflow stepper — only during active workflow */}
  {isInWorkflow && (
    <div className={styles.workflowStepper}>
      {workflowSteps.map((step) => {
        const stepIdx = stepOrder.indexOf(step.key);
        return (
          <div key={step.key} className={`${styles.workflowStepItem} ${currentStepIndex > stepIdx ? styles.stepDone : ""} ${currentStepIndex === stepIdx ? styles.stepActive : ""}`}>
            <div className={`${styles.stepIcon} ${currentStepIndex > stepIdx ? styles.stepIconDone : ""}`}>
              {currentStepIndex > stepIdx ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
              ) : currentStepIndex === stepIdx ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinIcon} aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>
              )}
            </div>
            <div className={styles.stepLabel}>{step.label}</div>
          </div>
        );
      })}
      {errorNoteResult && errorNoteResult.notes && (
        <div>
          {errorNoteResult.notes.map((note, i) => (
            <div key={i} className={styles.resultCard}>
              <div className={styles.resultHeader}>Note {i + 1}: {note.action === "created" ? "Created" : note.action === "error" ? "Error" : "Updated"}</div>
              <div className={styles.resultItem}><strong>Path:</strong> {note.file_path}</div>
              <div className={styles.resultItem}><strong>Pattern:</strong> {note.error_pattern}</div>
              <div className={styles.resultTagList}>{(note.tags || []).map((tag, j) => (<span key={j} className={styles.resultTag}>{tag}</span>))}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )}

  {/* Context zone — card detection for currently open note */}
  {viewMode === "editor" && selectedNote && Object.keys(noteCardCounts).length > 0 && (
    <div className={styles.activityContext}>
      <div className={styles.activityContextLabel}>Question IDs in this note</div>
      {Object.entries(noteCardCounts).map(([qId, count]) => (
        <div key={qId} className={styles.activityContextRow}>
          <span className={styles.activityQId}>{qId}</span>
          {count === null ? (
            <span className={styles.activityStatus}>⏳</span>
          ) : count === -1 ? (
            <span className={styles.activityStatus} style={{ color: "var(--text-muted)" }}>? unavailable</span>
          ) : count === 0 ? (
            <button
              className={styles.activityLink}
              onClick={() => {
                setViewMode("anki");
                setAnkiCreateNote(selectedNote.path);
                setAnkiCreateTagFilter(qId);
              }}
            >
              ⬜ No cards → create
            </button>
          ) : (
            <button
              className={styles.activityLink}
              onClick={() => {
                setViewMode("anki");
                setAnkiQuery(qId);
                // Auto-trigger search
                fetch(`${CREWAI_URL}/anki/direct-search`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ query: qId }),
                }).then((r) => r.json()).then((data) => {
                  if (!data.error) {
                    const seen = new Set<number>();
                    const unique = (data.cards || []).filter((c: AnkiCard) => {
                      if (seen.has(c.note_id)) return false;
                      seen.add(c.note_id);
                      return true;
                    });
                    setAnkiCards(unique);
                  }
                }).catch(() => {});
              }}
            >
              ✅ {count} card{count !== 1 ? "s" : ""} → view
            </button>
          )}
        </div>
      ))}
    </div>
  )}

  {/* Activity history feed */}
  <div className={styles.activitySection}>
    <div className={styles.sourcesHeading}>History</div>
    {activityHistory.length === 0 ? (
      <div className={styles.activityEmpty}>No edits yet this session</div>
    ) : (
      <div className={styles.activityList}>
        {activityHistory.map((item, i) => {
          const ago = (() => {
            const diff = Date.now() - item.savedAt;
            if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
            if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
            return `${Math.floor(diff / 3600000)}h ago`;
          })();
          return (
            <button
              key={i}
              className={styles.activityItem}
              onClick={() => {
                if (item.type === "note" && item.notePath) {
                  setViewMode("editor");
                  const note = allNotes.find((n) => n.path === item.notePath);
                  if (note) openNote(note);
                } else if (item.type === "card" && item.questionId) {
                  setViewMode("anki");
                  setAnkiQuery(item.questionId);
                  fetch(`${CREWAI_URL}/anki/direct-search`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ query: item.questionId }),
                  }).then((r) => r.json()).then((data) => {
                    if (!data.error) {
                      const seen = new Set<number>();
                      const unique = (data.cards || []).filter((c: AnkiCard) => {
                        if (seen.has(c.note_id)) return false;
                        seen.add(c.note_id);
                        return true;
                      });
                      setAnkiCards(unique);
                    }
                  }).catch(() => {});
                }
              }}
            >
              <span className={styles.activityIcon}>{item.type === "note" ? "📝" : "🃏"}</span>
              <div className={styles.activityItemBody}>
                <div className={styles.activityTitle}>{item.title}</div>
                <div className={styles.activityMeta}>
                  {item.questionId && <span className={styles.activityQIdSmall}>{item.questionId}</span>}
                  <span>{ago}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    )}
  </div>
</div>
```

Note: `openNote` is the existing function that sets `selectedNote` and loads the note content. Check the actual function name in the codebase — it may be an inline handler or a named function. If it's inline, extract it or replicate its logic: `setSelectedNote(note); /* load note content */`.

**Step 2: Extract `openNote` as a reusable function** (if not already one)

Search for where `selectedNote` is set when clicking a note in the editor list. Wrap those lines in a named `const openNote = async (note: Note) => { ... }` so the activity item click handler can call it.

**Step 3: Verify manually**

Load the app. The right panel should always say "Activity" at the top. During a workflow, the stepper appears above. When in editor with a note selected that has numeric tags, the context zone appears below the stepper.

**Step 4: Commit**
```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: rewrite right panel as unified activity feed"
```

---

## Task 8: Add unsuspend button to Anki cards

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

**Step 1: Add `handleUnsuspend` function**

Add after `handleFormatCard`:
```typescript
const handleUnsuspend = async (card: AnkiCard) => {
  try {
    const resp = await fetch(`${CREWAI_URL}/anki/unsuspend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_ids: [card.card_id] }),
    });
    if (resp.ok) {
      setAnkiCards((prev) =>
        prev.map((c) => c.note_id === card.note_id ? { ...c, suspended: false } : c)
      );
    } else {
      setAnkiEditError("Unsuspend failed — is Anki open?");
    }
  } catch {
    setAnkiEditError("Could not reach backend.");
  }
};
```

**Step 2: Add suspended badge and unsuspend button in the card list JSX**

In the card rendering section, find where the deck name is displayed (inside the card header or footer area). After the deck name, add the suspended badge:
```tsx
{card.suspended && (
  <span className={styles.suspendedBadge}>suspended</span>
)}
```

Find where the `Edit` button is rendered per card (in the non-editing state). After the Edit button, add:
```tsx
{card.suspended && (
  <button
    className={styles.unsuspendBtn}
    onClick={(e) => { e.stopPropagation(); handleUnsuspend(card); }}
  >
    Unsuspend ↑
  </button>
)}
```

**Step 3: Verify manually**

Search for a query that returns suspended cards (try `is:suspended` in the Anki search). Each suspended card should show the badge and the Unsuspend button. Clicking it should make both disappear.

**Step 4: Commit**
```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: add unsuspend button and suspended badge to Anki cards"
```

---

## Task 9: Add CSS for new UI elements

**Files:**
- Modify: `obsidian-chat/src/app/page.module.css` (append to end of file)

**Step 1: Append the new classes**

```css
/* ── Activity Feed (right panel) ──────────────────────────────────────── */

.activityContext {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.activityContextLabel {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.activityContextRow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.activityQId {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  min-width: 40px;
}

.activityStatus {
  font-size: 12px;
  color: var(--text-muted);
}

.activityLink {
  font-size: 12px;
  color: #a78bfa;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
  text-align: left;
}

.activityLink:hover {
  text-decoration: underline;
}

.activitySection {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 16px;
}

.activityList {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 8px;
}

.activityItem {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 8px;
  border-radius: 6px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  font-family: inherit;
  transition: background 0.15s;
}

.activityItem:hover {
  background: var(--bg-elevated);
}

.activityIcon {
  font-size: 13px;
  flex-shrink: 0;
  margin-top: 1px;
}

.activityItemBody {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.activityTitle {
  font-size: 12px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.activityMeta {
  display: flex;
  gap: 6px;
  font-size: 10px;
  color: var(--text-muted);
}

.activityQIdSmall {
  background: var(--bg-elevated);
  border-radius: 3px;
  padding: 0 4px;
  font-weight: 600;
}

.activityEmpty {
  font-size: 12px;
  color: var(--text-muted);
  padding: 12px 16px;
}

/* ── Suspended badge & unsuspend button ──────────────────────────────── */

.suspendedBadge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(251, 191, 36, 0.12);
  color: #fbbf24;
  letter-spacing: 0.4px;
  text-transform: uppercase;
}

.unsuspendBtn {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: background 0.15s;
}

.unsuspendBtn:hover {
  background: rgba(251, 191, 36, 0.2);
}
```

**Step 2: Verify visually**

Check each new UI element in the browser: activity feed items, context zone rows, suspended badge, unsuspend button.

**Step 3: Commit**
```bash
git add obsidian-chat/src/app/page.module.css
git commit -m "feat: add CSS for activity feed, context zone, suspended badge, and unsuspend button"
```

---

## Summary of all changed files

| File | What changes |
|------|-------------|
| `usmle_error_note/models.py` | `AnkiCard` gets `card_id`, `suspended`; add `AnkiUnsuspendRequest` |
| `usmle_error_note/server.py` | Populate new fields in direct-search; add `/anki/unsuspend` endpoint |
| `obsidian-chat/src/app/page.tsx` | `AnkiCard` TS interface; `ActivityItem` type; history state + localStorage; `addActivity` helper; `openNote` function; card-detection effect; right panel rewrite; `handleUnsuspend`; call `addActivity` in `saveNote` and `handleSaveCard` |
| `obsidian-chat/src/app/page.module.css` | New classes for activity feed and suspended/unsuspend UI |
