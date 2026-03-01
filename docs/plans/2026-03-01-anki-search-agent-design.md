# Anki Search Agent — Design Document

**Date:** 2026-03-01
**Status:** Approved

---

## Overview

Add an Anki card search section to the UWorld Error-Note application. A new `anki_search_agent` is defined in YAML and backed by AnkiConnect (port 8765). Users search from a dedicated "Anki" tab in the `obsidian-chat` Next.js frontend.

---

## Architecture

```
User types query
  → POST /anki/search { query }
    → build_anki_crew(query)       crew.py
      → anki_search_agent          agents.yaml
        → search_anki_cards task   tasks.yaml
          → anki_search_notes tool tools.py
            → AnkiConnect API      localhost:8765
      → List[AnkiCard]
  → JSON response
→ "Anki" tab in obsidian-chat renders results
```

**Constraint:** Anki must be open with AnkiConnect plugin installed.

---

## Changes

### 1. `usmle_error_note/tools.py`

Two new `@tool` functions:

- `anki_search_notes(query: str) -> list[dict]`
  Calls `findNotes` then `notesInfo` on AnkiConnect. Returns list of dicts with `note_id`, `front`, `back`, `deck`, `tags`. Limit 20 results.

- `anki_get_decks() -> list[str]`
  Calls `deckNames` on AnkiConnect. Returns list of deck name strings.

AnkiConnect base URL: `http://localhost:8765`

---

### 2. `usmle_error_note/config/agents.yaml`

```yaml
anki_search_agent:
  role: Anki Card Search Specialist
  goal: >
    Search the user's Anki collection using AnkiConnect and return
    relevant cards with their front, back, tags, and deck name.
  backstory: >
    You are a study assistant that queries the user's local Anki
    collection. Given a search query, you use available tools to
    find matching cards and return them in a structured format.
  tools:
    - anki_search_notes
    - anki_get_decks
```

---

### 3. `usmle_error_note/config/tasks.yaml`

```yaml
search_anki_cards:
  agent: anki_search_agent
  description: >
    Search the Anki collection for cards matching the query: {query}.
    Use anki_search_notes with the query string (supports Anki search syntax).
    Return up to 20 results with front, back, deck, and tags for each card.
  expected_output: >
    JSON object with key "cards" containing a list of objects, each with:
    note_id, front, back, deck, tags.
```

---

### 4. `usmle_error_note/crew.py`

New function:

```python
def build_anki_crew(query: str) -> Crew:
    """Single-task crew for Anki card search."""
```

Loads `anki_search_agent` and `search_anki_cards` from YAML, injects the query as input, returns `Crew(agents=[agent], tasks=[task], process=Process.sequential)`.

---

### 5. `usmle_error_note/models.py`

```python
class AnkiCard(BaseModel):
    note_id: int
    front: str
    back: str
    deck: str
    tags: list[str]

class AnkiSearchRequest(BaseModel):
    query: str

class AnkiSearchResponse(BaseModel):
    cards: list[AnkiCard]
    total: int
```

---

### 6. `usmle_error_note/server.py`

New endpoint:

```python
@app.post("/anki/search", response_model=AnkiSearchResponse)
async def anki_search(request: AnkiSearchRequest):
    crew = build_anki_crew(request.query)
    result = crew.kickoff(inputs={"query": request.query})
    # parse result.raw as JSON
    return AnkiSearchResponse(cards=..., total=...)
```

Error handling: return 503 with clear message if AnkiConnect is unreachable.

---

### 7. `obsidian-chat/` frontend

New **"Anki"** tab in the existing tab bar:

- Search input: free-text, supports Anki query syntax (`tag:neurology`, `deck:USMLE`)
- Search button triggers `POST /anki/search`
- Results: expandable card list showing front text → click to reveal back + tags + deck name
- Loading spinner during search
- Error banner if AnkiConnect is offline

---

## Success Criteria

1. User types a query in the Anki tab → cards matching the query are displayed
2. Each result shows front, back (on expand), deck name, and tags
3. System returns a clear error if Anki is not running
4. Agent and task are defined entirely in YAML, consistent with existing agents
