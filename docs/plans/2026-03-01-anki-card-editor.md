# Anki Card Editor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add all-tags display, inline raw-text editing, and LLM-powered structural formatting to Anki cards in the obsidian-chat frontend.

**Architecture:** Three backend endpoints (update note, list card templates, format card via CrewAI) plus a new single-agent crew for card formatting. Frontend gains edit state, raw textarea editor, and a format-then-save flow.

**Tech Stack:** FastAPI (Python), AnkiConnect (HTTP on port 8765), CrewAI, Pydantic, Next.js/React/TypeScript

---

### Task 1: Extend models.py with new Pydantic models

**Files:**
- Modify: `usmle_error_note/models.py`

**Context:** The `AnkiCard` model currently has no `field_names` field. We need it to carry the actual Anki field names (e.g. `["Text", "Extra"]` for AnKing) so the update endpoint knows which fields to write to. We also need request/response models for the update and format-card endpoints.

**Step 1: Open the file and add models after the existing `AnkiSearchResponse` class**

In `usmle_error_note/models.py`, add `field_names` to `AnkiCard` and append five new model classes at the bottom:

```python
# Change AnkiCard to include field_names (add one field):
class AnkiCard(BaseModel):
    note_id: int
    front: str
    back: str
    deck: str
    tags: List[str]
    field_names: List[str] = []   # ← ADD THIS LINE
```

Then append after `AnkiSearchResponse`:

```python
# ── Anki card editor models ───────────────────────────────────────────────

class AnkiUpdateRequest(BaseModel):
    note_id: int
    front: str
    back: str
    field_names: List[str] = ["Text", "Extra"]

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
    front: str = Field(description="Formatted front field, cloze syntax preserved")
    back: str = Field(description="Formatted back field as HTML")
```

**Step 2: Verify the file loads without errors**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/usmle_error_note"
python -c "from models import AnkiCard, AnkiUpdateRequest, AnkiFormatCardResponse, AnkiCardFormatOutput; print('OK')"
```
Expected output: `OK`

---

### Task 2: Extend `anki_direct_search` to populate `field_names`

**Files:**
- Modify: `usmle_error_note/server.py` (the `anki_direct_search` function, around line 420-434)

**Context:** Currently `anki_direct_search` extracts field values positionally but discards the field names. We need to store the first two field names in `AnkiCard.field_names` so the update endpoint can write to the right fields for any deck template.

**Step 1: Find the card-building loop in `anki_direct_search` (lines ~421-435)**

Replace the card-building block:

```python
        # OLD — replace this entire block:
        cards = []
        for card in cards_info:
            field_values = list(card.get("fields", {}).values())
            front = field_values[0]["value"] if len(field_values) > 0 else ""
            back = field_values[1]["value"] if len(field_values) > 1 else ""
            cards.append(AnkiCard(
                note_id=card["note"],
                front=front,
                back=back,
                deck=card.get("deckName", ""),
                tags=tags_by_note.get(card["note"], []),
            ))
```

```python
        # NEW — also capture field names:
        cards = []
        for card in cards_info:
            fields_dict = card.get("fields", {})
            field_keys = list(fields_dict.keys())
            field_values = list(fields_dict.values())
            front = field_values[0]["value"] if len(field_values) > 0 else ""
            back = field_values[1]["value"] if len(field_values) > 1 else ""
            cards.append(AnkiCard(
                note_id=card["note"],
                front=front,
                back=back,
                deck=card.get("deckName", ""),
                tags=tags_by_note.get(card["note"], []),
                field_names=field_keys[:2],
            ))
```

**Step 2: Verify server still imports and parses correctly**

```bash
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/usmle_error_note"
python -c "import server; print('OK')"
```
Expected: `OK`

---

### Task 3: Add `POST /anki/update` endpoint to server.py

**Files:**
- Modify: `usmle_error_note/server.py`

**Context:** Sync endpoint (runs in FastAPI thread pool, not async) that calls AnkiConnect `updateNoteFields`. Uses the field names carried in the request to work with any deck template.

**Step 1: Add the new models to the import from models at the top of server.py**

Find the existing import:
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
    AnkiUpdateRequest,
    AnkiUpdateResponse,
    AnkiFormatCardRequest,
    AnkiFormatCardResponse,
    AnkiCardFormatOutput,
)
```

**Step 2: Add the endpoint after the `anki_direct_search` function (after line ~447)**

```python
# ── POST /anki/update — Update an Anki note's fields ──────────────────────

@app.post("/anki/update", response_model=AnkiUpdateResponse)
def anki_update(req: AnkiUpdateRequest):
    """Update the front/back fields of an Anki note via AnkiConnect."""
    try:
        field_name_front = req.field_names[0] if len(req.field_names) > 0 else "Text"
        field_name_back = req.field_names[1] if len(req.field_names) > 1 else "Extra"
        _direct_anki("updateNoteFields", note={
            "id": req.note_id,
            "fields": {
                field_name_front: req.front,
                field_name_back: req.back,
            },
        })
        return AnkiUpdateResponse(success=True)
    except OSError:
        raise HTTPException(
            status_code=503,
            detail="AnkiConnect not reachable. Open Anki with the AnkiConnect plugin installed.",
        )
    except ValueError as e:
        return AnkiUpdateResponse(success=False, error=str(e))
    except Exception as e:
        traceback.print_exc()
        return AnkiUpdateResponse(success=False, error=str(e))
```

**Step 3: Verify import**

```bash
python -c "import server; print('OK')"
```
Expected: `OK`

---

### Task 4: Create Anki templates folder and example template

**Files:**
- Create: `crewAI/templates/anki/cloze_basic.md`

**Context:** This template shows the LLM what a well-structured cloze card looks like. It is a FORMAT guide only — the LLM must never copy its content into real cards.

**Step 1: Create the directory and file**

Create `c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/templates/anki/cloze_basic.md` with this content:

```markdown
# Cloze Basic — Structural Template

## FRONT (question / fill-in-the-blank)

{{c1::Key term or answer}} is the [mechanism/cause/treatment] of [condition/symptom].

Rules for front:
- One focused question or fill-in-the-blank per card
- Cloze the single most important term
- Keep it ≤ 2 lines

## BACK (answer + context)

<b>Answer:</b> [Key term restated in context]<br><br>
<b>Why:</b> [1-2 sentence mechanism or rationale]<br><br>
<b>Key points:</b><br>
- [Distinguishing feature 1]<br>
- [Distinguishing feature 2]<br><br>
<b>Mnemonic (optional):</b> [Memory hook if useful]

Rules for back:
- Use <b>bold</b> for key terms
- Use <br> for line breaks (not markdown)
- Keep to ≤ 6 lines total
- No redundant restatement of the front
```

**Step 2: Verify the file exists**

```bash
ls "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/templates/anki/"
```
Expected: `cloze_basic.md`

---

### Task 5: Add `GET /anki/card-templates` endpoint to server.py

**Files:**
- Modify: `usmle_error_note/server.py`

**Context:** Lists `.md` files from `crewAI/templates/anki/`. The frontend calls this when the Anki tab is opened to populate the template dropdown in edit mode.

**Step 1: Add a constant for the Anki templates dir near the top of server.py (after the imports)**

Find this line in server.py:
```python
load_dotenv()
```

Add above it:
```python
_ANKI_TEMPLATES_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "templates", "anki")
)
```

**Step 2: Add the endpoint after `GET /templates`**

```python
# ── GET /anki/card-templates — List Anki card formatting templates ─────────

@app.get("/anki/card-templates")
async def get_anki_card_templates():
    """Return list of .md templates from the templates/anki/ folder."""
    try:
        import glob as _glob
        files = sorted(_glob.glob(os.path.join(_ANKI_TEMPLATES_DIR, "*.md")))
        templates = []
        for p in files:
            fname = os.path.basename(p)
            name = os.path.splitext(fname)[0].replace("_", " ").title()
            templates.append({"name": name, "filename": fname})
        return {"templates": templates}
    except Exception as e:
        return {"templates": [], "error": str(e)}
```

**Step 3: Verify**

```bash
python -c "import server; print('OK')"
```

---

### Task 6: Add YAML configs for the anki_card_formatter agent and task

**Files:**
- Modify: `usmle_error_note/config/agents.yaml`
- Modify: `usmle_error_note/config/tasks.yaml`

**Context:** Both YAML files use Windows CRLF line endings. The Edit tool's string matching fails on CRLF files. Use Python to append instead.

**Step 1: Append `anki_card_formatter` to agents.yaml**

```bash
python - <<'EOF'
with open(
    r"c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/usmle_error_note/config/agents.yaml",
    "a", encoding="utf-8"
) as f:
    f.write("""
anki_card_formatter:
  role: >
    Anki Card Structural Formatter
  goal: >
    Restructure the front and back fields of an Anki card to match the
    provided template format. NEVER add or remove facts. NEVER change
    cloze syntax. Only reorganize and clarify the presentation.
  backstory: >
    You are a medical education specialist who formats Anki cards for
    maximum clarity and retention. You preserve all cloze deletions
    ({{c1::text}}, {{c2::text::hint}}) exactly as-is. You use <b>bold</b>
    and <br> line breaks in the back field (not markdown). You never add
    information that was not in the original card — structure only.
""")
print("OK")
EOF
```

**Step 2: Verify agents.yaml is valid YAML**

```bash
python -c "
import yaml
with open(r'c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/usmle_error_note/config/agents.yaml', encoding='utf-8') as f:
    d = yaml.safe_load(f)
print(list(d.keys()))
"
```
Expected: list ending with `'anki_card_formatter'`

**Step 3: Append `format_anki_card` to tasks.yaml**

```bash
python - <<'EOF'
with open(
    r"c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/usmle_error_note/config/tasks.yaml",
    "a", encoding="utf-8"
) as f:
    f.write("""
format_anki_card:
  description: >
    You are reformatting an Anki card for medical study.
    Your job is STRUCTURAL improvement only — never change facts.

    FRONT (raw cloze text):
    {front}

    BACK (raw text or HTML):
    {back}

    STRUCTURAL TEMPLATE (use as FORMAT GUIDE ONLY — do NOT copy its content):
    {template_content}

    STRICT RULES:
    1. ONLY restructure and clarify — NEVER add or remove information.
    2. Preserve ALL cloze syntax EXACTLY: {{c1::text}}, {{c2::text::hint}}, etc.
    3. Front must be a clear, concise question or fill-in-the-blank (≤ 2 lines).
    4. Back must use <b>bold</b> for key terms and <br> for line breaks (not markdown).
    5. Keep the back to ≤ 6 lines total.
    6. Return a JSON object with exactly two keys: "front" and "back".
  expected_output: >
    A JSON object with keys "front" (formatted front field with cloze syntax preserved)
    and "back" (formatted back field as HTML using <b> and <br>).
  agent: anki_card_formatter
""")
print("OK")
EOF
```

**Step 4: Verify tasks.yaml is valid YAML**

```bash
python -c "
import yaml
with open(r'c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/usmle_error_note/config/tasks.yaml', encoding='utf-8') as f:
    d = yaml.safe_load(f)
print(list(d.keys()))
"
```
Expected: list ending with `'format_anki_card'`

---

### Task 7: Add `build_anki_format_crew()` to crew.py and `POST /anki/format-card` to server.py

**Files:**
- Modify: `usmle_error_note/crew.py`
- Modify: `usmle_error_note/server.py`

**Step 1: Add `AnkiCardFormatOutput` to the models import in crew.py**

Find:
```python
from models import QuestionsOutput, ErrorPatternOutput, NoteResult, AnkiSearchResponse
```

Replace with:
```python
from models import QuestionsOutput, ErrorPatternOutput, NoteResult, AnkiSearchResponse, AnkiCardFormatOutput
```

**Step 2: Add `build_anki_format_crew()` at the bottom of crew.py**

```python
# ── Anki Card Format Crew ──────────────────────────────────────────────────

def build_anki_format_crew(front: str, back: str, template_content: str) -> Crew:
    """Build a crew that reformats an Anki card's front/back using a template."""
    agents_cfg = _load_yaml("agents.yaml")
    tasks_cfg = _load_yaml("tasks.yaml")

    formatter = _make_agent("anki_card_formatter", agents_cfg)

    task_inputs = {
        "front": front,
        "back": back,
        "template_content": template_content,
    }
    t_cfg = tasks_cfg["format_anki_card"]
    description = t_cfg["description"].strip().format(**task_inputs)

    format_task = Task(
        description=description,
        expected_output=t_cfg["expected_output"].strip(),
        agent=formatter,
        output_pydantic=AnkiCardFormatOutput,
    )

    return Crew(
        agents=[formatter],
        tasks=[format_task],
        process=Process.sequential,
        verbose=True,
    )
```

**Step 3: Add `build_anki_format_crew` to the crew import in server.py**

Find:
```python
from crew import build_questions_crew, build_error_note_crew, build_format_crew, list_templates, build_anki_crew
```

Replace with:
```python
from crew import build_questions_crew, build_error_note_crew, build_format_crew, list_templates, build_anki_crew, build_anki_format_crew
```

**Step 4: Add `POST /anki/format-card` endpoint to server.py (after `GET /anki/card-templates`)**

```python
# ── POST /anki/format-card — LLM-format an Anki card using a template ─────

@app.post("/anki/format-card", response_model=AnkiFormatCardResponse)
async def anki_format_card(req: AnkiFormatCardRequest):
    """Run an Anki card's front/back through the LLM formatter using a template."""
    try:
        # Load the requested template (or the first one if none specified)
        import glob as _glob
        templates = sorted(_glob.glob(os.path.join(_ANKI_TEMPLATES_DIR, "*.md")))
        template_path = None
        if req.template_filename:
            for p in templates:
                if os.path.basename(p) == req.template_filename:
                    template_path = p
                    break
        if not template_path and templates:
            template_path = templates[0]
        if not template_path:
            return AnkiFormatCardResponse(
                front=req.front, back=req.back, success=False,
                error="No templates found in templates/anki/"
            )

        with open(template_path, "r", encoding="utf-8") as fh:
            template_content = fh.read()

        crew = build_anki_format_crew(req.front, req.back, template_content)
        result = crew.kickoff()

        if hasattr(result, "pydantic") and result.pydantic:
            return AnkiFormatCardResponse(
                front=result.pydantic.front,
                back=result.pydantic.back,
                success=True,
            )
        # Fallback: parse raw JSON
        import json as _json
        try:
            parsed = _json.loads(str(result).strip())
            return AnkiFormatCardResponse(
                front=parsed.get("front", req.front),
                back=parsed.get("back", req.back),
                success=True,
            )
        except Exception:
            return AnkiFormatCardResponse(
                front=req.front, back=req.back, success=False,
                error="Formatter returned unrecognized output."
            )

    except Exception as e:
        traceback.print_exc()
        return AnkiFormatCardResponse(front=req.front, back=req.back, success=False, error=str(e))
```

**Step 5: Verify everything imports**

```bash
python -c "import server; print('OK')"
python -c "import crew; print('OK')"
```
Both expected: `OK`

---

### Task 8: Frontend — show all tags + add edit state

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

**Step 1: Add `field_names` to the `AnkiCard` interface (around line 41)**

Find:
```typescript
interface AnkiCard {
  note_id: number;
  front: string;
  back: string;
  deck: string;
  tags: string[];
}
```

Replace with:
```typescript
interface AnkiCard {
  note_id: number;
  front: string;
  back: string;
  deck: string;
  tags: string[];
  field_names: string[];
}
```

**Step 2: Add edit state variables after the existing Anki state block (around line 112)**

Find:
```typescript
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
```

Add after it:
```typescript
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [ankiSaving, setAnkiSaving] = useState(false);
  const [ankiFormatting, setAnkiFormatting] = useState(false);
  const [ankiCardTemplates, setAnkiCardTemplates] = useState<{ name: string; filename: string }[]>([]);
  const [selectedCardTemplate, setSelectedCardTemplate] = useState("");
  const [ankiEditError, setAnkiEditError] = useState("");
```

**Step 3: Add `loadCardTemplates` call in `useEffect` when switching to anki view**

Find the existing `useEffect` that loads vault tags (around line 200, look for `setVaultTags`). Add a sibling `useEffect` after it:

```typescript
  useEffect(() => {
    if (viewMode !== "anki") return;
    fetch(`${CREWAI_URL}/anki/card-templates`)
      .then((r) => r.json())
      .then((d) => {
        setAnkiCardTemplates(d.templates || []);
        if (d.templates?.length > 0) setSelectedCardTemplate(d.templates[0].filename);
      })
      .catch(() => {});
  }, [viewMode]);
```

**Step 4: Remove tag filtering — show all tags**

Find this block inside the `ankiCards.map(...)` render (around line 963):
```typescript
                const matchingTags = card.tags.filter(t =>
                  ankiQuery && t.toLowerCase().includes(ankiQuery.toLowerCase())
                );
                const displayTags = matchingTags.length > 0
                  ? matchingTags
                  : card.tags.slice(0, 2);
```

Replace with:
```typescript
                const displayTags = card.tags;
```

Also update the tags render (around line 993) from `{displayTags.map(...)}` — it already uses `displayTags`, so no change needed there.

---

### Task 9: Frontend — edit handlers and edit UI

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

**Step 1: Add `handleSaveCard` and `handleFormatCard` handlers after `handleAnkiSearch`**

Find the end of `handleAnkiSearch` (around line 486):
```typescript
  };

  const toggleCard = (noteId: number) => {
```

Insert between them:
```typescript
  const handleSaveCard = async (card: AnkiCard) => {
    setAnkiSaving(true);
    setAnkiEditError("");
    try {
      const resp = await fetch(`${CREWAI_URL}/anki/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_id: card.note_id,
          front: editFront,
          back: editBack,
          field_names: card.field_names,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setAnkiCards((prev) =>
          prev.map((c) =>
            c.note_id === card.note_id ? { ...c, front: editFront, back: editBack } : c
          )
        );
        setEditingCard(null);
      } else {
        setAnkiEditError(data.error || "Save failed.");
      }
    } catch {
      setAnkiEditError("Failed to reach backend.");
    } finally {
      setAnkiSaving(false);
    }
  };

  const handleFormatCard = async () => {
    setAnkiFormatting(true);
    setAnkiEditError("");
    try {
      const resp = await fetch(`${CREWAI_URL}/anki/format-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: editFront,
          back: editBack,
          template_filename: selectedCardTemplate,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setEditFront(data.front);
        setEditBack(data.back);
      } else {
        setAnkiEditError(data.error || "Format failed.");
      }
    } catch {
      setAnkiEditError("Failed to reach backend.");
    } finally {
      setAnkiFormatting(false);
    }
  };

```

**Step 2: Replace the card render block with edit-mode support**

Find the card JSX block (around line 970):
```tsx
                return (
                  <div
                    key={card.note_id}
                    className={`${styles.ankiCard} ${isExpanded ? styles.ankiCardExpanded : ""}`}
                    onClick={() => toggleCard(card.note_id)}
                  >
                    <div className={styles.ankiCardHeader}>
                      <div className={styles.ankiCardFront}>
                        {frontText ? (
                          <span dangerouslySetInnerHTML={{ __html: card.front }} />
                        ) : (
                          <span className={styles.ankiCardFrontFallback}>{card.deck}</span>
                        )}
                      </div>
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
                      {displayTags.map((tag, i) => (
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
```

Replace with:
```tsx
                const isEditing = editingCard === card.note_id;
                return (
                  <div
                    key={card.note_id}
                    className={`${styles.ankiCard} ${isExpanded ? styles.ankiCardExpanded : ""} ${isEditing ? styles.ankiCardEditing : ""}`}
                    onClick={isEditing ? undefined : () => toggleCard(card.note_id)}
                  >
                    <div className={styles.ankiCardHeader}>
                      <div className={styles.ankiCardFront}>
                        {frontText ? (
                          <span dangerouslySetInnerHTML={{ __html: card.front }} />
                        ) : (
                          <span className={styles.ankiCardFrontFallback}>{card.deck}</span>
                        )}
                      </div>
                      <div className={styles.ankiCardHeaderActions} onClick={(e) => e.stopPropagation()}>
                        {isExpanded && !isEditing && (
                          <button
                            className={styles.ankiEditBtn}
                            onClick={() => {
                              setEditingCard(card.note_id);
                              setEditFront(card.front);
                              setEditBack(card.back);
                              setAnkiEditError("");
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {!isEditing && (
                          <svg
                            className={`${styles.ankiChevron} ${isExpanded ? styles.ankiChevronOpen : ""}`}
                            width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round"
                            aria-hidden="true"
                            onClick={() => toggleCard(card.note_id)}
                          >
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className={styles.ankiCardMeta}>
                      {displayTags.map((tag, i) => (
                        <span key={i} className={styles.resultTag}>{tag}</span>
                      ))}
                    </div>
                    {isExpanded && !isEditing && (
                      <div
                        className={styles.ankiCardBack}
                        dangerouslySetInnerHTML={{ __html: card.back }}
                      />
                    )}
                    {isEditing && (
                      <div className={styles.ankiEditPanel} onClick={(e) => e.stopPropagation()}>
                        <label className={styles.ankiEditLabel}>Front</label>
                        <textarea
                          className={styles.ankiEditTextarea}
                          value={editFront}
                          onChange={(e) => setEditFront(e.target.value)}
                          rows={4}
                          spellCheck={false}
                        />
                        <label className={styles.ankiEditLabel}>Back</label>
                        <textarea
                          className={styles.ankiEditTextarea}
                          value={editBack}
                          onChange={(e) => setEditBack(e.target.value)}
                          rows={6}
                          spellCheck={false}
                        />
                        {ankiEditError && (
                          <div className={styles.ankiEditError}>{ankiEditError}</div>
                        )}
                        <div className={styles.ankiEditButtons}>
                          {ankiCardTemplates.length > 0 && (
                            <select
                              className={styles.ankiTemplateSelect}
                              value={selectedCardTemplate}
                              onChange={(e) => setSelectedCardTemplate(e.target.value)}
                            >
                              {ankiCardTemplates.map((t) => (
                                <option key={t.filename} value={t.filename}>{t.name}</option>
                              ))}
                            </select>
                          )}
                          <button
                            className={styles.ankiFormatBtn}
                            onClick={handleFormatCard}
                            disabled={ankiFormatting || ankiSaving}
                          >
                            {ankiFormatting ? "Formatting…" : "Format"}
                          </button>
                          <button
                            className={styles.ankiSaveBtn}
                            onClick={() => handleSaveCard(card)}
                            disabled={ankiSaving || ankiFormatting}
                          >
                            {ankiSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            className={styles.ankiCancelBtn}
                            onClick={() => { setEditingCard(null); setAnkiEditError(""); }}
                            disabled={ankiSaving || ankiFormatting}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
```

---

### Task 10: CSS for edit mode

**Files:**
- Modify: `obsidian-chat/src/app/page.module.css`

**Step 1: Append the new CSS classes at the end of the file**

```css
/* ── Anki card edit mode ─────────────────────────────────────────────── */

.ankiCardEditing {
  border-color: var(--accent, #7c3aed) !important;
  cursor: default;
}

.ankiCardHeaderActions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.ankiEditBtn {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
  cursor: pointer;
  transition: background 0.15s;
}
.ankiEditBtn:hover {
  background: rgba(255,255,255,0.12);
  color: #fff;
}

.ankiEditPanel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
}

.ankiEditLabel {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255,255,255,0.4);
}

.ankiEditTextarea {
  width: 100%;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px;
  color: rgba(255,255,255,0.85);
  font-size: 12px;
  font-family: "JetBrains Mono", "Fira Code", monospace;
  padding: 8px 10px;
  resize: vertical;
  outline: none;
  line-height: 1.5;
}
.ankiEditTextarea:focus {
  border-color: rgba(124,58,237,0.5);
}

.ankiEditError {
  font-size: 12px;
  color: #f87171;
  padding: 4px 0;
}

.ankiEditButtons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.ankiTemplateSelect {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(0,0,0,0.3);
  color: rgba(255,255,255,0.75);
  cursor: pointer;
}

.ankiFormatBtn {
  font-size: 11px;
  padding: 4px 12px;
  border-radius: 4px;
  border: 1px solid rgba(124,58,237,0.4);
  background: rgba(124,58,237,0.15);
  color: rgba(124,58,237,0.9);
  cursor: pointer;
  transition: background 0.15s;
}
.ankiFormatBtn:hover:not(:disabled) {
  background: rgba(124,58,237,0.3);
}
.ankiFormatBtn:disabled { opacity: 0.4; cursor: not-allowed; }

.ankiSaveBtn {
  font-size: 11px;
  padding: 4px 14px;
  border-radius: 4px;
  border: none;
  background: rgba(34,197,94,0.2);
  color: #4ade80;
  cursor: pointer;
  transition: background 0.15s;
}
.ankiSaveBtn:hover:not(:disabled) { background: rgba(34,197,94,0.35); }
.ankiSaveBtn:disabled { opacity: 0.4; cursor: not-allowed; }

.ankiCancelBtn {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.1);
  background: transparent;
  color: rgba(255,255,255,0.45);
  cursor: pointer;
  transition: color 0.15s;
}
.ankiCancelBtn:hover:not(:disabled) { color: rgba(255,255,255,0.75); }
.ankiCancelBtn:disabled { opacity: 0.4; cursor: not-allowed; }
```

**Step 2: Restart the servers and verify manually**

```bash
# Restart FastAPI server (stop current, then):
cd "c:/Users/vanio/OneDrive/Área de Trabalho/python/crewAI/usmle_error_note"
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Manual checks:
1. Search `1997` in the Anki tab → cards appear with ALL tags shown
2. Click a card to expand → "Edit" button appears
3. Click Edit → two textareas appear with raw cloze/HTML text, plus Format/Save/Cancel buttons
4. Edit front text → click Save → card updates in-place, edit mode closes
5. Click Edit again → click Format → textareas update with LLM-restructured content → click Save to commit
6. Click Cancel → edit mode closes without changes
