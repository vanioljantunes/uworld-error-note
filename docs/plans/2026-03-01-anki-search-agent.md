# Anki Search Agent Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an Anki card search section to the UWorld Error-Note app — a YAML-defined `anki_search_agent` backed by AnkiConnect (port 8765), accessible via a new "Anki" tab in the `obsidian-chat` frontend.

**Architecture:** Two new `@tool` functions call AnkiConnect's local REST API. A new `anki_search_agent` / `search_anki_cards` pair in the YAML files drives a new `build_anki_crew()`. A `POST /anki/search` FastAPI endpoint returns structured `AnkiCard` results. The Next.js frontend adds a third `viewMode = "anki"` with a sidebar search box and expandable card results.

**Tech Stack:** Python `urllib.request` (stdlib, no new deps), CrewAI, FastAPI, React/TypeScript/Next.js

---

## Task 1: Add AnkiConnect tools to `tools.py`

**Files:**
- Modify: `usmle_error_note/tools.py`

### Step 1: Add the `_anki_request` helper and two new tools at the end of the file

Append the following to `usmle_error_note/tools.py` (after line 101, the last line):

```python


# ── AnkiConnect tools ─────────────────────────────────────────────────────

import json as _json
import urllib.request as _urllib_request


def _anki_request(action: str, **params) -> object:
    """Call AnkiConnect (port 8765) and return the result field."""
    payload = _json.dumps({"action": action, "version": 6, "params": params}).encode()
    req = _urllib_request.Request(
        "http://localhost:8765",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with _urllib_request.urlopen(req, timeout=5) as resp:
        result = _json.loads(resp.read())
    if result.get("error"):
        raise ValueError(result["error"])
    return result["result"]


@tool("anki_search_notes")
def anki_search_notes(query: str) -> str:
    """Search Anki cards via AnkiConnect. Supports full Anki search syntax
    (e.g. 'tag:neurology', 'deck:USMLE', 'diabetes'). Returns up to 20
    matching cards as JSON with front, back, deck, tags, and note_id."""
    try:
        card_ids = _anki_request("findCards", query=query)
        if not card_ids:
            return _json.dumps({"cards": [], "total": 0})

        card_ids = list(card_ids)[:20]
        cards_info = _anki_request("cardsInfo", cards=card_ids)

        # Fetch tags (stored on notes, not cards)
        note_ids = list({c["note"] for c in cards_info})
        notes_info = _anki_request("notesInfo", notes=note_ids)
        tags_by_note = {n["noteId"]: n.get("tags", []) for n in notes_info}

        cards = []
        for card in cards_info:
            fields = card.get("fields", {})
            front = fields.get("Front", {}).get("value", "")
            back = fields.get("Back", {}).get("value", "")
            cards.append({
                "note_id": card.get("note"),
                "front": front,
                "back": back,
                "deck": card.get("deckName", ""),
                "tags": tags_by_note.get(card.get("note", 0), []),
            })

        return _json.dumps({"cards": cards, "total": len(cards)})

    except OSError:
        return "Error: Cannot connect to AnkiConnect at http://localhost:8765. Make sure Anki is open with the AnkiConnect plugin installed."
    except ValueError as e:
        return f"AnkiConnect error: {str(e)}"
    except Exception as e:
        return f"Error: {str(e)}"


@tool("anki_get_decks")
def anki_get_decks(dummy: str = "") -> str:
    """List all deck names from Anki via AnkiConnect. Returns JSON with a 'decks' list."""
    try:
        decks = _anki_request("deckNames")
        return _json.dumps({"decks": decks})
    except OSError:
        return "Error: Cannot connect to AnkiConnect. Is Anki open?"
    except Exception as e:
        return f"Error: {str(e)}"
```

### Step 2: Manually verify the tools parse correctly

Run from `usmle_error_note/`:
```
python -c "from tools import anki_search_notes, anki_get_decks; print('OK')"
```
Expected: `OK` (with Anki closed, this only checks import, not connectivity)

### Step 3: Commit

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI"
git add usmle_error_note/tools.py
git commit -m "feat: add anki_search_notes and anki_get_decks tools"
```

---

## Task 2: Add agent and task definitions to YAML files

**Files:**
- Modify: `usmle_error_note/config/agents.yaml`
- Modify: `usmle_error_note/config/tasks.yaml`

### Step 1: Append `anki_search_agent` to `agents.yaml`

Add the following at the end of `usmle_error_note/config/agents.yaml` (after line 59):

```yaml

anki_search_agent:
  role: >
    Anki Card Search Specialist
  goal: >
    Search the user's Anki collection using AnkiConnect tools and return
    relevant cards with their front text, back text, deck name, and tags.
    Always call the anki_search_notes tool with the provided query and
    return the result as structured JSON.
  backstory: >
    You are a study assistant with direct access to the user's local Anki
    collection. You use the anki_search_notes tool to find cards matching
    any query. You return exactly what the tool gives you without summarizing
    or modifying the content — your job is accurate retrieval, not analysis.
```

### Step 2: Append `search_anki_cards` to `tasks.yaml`

Add the following at the end of `usmle_error_note/config/tasks.yaml` (after line 157):

```yaml

search_anki_cards:
  description: >
    Search the Anki collection for cards matching this query: {query}

    Steps:
    1. Call the anki_search_notes tool with the query string exactly as given.
       The query supports full Anki search syntax (e.g. "tag:neurology", "deck:USMLE").
    2. Return the tool output as-is. Do NOT rephrase, summarize, or alter the card content.
    3. If the tool returns an error message (starts with "Error:"), return it as:
       {{"cards": [], "total": 0, "error": "<the error message>"}}
  expected_output: >
    A JSON object with key "cards" (list of objects with note_id, front, back, deck, tags)
    and key "total" (integer count). If an error occurs, include an "error" key.
  agent: anki_search_agent
```

### Step 3: Verify YAML is valid

Run:
```
python -c "import yaml; yaml.safe_load(open('usmle_error_note/config/agents.yaml')); print('agents OK')"
python -c "import yaml; yaml.safe_load(open('usmle_error_note/config/tasks.yaml')); print('tasks OK')"
```
Expected: `agents OK` then `tasks OK`

### Step 4: Commit

```bash
git add usmle_error_note/config/agents.yaml usmle_error_note/config/tasks.yaml
git commit -m "feat: add anki_search_agent and search_anki_cards to YAML configs"
```

---

## Task 3: Add Pydantic models to `models.py`

**Files:**
- Modify: `usmle_error_note/models.py`

### Step 1: Add `AnkiCard`, `AnkiSearchRequest`, `AnkiSearchResponse` models

Append the following to `usmle_error_note/models.py` (after line 72, the last line):

```python


# ── Anki search models ────────────────────────────────────────────────────

class AnkiCard(BaseModel):
    note_id: int
    front: str
    back: str
    deck: str
    tags: List[str]

class AnkiSearchRequest(BaseModel):
    query: str

class AnkiSearchResponse(BaseModel):
    cards: List[AnkiCard]
    total: int
    error: Optional[str] = None
```

### Step 2: Verify import

```
python -c "from models import AnkiCard, AnkiSearchRequest, AnkiSearchResponse; print('OK')"
```
Expected: `OK`

### Step 3: Commit

```bash
git add usmle_error_note/models.py
git commit -m "feat: add AnkiCard, AnkiSearchRequest, AnkiSearchResponse models"
```

---

## Task 4: Add `build_anki_crew()` to `crew.py`

**Files:**
- Modify: `usmle_error_note/crew.py`

### Step 1: Add the new tool imports at the top

Find the existing import block at lines 13-18:
```python
from tools import (
    vault_list_files,
    vault_read_note,
    vault_search_tags,
    vault_write_note,
)
```

Replace it with:
```python
from tools import (
    vault_list_files,
    vault_read_note,
    vault_search_tags,
    vault_write_note,
    anki_search_notes,
    anki_get_decks,
)
```

### Step 2: Add the new model import at line 19

Find:
```python
from models import QuestionsOutput, ErrorPatternOutput, NoteResult
```

Replace with:
```python
from models import QuestionsOutput, ErrorPatternOutput, NoteResult, AnkiSearchResponse
```

### Step 3: Append `build_anki_crew()` at the end of `crew.py` (after line 231)

```python


# ── Anki Search Crew ──────────────────────────────────────────────────────

def build_anki_crew(query: str) -> Crew:
    """Build a crew that searches Anki cards for a given query via AnkiConnect."""
    agents_cfg = _load_yaml("agents.yaml")
    tasks_cfg = _load_yaml("tasks.yaml")

    anki_agent = _make_agent(
        "anki_search_agent",
        agents_cfg,
        tools=[anki_search_notes, anki_get_decks],
    )

    task_cfg = tasks_cfg["search_anki_cards"]
    description = task_cfg["description"].strip().format(query=query)
    expected_output = task_cfg["expected_output"].strip()

    search_task = Task(
        description=description,
        expected_output=expected_output,
        agent=anki_agent,
        output_pydantic=AnkiSearchResponse,
    )

    return Crew(
        agents=[anki_agent],
        tasks=[search_task],
        process=Process.sequential,
        verbose=True,
    )
```

### Step 4: Verify import

```
python -c "from crew import build_anki_crew; print('OK')"
```
Expected: `OK`

### Step 5: Commit

```bash
git add usmle_error_note/crew.py
git commit -m "feat: add build_anki_crew() using anki_search_agent"
```

---

## Task 5: Add `POST /anki/search` endpoint to `server.py`

**Files:**
- Modify: `usmle_error_note/server.py`

### Step 1: Update the FastAPI import at line 18 to include `HTTPException`

Find:
```python
from fastapi import FastAPI
```

Replace with:
```python
from fastapi import FastAPI, HTTPException
```

### Step 2: Update the models import block (lines 23-28)

Find:
```python
from models import (
    QuestionsRequest,
    QuestionsResponse,
    GenerateRequest,
    GenerateResponse,
)
```

Replace with:
```python
from models import (
    QuestionsRequest,
    QuestionsResponse,
    GenerateRequest,
    GenerateResponse,
    AnkiSearchRequest,
    AnkiSearchResponse,
    AnkiCard,
)
```

### Step 3: Update the crew import at line 29

Find:
```python
from crew import build_questions_crew, build_error_note_crew, build_format_crew, list_templates
```

Replace with:
```python
from crew import build_questions_crew, build_error_note_crew, build_format_crew, list_templates, build_anki_crew
```

### Step 4: Append the new endpoint before `if __name__ == "__main__":` (before line 336)

Add the following block right before `if __name__ == "__main__":`:

```python

# ── POST /anki/search — Search Anki cards via AnkiConnect ─────────────────

@app.post("/anki/search", response_model=AnkiSearchResponse)
async def anki_search(req: AnkiSearchRequest):
    """Search Anki cards using the anki_search_agent CrewAI crew."""
    try:
        crew = build_anki_crew(req.query)
        result = crew.kickoff(inputs={"query": req.query})

        # Prefer structured pydantic output from the task
        if hasattr(result, "pydantic") and result.pydantic:
            return result.pydantic

        # Fallback: parse raw JSON text from the agent
        raw = str(result).strip()
        try:
            parsed = json.loads(raw)
            cards = [AnkiCard(**c) for c in parsed.get("cards", [])]
            error_msg = parsed.get("error")
            return AnkiSearchResponse(cards=cards, total=len(cards), error=error_msg)
        except (json.JSONDecodeError, ValueError):
            # If the agent returned an error string from the tool
            if raw.startswith("Error:") or "Cannot connect" in raw:
                raise HTTPException(status_code=503, detail=raw)
            return AnkiSearchResponse(cards=[], total=0)

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        msg = str(e)
        if "Cannot connect to AnkiConnect" in msg or "Connection refused" in msg:
            raise HTTPException(
                status_code=503,
                detail="AnkiConnect not reachable. Open Anki with the AnkiConnect plugin installed.",
            )
        raise HTTPException(status_code=500, detail=msg)

```

### Step 5: Verify the server starts cleanly (with Anki closed is fine — just checking imports)

```
cd usmle_error_note && python -c "import server; print('Server imports OK')"
```
Expected: `Server imports OK`

### Step 6: Commit

```bash
git add usmle_error_note/server.py
git commit -m "feat: add POST /anki/search endpoint"
```

---

## Task 6: Add Anki tab to the Next.js frontend (`page.tsx`)

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

### Step 1: Extend `ViewMode` type (line 6)

Find:
```typescript
type ViewMode = "chat" | "editor";
```
Replace with:
```typescript
type ViewMode = "chat" | "editor" | "anki";
```

### Step 2: Add `AnkiCard` interface (after `ErrorNoteResult` interface, after line 39)

Find:
```typescript
const CREWAI_URL = "http://localhost:8000";
```
Replace with:
```typescript
interface AnkiCard {
  note_id: number;
  front: string;
  back: string;
  deck: string;
  tags: string[];
}

const CREWAI_URL = "http://localhost:8000";
```

### Step 3: Add Anki state variables (after the editor mode state block, after line 97)

Find:
```typescript
  // Progressive loading state
  const [statusMsg, setStatusMsg] = useState("");
```
Replace with:
```typescript
  // Anki search mode
  const [ankiQuery, setAnkiQuery] = useState("");
  const [ankiCards, setAnkiCards] = useState<AnkiCard[]>([]);
  const [ankiLoading, setAnkiLoading] = useState(false);
  const [ankiError, setAnkiError] = useState("");
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  // Progressive loading state
  const [statusMsg, setStatusMsg] = useState("");
```

### Step 4: Add `handleAnkiSearch` function (after the `handleFormatChat` function, after line 438)

Find:
```typescript
  // Other handlers
  const handleReindex = async () => {
```
Replace with:
```typescript
  // ── Anki Search ────────────────────────────────────────────────────────

  const handleAnkiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ankiQuery.trim() || ankiLoading) return;
    setAnkiLoading(true);
    setAnkiError("");
    setAnkiCards([]);
    setExpandedCards(new Set());
    try {
      const resp = await fetch(`${CREWAI_URL}/anki/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ankiQuery }),
      });
      if (resp.status === 503) {
        setAnkiError("Anki is not running. Open Anki with the AnkiConnect plugin installed.");
        return;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) {
        setAnkiError(data.error);
      } else {
        setAnkiCards(data.cards || []);
      }
    } catch (err) {
      setAnkiError("Failed to reach the backend. Is the server running?");
    } finally {
      setAnkiLoading(false);
    }
  };

  const toggleCard = (noteId: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  // Other handlers
  const handleReindex = async () => {
```

### Step 5: Add the Anki tab button in the view toggle section (lines 520-535)

Find the closing `</div>` of the viewToggle div — it's right after the Editor button. Find:
```typescript
          <button
            className={`${styles.viewToggleBtn} ${viewMode === "editor" ? styles.viewToggleActive : ""}`}
            onClick={() => setViewMode("editor")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Editor
          </button>
        </div>
```
Replace with:
```typescript
          <button
            className={`${styles.viewToggleBtn} ${viewMode === "editor" ? styles.viewToggleActive : ""}`}
            onClick={() => setViewMode("editor")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Editor
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === "anki" ? styles.viewToggleActive : ""}`}
            onClick={() => setViewMode("anki")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            Anki
          </button>
        </div>
```

### Step 6: Add Anki sidebar content after the editor sidebar block

Find:
```typescript
        {/* Editor sidebar: note list */}
        {viewMode === "editor" && (
          <div className={styles.editorNoteList}>
```
... (that whole block ends with) ...
```typescript
        )}
      </div>

      {/* Center */}
```
After the closing `)}` of the editor sidebar block and before `</div>` of the sidebar (which is immediately followed by the `{/* Center */}` comment), insert:

Find:
```typescript
        {/* Editor sidebar: note list */}
        {viewMode === "editor" && (
          <div className={styles.editorNoteList}>
            <input
              type="text"
              placeholder="🔍 Search notes..."
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              className={styles.noteSearchInput}
            />
            <div className={styles.noteCount}>{filteredNotes.length} notes</div>
            <div className={styles.noteListScroll}>
              {filteredNotes.map((note, idx) => (
                <button
                  key={idx}
                  className={`${styles.noteListItem} ${selectedNote?.path === note.path ? styles.noteListItemActive : ""}`}
                  onClick={() => openNote(note)}
                >
                  <div className={styles.noteListTitle}>{note.title}</div>
                  <div className={styles.noteListPath}>{note.path}</div>
                </button>
              ))}
              {filteredNotes.length === 0 && (
                <div className={styles.noteListEmpty}>No notes found</div>
              )}
            </div>
          </div>
        )}
      </div>
```
Replace with:
```typescript
        {/* Editor sidebar: note list */}
        {viewMode === "editor" && (
          <div className={styles.editorNoteList}>
            <input
              type="text"
              placeholder="🔍 Search notes..."
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              className={styles.noteSearchInput}
            />
            <div className={styles.noteCount}>{filteredNotes.length} notes</div>
            <div className={styles.noteListScroll}>
              {filteredNotes.map((note, idx) => (
                <button
                  key={idx}
                  className={`${styles.noteListItem} ${selectedNote?.path === note.path ? styles.noteListItemActive : ""}`}
                  onClick={() => openNote(note)}
                >
                  <div className={styles.noteListTitle}>{note.title}</div>
                  <div className={styles.noteListPath}>{note.path}</div>
                </button>
              ))}
              {filteredNotes.length === 0 && (
                <div className={styles.noteListEmpty}>No notes found</div>
              )}
            </div>
          </div>
        )}

        {/* Anki sidebar: search form */}
        {viewMode === "anki" && (
          <div className={styles.editorNoteList}>
            <form onSubmit={handleAnkiSearch} className={styles.ankiSearchForm}>
              <input
                type="text"
                placeholder="Search cards..."
                value={ankiQuery}
                onChange={(e) => setAnkiQuery(e.target.value)}
                className={styles.noteSearchInput}
                disabled={ankiLoading}
              />
              <button
                type="submit"
                disabled={ankiLoading || !ankiQuery.trim()}
                className={styles.ankiSearchBtn}
              >
                {ankiLoading ? "..." : "Search"}
              </button>
            </form>
            <div className={styles.ankiSyntaxHints}>
              <div className={styles.ankiHint}>tag:neurology</div>
              <div className={styles.ankiHint}>deck:USMLE</div>
              <div className={styles.ankiHint}>front:diabetes</div>
            </div>
            {ankiCards.length > 0 && (
              <div className={styles.noteCount}>{ankiCards.length} cards found</div>
            )}
          </div>
        )}
      </div>
```

### Step 7: Add the Anki center panel

Find the start of the center conditional (line 634):
```typescript
      {/* Center */}
      {viewMode === "chat" ? (
```
...and find the end of the editor view (around line 836):
```typescript
        </div>
      )}

      {/* Right Sidebar */}
```

The current structure is:
```typescript
      {viewMode === "chat" ? (
        /* chat JSX */
      ) : (
        /* editor JSX */
      )}
```

Replace with:
```typescript
      {viewMode === "chat" ? (
        /* KEEP ALL EXISTING CHAT JSX EXACTLY AS IS */
      ) : viewMode === "editor" ? (
        /* KEEP ALL EXISTING EDITOR JSX EXACTLY AS IS */
      ) : (
        /* ── Anki View ──────────────────────────────────────────────── */
        <div className={styles.ankiContainer}>
          {ankiLoading && (
            <div className={styles.ankiCenterMsg}>
              <div className={styles.spinner} />
              <span>Searching Anki collection...</span>
            </div>
          )}
          {!ankiLoading && ankiError && (
            <div className={styles.ankiErrorBanner}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {ankiError}
            </div>
          )}
          {!ankiLoading && !ankiError && ankiCards.length === 0 && (
            <div className={styles.editorEmpty}>
              <h2>Anki Search</h2>
              <p>Type a query in the sidebar and press Search</p>
              <p className={styles.ankiExampleQueries}>
                Examples: <code>tag:neurology</code> · <code>deck:USMLE</code> · <code>diabetes</code>
              </p>
            </div>
          )}
          {!ankiLoading && ankiCards.length > 0 && (
            <div className={styles.ankiCardList}>
              {ankiCards.map((card) => {
                const isExpanded = expandedCards.has(card.note_id);
                return (
                  <div
                    key={card.note_id}
                    className={`${styles.ankiCard} ${isExpanded ? styles.ankiCardExpanded : ""}`}
                    onClick={() => toggleCard(card.note_id)}
                  >
                    <div className={styles.ankiCardHeader}>
                      <div
                        className={styles.ankiCardFront}
                        dangerouslySetInnerHTML={{ __html: card.front }}
                      />
                      <svg
                        className={`${styles.ankiChevron} ${isExpanded ? styles.ankiChevronOpen : ""}`}
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                    <div className={styles.ankiCardMeta}>
                      <span className={styles.ankiDeckBadge}>{card.deck}</span>
                      {card.tags.map((tag, i) => (
                        <span key={i} className={styles.resultTag}>{tag}</span>
                      ))}
                    </div>
                    {isExpanded && (
                      <div
                        className={styles.ankiCardBack}
                        dangerouslySetInnerHTML={{ __html: card.back }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
```

**Important implementation note:** When editing the ternary in page.tsx, you are changing the final `) : (` before the editor JSX into `) : viewMode === "editor" ? (` and adding a new `) : (` + Anki JSX before the closing `)}`. The existing chat and editor JSX must remain byte-for-byte identical.

### Step 8: Update the right sidebar heading to handle the anki mode

Find (line 840):
```typescript
        <h3>{isInWorkflow ? "Workflow" : viewMode === "editor" ? "Note Info" : "Notes"}</h3>
```
Replace with:
```typescript
        <h3>{isInWorkflow ? "Workflow" : viewMode === "editor" ? "Note Info" : viewMode === "anki" ? "Anki" : "Notes"}</h3>
```

### Step 9: Add a right panel info section for Anki mode (after the editor right panel block)

Find:
```typescript
        {viewMode === "editor" && selectedNote && noteContent && (
          <div>
            <div className={styles.sourcesHeading}>Tags:</div>
            <div className={styles.resultTagList}>
              {getNoteTags(noteContent).map((tag, i) => (
                <span key={i} className={styles.resultTag}>{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
```
Replace with:
```typescript
        {viewMode === "editor" && selectedNote && noteContent && (
          <div>
            <div className={styles.sourcesHeading}>Tags:</div>
            <div className={styles.resultTagList}>
              {getNoteTags(noteContent).map((tag, i) => (
                <span key={i} className={styles.resultTag}>{tag}</span>
              ))}
            </div>
          </div>
        )}

        {viewMode === "anki" && (
          <div>
            <div className={styles.sourcesHeading}>Query syntax:</div>
            <div className={styles.ankiSyntaxPanel}>
              <div className={styles.ankiSyntaxRow}><code>tag:name</code><span>by tag</span></div>
              <div className={styles.ankiSyntaxRow}><code>deck:name</code><span>by deck</span></div>
              <div className={styles.ankiSyntaxRow}><code>word</code><span>full-text</span></div>
              <div className={styles.ankiSyntaxRow}><code>is:due</code><span>due cards</span></div>
              <div className={styles.ankiSyntaxRow}><code>is:new</code><span>new cards</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
```

### Step 10: Verify TypeScript compiles (from obsidian-chat/)

```
cd obsidian-chat && npx tsc --noEmit
```
Expected: no errors. Fix any type errors before continuing.

### Step 11: Commit

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: add Anki tab with search and card display to frontend"
```

---

## Task 7: Add CSS classes to `page.module.css`

**Files:**
- Modify: `obsidian-chat/src/app/page.module.css`

### Step 1: Append new styles at the end of the file

```css

/* ── Anki Search ────────────────────────────────────────────────────────── */

.ankiContainer {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 20px;
  gap: 10px;
}

.ankiSearchForm {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
}

.ankiSearchBtn {
  padding: 8px 14px;
  border-radius: 6px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}

.ankiSearchBtn:hover:not(:disabled) {
  opacity: 0.85;
}

.ankiSearchBtn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ankiSyntaxHints {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 12px 8px;
}

.ankiHint {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-elevated);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono, monospace);
}

.ankiCenterMsg {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 14px;
  justify-content: center;
}

.ankiErrorBanner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(220, 60, 60, 0.12);
  border: 1px solid rgba(220, 60, 60, 0.3);
  border-radius: 8px;
  padding: 14px 16px;
  color: #ff7070;
  font-size: 13px;
  margin: 20px;
}

.ankiCardList {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
}

.ankiCard {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.ankiCard:hover {
  border-color: var(--accent);
}

.ankiCardExpanded {
  border-color: var(--accent);
  background: var(--bg-elevated);
}

.ankiCardHeader {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.ankiCardFront {
  font-size: 14px;
  line-height: 1.5;
  color: var(--text);
  flex: 1;
}

.ankiChevron {
  flex-shrink: 0;
  color: var(--text-muted);
  margin-top: 2px;
  transition: transform 0.2s;
}

.ankiChevronOpen {
  transform: rotate(180deg);
}

.ankiCardMeta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
  align-items: center;
}

.ankiDeckBadge {
  font-size: 11px;
  background: rgba(120, 100, 220, 0.18);
  color: #a89cdc;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.ankiCardBack {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
  font-size: 14px;
  line-height: 1.6;
  color: var(--text);
}

.ankiExampleQueries {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
}

.ankiExampleQueries code {
  background: var(--bg-elevated);
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
}

.ankiSyntaxPanel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.ankiSyntaxRow {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.ankiSyntaxRow code {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  background: var(--bg-elevated);
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--accent);
  min-width: 90px;
}

.ankiSyntaxRow span {
  color: var(--text-muted);
}
```

### Step 2: Verify Next.js compiles and runs

```
cd obsidian-chat && npm run dev
```
Expected: Dev server starts at http://localhost:3000 with no compile errors.
Open browser to http://localhost:3000 and confirm the "Anki" tab appears.

### Step 3: Commit

```bash
git add obsidian-chat/src/app/page.module.css
git commit -m "feat: add CSS styles for Anki search tab"
```

---

## End-to-End Test

1. Start the full app: `start_uworld.bat`
2. Open Anki with AnkiConnect plugin installed
3. Click the "Anki" tab in the UI
4. Type `deck:*` (matches all cards) in the search box
5. Click Search
6. Verify: cards appear with front text, deck badge, and tags
7. Click a card to expand it: back text should appear
8. Type a non-existent query (e.g. `zzzzzz`) — verify "0 cards found"
9. Close Anki and search again — verify the 503 error message appears cleanly

---

## Summary of all changes

| File | Change |
|---|---|
| `usmle_error_note/tools.py` | Add `_anki_request()`, `anki_search_notes`, `anki_get_decks` |
| `usmle_error_note/config/agents.yaml` | Add `anki_search_agent` |
| `usmle_error_note/config/tasks.yaml` | Add `search_anki_cards` |
| `usmle_error_note/models.py` | Add `AnkiCard`, `AnkiSearchRequest`, `AnkiSearchResponse` |
| `usmle_error_note/crew.py` | Import new tools + model, add `build_anki_crew()` |
| `usmle_error_note/server.py` | Import `HTTPException` + new models/crew, add `POST /anki/search` |
| `obsidian-chat/src/app/page.tsx` | Add `AnkiCard` type, Anki state, `handleAnkiSearch`, `toggleCard`, Anki tab button, sidebar, center panel, right panel |
| `obsidian-chat/src/app/page.module.css` | Add Anki CSS classes |
