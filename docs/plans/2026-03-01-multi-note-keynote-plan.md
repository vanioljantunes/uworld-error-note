# Multi-Note Generation + Key Note Synthesis Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace single-note-per-session with 1-3 focused micro-notes per question, add side-by-side markdown editing in the editor, and a Key Note button that synthesizes all vault notes referencing the current note.

**Architecture:** Extend the existing 2-task sequential crew (infer → compose, removing format task). The analyst returns a list of 1-3 gaps; the composer writes one micro-note per gap using template_a.md directly. A new `/keynote` endpoint scans the vault for referencing notes and synthesizes them via a dedicated crew. The frontend editor splits into a raw textarea + live preview pane.

**Tech Stack:** Python FastAPI + CrewAI (backend), Next.js 15 + TypeScript (frontend), Pydantic v2 models, Obsidian markdown vault.

---

## Task 1: Update models.py — Add GapItem, MultiNoteResult, update GenerateResponse, add KeyNote models

**Files:**
- Modify: `usmle_error_note/models.py`

**Step 1: Read the current models.py** to understand what's there (already read — see context above).

**Step 2: Replace `ErrorPatternOutput` and `GenerateResponse`, add new models**

Open `usmle_error_note/models.py` and make these changes:

Replace `ErrorPatternOutput` (lines 33-39):
```python
class GapItem(BaseModel):
    slug: str = Field(description="Kebab-case ASCII error pattern slug")
    action: str = Field(description="'create' or 'update'")
    existing_file: Optional[str] = Field(default=None, description="Relative path if updating")
    system_tag: str = Field(description="One system tag")
    topic_tag: str = Field(description="Short kebab-case topic tag")
    concept_tags: List[str] = Field(description="2-6 kebab-case concept tags")

class ErrorPatternOutput(BaseModel):
    gaps: List[GapItem] = Field(description="1-3 distinct knowledge gaps identified", min_length=1, max_length=3)
```

Add `MultiNoteResult` after `NoteResult` (after line 49):
```python
class MultiNoteResult(BaseModel):
    notes: List[NoteResult] = Field(description="List of micro-notes created or updated")
```

Replace `GenerateResponse` (lines 66-72):
```python
class GenerateResponse(BaseModel):
    notes: List[NoteResult]
    questions_recap: List[dict]
```

Add at end of file:
```python
# ── Key Note models ──────────────────────────────────────────────────────

class KeyNoteRequest(BaseModel):
    vault_path: str
    note_path: str

class KeyNoteResponse(BaseModel):
    suggested_filename: str
    content: str
    source_notes: List[str]
    success: bool
    error: str = ""
```

**Step 3: Verify the file is syntactically valid**

Run: `cd usmle_error_note && python -c "from models import GapItem, ErrorPatternOutput, MultiNoteResult, GenerateResponse, KeyNoteRequest, KeyNoteResponse; print('OK')"`

Expected: `OK`

**Step 4: Commit**
```bash
git add usmle_error_note/models.py
git commit -m "feat: add GapItem, MultiNoteResult, KeyNote models; update GenerateResponse to multi-note"
```

---

## Task 2: Update tasks.yaml — infer_error_pattern returns gap list, compose_note writes multiple notes, add synthesize_keynote

**Files:**
- Modify: `usmle_error_note/config/tasks.yaml`

**Step 1: Replace `infer_error_pattern`**

Replace the entire `infer_error_pattern` entry with:
```yaml
infer_error_pattern:
  description: >
    Using the original extraction and the user's answers to diagnostic questions,
    identify 1-3 DISTINCT knowledge gaps and prepare metadata for each.

    Original extraction:
    - question_id: {question_id}
    - choosed_alternative: {choosed_alternative}
    - wrong_alternative: {wrong_alternative}
    - educational_objective: {educational_objective}

    Diagnostic questions asked: {questions_json}
    User's answers: {answers_json}

    Your tasks:
    1. Use the vault_search_tags tool to get all existing tags in the vault.
    2. Use the vault_list_files tool to see all existing notes.
    3. Identify 1-3 DISTINCT knowledge gaps. Create multiple gaps only if they
       are genuinely different concepts. When in doubt, prefer fewer (1 is fine).
    4. For EACH gap:
       a. Infer a stable error pattern slug (lowercase, kebab-case, ASCII).
          Examples: snare-vesicle-exocytosis, presynaptic-vs-postsynaptic-confusion
       b. Check if a note with this slug already exists (by filename or tag).
       c. Determine action: "create" or "update".
       d. If "update", set existing_file to the relative path.
       e. Determine ONE system tag from: renal, cardio, pulm, neuro, endo, heme-onc,
          repro, gi, msk, derm, psych, biostats, ethics, micro, pharm, immuno, genetics.
       f. Determine one short topic tag (kebab-case).
       g. Determine 2-6 concept tags (kebab-case). REUSE existing vault tags when possible.

    Return: a JSON object with key "gaps" containing a list of 1-3 gap objects.
  expected_output: >
    A JSON object with key "gaps" containing a list of 1-3 objects,
    each with: slug, action, existing_file, system_tag, topic_tag, concept_tags.
  agent: error_pattern_analyst
```

**Step 2: Replace `compose_note`**

Replace the entire `compose_note` entry with:
```yaml
compose_note:
  description: >
    Compose multiple micro-notes — one per knowledge gap — based on the gap list
    from the previous task.

    Original extraction:
    - question_id: {question_id}
    - choosed_alternative: {choosed_alternative}
    - wrong_alternative: {wrong_alternative}
    - educational_objective: {educational_objective}
    - full_explanation (summary): {explanation_summary}

    User's cognitive gap (from diagnostic Q&A):
    Questions: {questions_json}
    Answers: {answers_json}

    Gap list: provided in context from the previous task.

    TEMPLATE TO USE — follow this structure exactly for EVERY note:
    {template_a}

    FOR EACH GAP in the gap list:
    1. Use vault_search_tags to get existing vault tags.
    2. Use vault_list_files to see all existing notes.
    3. If action is "update", use vault_read_note to read the existing note first.
    4. Write one micro-note following the TEMPLATE structure above.
    5. Embed [[wikilinks]] inside prose sentences for:
       - Other notes being created in this session (use their title or slug)
       - Relevant existing vault notes discovered via vault_list_files
    6. Save the note using vault_write_note to: <slug>.md (vault root)

    HARD RULES:
    - question_id tag MUST be numeric only (e.g. "1017", NOT "uworld_1017")
    - YAML frontmatter keys: type (micro_mechanism), created (today YYYY-MM-DD), tags only
    - Tags list: [<question_id>, <system_tag>, <topic_tag>, <slug>, <concept_tags...>]
    - Wikilinks INSIDE prose sentences only, never as a separate links section
    - Each note focuses on ONE gap only — do not merge gaps
    - If updating: append one "New example:" line and add any missing tags
    - Do NOT paste the full question text or full explanation

    Return all notes as: {"notes": [{"action", "file_path", "error_pattern", "tags", "note_content"}, ...]}
  expected_output: >
    A JSON object with key "notes" containing a list of note objects,
    each with: action, file_path, error_pattern, tags, note_content.
  agent: note_composer
```

**Step 3: Add `synthesize_keynote` at the end of the file**
```yaml
synthesize_keynote:
  description: >
    Synthesize a Key Note that integrates multiple micro-notes about the same topic.

    CURRENT NOTE (the note being synthesized into a Key Note):
    {current_note}

    REFERENCING NOTES (notes in the vault that wikilink to the current note):
    {referencing_notes}

    TEMPLATE (follow this prose structure):
    {template_a}

    Your task:
    Create a single integrated Key Note that synthesizes ALL the content above
    into one coherent explanation. This is NOT a summary — it is a unified note
    that makes the full picture clear.

    RULES:
    1. Use template_a.md prose structure (paragraphs, not bullet points).
    2. YAML frontmatter: type: key_note, created: <today YYYY-MM-DD>,
       tags: [merged unique tags from all source notes]
    3. Title: # <Integrated Mechanism/Concept Title>
    4. Three prose paragraphs:
       - What the concept is and how it works (with [[wikilinks]])
       - Clinical context, disease connections (with [[wikilinks]])
       - "In questions, [pattern] should make me think of [concept]"
    5. Replace "Why I missed this before:" with:
       **Why this is a Key Note:**
       1-2 lines on what makes this a recurring high-yield concept.
    6. Suggest a filename: key-<most-common-slug>.md
    7. Do NOT copy entire paragraphs from source notes — synthesize and integrate.

    Return: {"suggested_filename": "key-<slug>.md", "content": "<full markdown>"}
  expected_output: >
    A JSON object with "suggested_filename" (string) and "content" (full markdown string
    including YAML frontmatter).
  agent: keynote_synthesizer
```

**Step 4: Verify YAML is valid**

Run: `cd usmle_error_note && python -c "import yaml; yaml.safe_load(open('config/tasks.yaml').read()); print('OK')"`

Expected: `OK`

**Step 5: Commit**
```bash
git add usmle_error_note/config/tasks.yaml
git commit -m "feat: update tasks for multi-gap inference, multi-note composition, add synthesize_keynote"
```

---

## Task 3: Update agents.yaml — Add keynote_synthesizer agent

**Files:**
- Modify: `usmle_error_note/config/agents.yaml`

**Step 1: Add `keynote_synthesizer` at the end of the file**
```yaml
keynote_synthesizer:
  role: >
    Medical Knowledge Synthesis Expert
  goal: >
    Synthesize multiple related micro-notes into one integrated Key Note that
    captures the complete picture of a recurring high-yield medical concept.
  backstory: >
    You are a master medical educator who identifies when multiple study notes
    converge on the same core concept. You synthesize scattered insights into
    one coherent, authoritative Key Note that a student can study as the
    definitive reference for that topic. You write in clear prose, use
    [[wikilinks]] naturally inside sentences, and produce notes that are
    integrative rather than additive. You never copy entire paragraphs — you
    synthesize and clarify.
```

**Step 2: Verify YAML**

Run: `cd usmle_error_note && python -c "import yaml; yaml.safe_load(open('config/agents.yaml').read()); print('OK')"`

Expected: `OK`

**Step 3: Commit**
```bash
git add usmle_error_note/config/agents.yaml
git commit -m "feat: add keynote_synthesizer agent"
```

---

## Task 4: Update crew.py — Update build_error_note_crew, add build_keynote_crew

**Files:**
- Modify: `usmle_error_note/crew.py`

**Step 1: Update imports in crew.py**

Add `MultiNoteResult` to the models import line (currently line 21):
```python
from models import QuestionsOutput, ErrorPatternOutput, NoteResult, MultiNoteResult, AnkiSearchResponse, AnkiCardFormatOutput
```

**Step 2: Replace `build_error_note_crew`**

Replace the entire function (lines 127-183) with:
```python
def build_error_note_crew(inputs: dict, templates_dir: str | None = None) -> Crew:
    """Build a crew that infers gaps and composes multiple micro-notes using template_a."""
    agents_cfg = _load_yaml("agents.yaml")
    tasks_cfg = _load_yaml("tasks.yaml")

    # Load template_a.md to pass to compose task
    tdir = templates_dir or _DEFAULT_TEMPLATES_DIR
    template_a_path = os.path.join(tdir, "template_a.md")
    template_a = _load_template(template_a_path) if os.path.exists(template_a_path) else ""
    inputs = {**inputs, "template_a": template_a}

    # Agents
    analyst = _make_agent(
        "error_pattern_analyst",
        agents_cfg,
        tools=[vault_list_files, vault_read_note, vault_search_tags],
    )
    composer = _make_agent(
        "note_composer",
        agents_cfg,
        tools=[vault_read_note, vault_search_tags, vault_write_note, vault_list_files],
    )

    # Task 1: infer gap list
    t1_cfg = tasks_cfg["infer_error_pattern"]
    infer_task = Task(
        description=t1_cfg["description"].strip().format(**inputs),
        expected_output=t1_cfg["expected_output"].strip(),
        agent=analyst,
        output_pydantic=ErrorPatternOutput,
    )

    # Task 2: compose one note per gap
    t2_cfg = tasks_cfg["compose_note"]
    compose_task = Task(
        description=t2_cfg["description"].strip().format(**inputs),
        expected_output=t2_cfg["expected_output"].strip(),
        agent=composer,
        context=[infer_task],
        output_pydantic=MultiNoteResult,
    )

    return Crew(
        agents=[analyst, composer],
        tasks=[infer_task, compose_task],
        process=Process.sequential,
        verbose=True,
    )
```

**Step 3: Add `build_keynote_crew` after `build_format_crew`**

Add this function before the `# ── Anki Search Crew` comment:
```python
# ── Key Note Synthesis Crew ───────────────────────────────────────────────

def build_keynote_crew(
    current_note: str,
    referencing_notes: list[str],
    templates_dir: str | None = None,
) -> Crew:
    """Build a crew that synthesizes a Key Note from the current note and all notes referencing it."""
    agents_cfg = _load_yaml("agents.yaml")
    tasks_cfg = _load_yaml("tasks.yaml")

    tdir = templates_dir or _DEFAULT_TEMPLATES_DIR
    template_a_path = os.path.join(tdir, "template_a.md")
    template_a = _load_template(template_a_path) if os.path.exists(template_a_path) else ""

    synthesizer = _make_agent("keynote_synthesizer", agents_cfg)

    referencing_text = (
        "\n\n---\n\n".join(referencing_notes)
        if referencing_notes
        else "(No other notes reference this note yet.)"
    )

    task_inputs = {
        "current_note": current_note,
        "referencing_notes": referencing_text,
        "template_a": template_a,
    }

    t_cfg = tasks_cfg["synthesize_keynote"]
    synth_task = Task(
        description=t_cfg["description"].strip().format(**task_inputs),
        expected_output=t_cfg["expected_output"].strip(),
        agent=synthesizer,
    )

    return Crew(
        agents=[synthesizer],
        tasks=[synth_task],
        process=Process.sequential,
        verbose=True,
    )
```

**Step 4: Verify imports**

Run: `cd usmle_error_note && python -c "from crew import build_error_note_crew, build_keynote_crew; print('OK')"`

Expected: `OK`

**Step 5: Commit**
```bash
git add usmle_error_note/crew.py
git commit -m "feat: update build_error_note_crew for multi-note, add build_keynote_crew"
```

---

## Task 5: Update server.py — Update /generate response handling, add /keynote endpoint

**Files:**
- Modify: `usmle_error_note/server.py`

**Step 1: Update imports at top of server.py**

Add `build_keynote_crew` to the crew import line (currently line 39):
```python
from crew import build_questions_crew, build_error_note_crew, build_format_crew, list_templates, build_anki_crew, build_anki_format_crew, build_keynote_crew
```

Add new models to models import (currently line 26-38):
```python
from models import (
    QuestionsRequest,
    QuestionsResponse,
    GenerateRequest,
    GenerateResponse,
    NoteResult,
    AnkiSearchRequest,
    AnkiSearchResponse,
    AnkiCard,
    AnkiUpdateRequest,
    AnkiUpdateResponse,
    AnkiFormatCardRequest,
    AnkiFormatCardResponse,
    AnkiCardFormatOutput,
    KeyNoteRequest,
    KeyNoteResponse,
)
```

**Step 2: Replace the `/generate` endpoint body**

Replace the section from `action = "created"` through the `return GenerateResponse(...)` call inside the `try` block (lines 220-269) with:

```python
        notes: list[NoteResult] = []

        # Get structured output from compose task (task index 1)
        if hasattr(result, "tasks_output") and len(result.tasks_output) >= 2:
            compose_output = result.tasks_output[1]
            if hasattr(compose_output, "pydantic") and compose_output.pydantic:
                notes = compose_output.pydantic.notes

        # Fallback: parse raw JSON
        if not notes:
            try:
                parsed = json.loads(str(result).strip())
                notes = [NoteResult(**n) for n in parsed.get("notes", [])]
            except (json.JSONDecodeError, ValueError, TypeError):
                pass

        # Guaranteed file write for each note
        for note in notes:
            if note.note_content and note.file_path and note.file_path != "unknown":
                _ensure_note_written(req.vault_path, note.file_path, note.note_content)

        # Build Q&A recap
        questions_recap = [
            {"question": q, "answer": req.answers[i] if i < len(req.answers) else "No answer"}
            for i, q in enumerate(req.questions)
        ]

        return GenerateResponse(notes=notes, questions_recap=questions_recap)
```

Also update the except block (currently returns single note fields) to:
```python
    except Exception as e:
        traceback.print_exc()
        return GenerateResponse(
            notes=[],
            questions_recap=[
                {"question": q, "answer": req.answers[i] if i < len(req.answers) else ""}
                for i, q in enumerate(req.questions)
            ],
        )
```

**Step 3: Add `/keynote` endpoint after the `/format` endpoint**

Add this after the `/format` endpoint (after line 419):
```python
# ── POST /keynote — Synthesize a Key Note from referencing vault notes ────

@app.post("/keynote", response_model=KeyNoteResponse)
async def generate_keynote(req: KeyNoteRequest):
    """Scan vault for notes referencing the given note and synthesize a Key Note."""
    try:
        full = os.path.join(req.vault_path, req.note_path.replace("/", os.sep))
        if not os.path.isfile(full):
            return KeyNoteResponse(
                suggested_filename="", content="", source_notes=[], success=False,
                error="File not found."
            )

        with open(full, "r", encoding="utf-8") as fh:
            current_note = fh.read()

        # Derive title (first # heading) and slug (filename without .md)
        title_match = re.search(r"^# (.+)$", current_note, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else ""
        slug = os.path.splitext(os.path.basename(full))[0]

        # Scan vault for notes that wikilink to this note
        referencing_notes: list[str] = []
        source_paths: list[str] = []
        for root, dirs, files in os.walk(req.vault_path):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for f in files:
                if not f.endswith(".md"):
                    continue
                note_full = os.path.join(root, f)
                if note_full == full:
                    continue
                try:
                    with open(note_full, "r", encoding="utf-8") as fh:
                        content = fh.read()
                    if f"[[{title}]]" in content or f"[[{slug}]]" in content:
                        referencing_notes.append(content)
                        source_paths.append(os.path.relpath(note_full, req.vault_path))
                except Exception:
                    continue

        crew = build_keynote_crew(current_note, referencing_notes)
        result = crew.kickoff()

        raw = str(result).strip()
        try:
            parsed = json.loads(raw)
            return KeyNoteResponse(
                suggested_filename=parsed.get("suggested_filename", f"key-{slug}.md"),
                content=parsed.get("content", raw),
                source_notes=source_paths,
                success=True,
            )
        except json.JSONDecodeError:
            return KeyNoteResponse(
                suggested_filename=f"key-{slug}.md",
                content=raw,
                source_notes=source_paths,
                success=True,
            )

    except Exception as e:
        traceback.print_exc()
        return KeyNoteResponse(
            suggested_filename="", content="", source_notes=[], success=False,
            error=str(e)
        )
```

**Step 4: Verify the server imports cleanly**

Run: `cd usmle_error_note && python -c "import server; print('OK')"`

Expected: `OK`

**Step 5: Commit**
```bash
git add usmle_error_note/server.py
git commit -m "feat: update /generate for multi-note response, add /keynote endpoint"
```

---

## Task 6: Create /api/save-note Next.js API route

**Files:**
- Create: `obsidian-chat/src/app/api/save-note/route.ts`

**Step 1: Check that the read-note route exists as a reference**

Read `obsidian-chat/src/app/api/read-note/route.ts` to understand the pattern.

**Step 2: Create the route file**

Create `obsidian-chat/src/app/api/save-note/route.ts`:
```typescript
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const { vaultPath, notePath, content } = await request.json();
    if (!vaultPath || !notePath || content === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required parameters: vaultPath, notePath, content" },
        { status: 400 }
      );
    }
    const sep = process.platform === "win32" ? "\\" : "/";
    const fullPath = path.join(vaultPath, notePath.replace(/\//g, sep));
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify Next.js builds without errors**

Run: `cd obsidian-chat && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors (or only pre-existing errors unrelated to this file).

**Step 4: Commit**
```bash
git add obsidian-chat/src/app/api/save-note/route.ts
git commit -m "feat: add /api/save-note Next.js route for writing note content to disk"
```

---

## Task 7: Frontend — Update types and multi-note chat display in page.tsx

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

**Step 1: Update `ErrorNoteResult` interface and add `NoteResult`**

In `page.tsx`, replace the `ErrorNoteResult` interface (lines 32-39) with:
```typescript
interface NoteResult {
  action: string;
  file_path: string;
  error_pattern: string;
  tags: string[];
  note_content: string;
}

interface GenerateResponse {
  notes: NoteResult[];
  questions_recap: { question: string; answer: string }[];
}
```

**Step 2: Update the state variable**

Find (line 100):
```typescript
const [errorNoteResult, setErrorNoteResult] = useState<ErrorNoteResult | null>(null);
```
Replace with:
```typescript
const [errorNoteResults, setErrorNoteResults] = useState<NoteResult[]>([]);
```

**Step 3: Update `handleSubmitAnswers` — the generate response handler**

In `handleSubmitAnswers`, find the block starting with:
```typescript
const result: ErrorNoteResult = await generateResp.json();
setErrorNoteResult(result);
setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: `✅ **Note ${result.action}!**\n\n📂 **Path:** ${result.file_path}\n🧩 **Pattern:** ${result.error_pattern}\n🏷️ **Tags:** ${result.tags.join(", ")}\n\n---\n\n${result.note_content}` }]);
```
Replace with:
```typescript
const result: GenerateResponse = await generateResp.json();
const notes = result.notes || [];
setErrorNoteResults(notes);
const notesSummary = notes
  .map((n) => `✅ **${n.action === "created" ? "Created" : "Updated"}:** \`${n.file_path}\`\n🏷️ ${n.tags.join(", ")}`)
  .join("\n\n");
setMessages((prev) => [...prev, {
  id: (Date.now() + 1).toString(),
  role: "assistant",
  content: notes.length === 0
    ? "⚠️ No notes were generated."
    : `📚 **${notes.length} micro-note${notes.length > 1 ? "s" : ""} saved:**\n\n${notesSummary}`,
}]);
```

**Step 4: Update `resetWorkflow`**

Find:
```typescript
setErrorNoteResult(null);
```
Replace with:
```typescript
setErrorNoteResults([]);
```

**Step 5: Update the right sidebar result display**

Find the `{errorNoteResult && (` block in the right sidebar (around line 1222) and replace:
```tsx
{errorNoteResult && (
  <div className={styles.resultCard}>
    <div className={styles.resultHeader}>Note {errorNoteResult.action === "created" ? "Created" : "Updated"}</div>
    <div className={styles.resultItem}><strong>Path:</strong> {errorNoteResult.file_path}</div>
    <div className={styles.resultItem}><strong>Pattern:</strong> {errorNoteResult.error_pattern}</div>
    <div className={styles.resultTagList}>{errorNoteResult.tags.map((tag, i) => (<span key={i} className={styles.resultTag}>{tag}</span>))}</div>
  </div>
)}
```
With:
```tsx
{errorNoteResults.length > 0 && errorNoteResults.map((note, idx) => (
  <div key={idx} className={styles.resultCard}>
    <div className={styles.resultHeader}>Note {note.action === "created" ? "Created" : "Updated"}</div>
    <div className={styles.resultItem}><strong>Path:</strong> {note.file_path}</div>
    <div className={styles.resultItem}><strong>Pattern:</strong> {note.error_pattern}</div>
    <div className={styles.resultTagList}>{note.tags.map((tag, i) => (<span key={i} className={styles.resultTag}>{tag}</span>))}</div>
  </div>
))}
```

**Step 6: Verify TypeScript**

Run: `cd obsidian-chat && npx tsc --noEmit 2>&1 | head -30`

Fix any type errors before committing.

**Step 7: Commit**
```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: update frontend for multi-note response — new types, multi-result display"
```

---

## Task 8: Frontend — Side-by-side editor with Save button

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`
- Modify: `obsidian-chat/src/app/page.module.css`

**Step 1: Add editor state variables** in `page.tsx` (after the existing editor state around line 103):
```typescript
const [noteContentDirty, setNoteContentDirty] = useState(false);
const [savingNote, setSavingNote] = useState(false);
```

**Step 2: Add `handleSaveNote` function** (after `handleFormatChat`):
```typescript
const handleSaveNote = async () => {
  if (!selectedNote || savingNote) return;
  setSavingNote(true);
  try {
    const resp = await fetch("/api/save-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vaultPath, notePath: selectedNote.path, content: noteContent }),
    });
    if (resp.ok) {
      setNoteContentDirty(false);
    } else {
      alert("Failed to save note.");
    }
  } catch {
    alert("Error saving note.");
  } finally {
    setSavingNote(false);
  }
};
```

**Step 3: Update `openNote`** — reset dirty state when a note is opened.
Find the line `setNoteContent(data.content || "");` and add after it:
```typescript
setNoteContentDirty(false);
```

**Step 4: Replace the read-only editor content area**

Find:
```tsx
{loadingNote ? (
  <div className={styles.editorLoading}>Loading note...</div>
) : (
  <div className={styles.editorContent} dangerouslySetInnerHTML={{ __html: renderMarkdown(noteContent) }} />
)}
```
Replace with:
```tsx
{loadingNote ? (
  <div className={styles.editorLoading}>Loading note...</div>
) : (
  <div className={styles.editorSplitPane}>
    <textarea
      className={styles.editorTextarea}
      value={noteContent}
      onChange={(e) => { setNoteContent(e.target.value); setNoteContentDirty(true); }}
      spellCheck={false}
    />
    <div
      className={styles.editorPreviewPane}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(noteContent) }}
    />
  </div>
)}
```

**Step 5: Add Save button to editor header**

Find the `<div className={styles.editorActions}>` block. Add Save button as the FIRST element inside it:
```tsx
{noteContentDirty && (
  <button className={styles.saveNoteBtn} onClick={handleSaveNote} disabled={savingNote}>
    {savingNote ? (
      <>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinIcon} aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        Saving...
      </>
    ) : (
      <>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        Save
      </>
    )}
  </button>
)}
```

**Step 6: Add CSS for split pane, textarea, preview, and save button**

In `page.module.css`, add these classes (can be placed after `.editorContent`):
```css
.editorSplitPane {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

.editorTextarea {
  flex: 1;
  background: rgba(0, 0, 0, 0.25);
  color: rgba(255, 255, 255, 0.82);
  border: none;
  border-right: 1px solid rgba(255, 255, 255, 0.07);
  padding: 16px;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.65;
  resize: none;
  outline: none;
  overflow-y: auto;
}

.editorPreviewPane {
  flex: 1;
  padding: 16px 20px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.75;
  color: rgba(255, 255, 255, 0.8);
}

.editorPreviewPane h1 { font-size: 16px; margin: 0 0 10px; color: rgba(255,255,255,0.95); }
.editorPreviewPane h2 { font-size: 14px; margin: 14px 0 6px; color: rgba(255,255,255,0.9); }
.editorPreviewPane h3 { font-size: 13px; margin: 12px 0 4px; color: rgba(255,255,255,0.85); }
.editorPreviewPane strong { color: rgba(255,255,255,0.95); }
.editorPreviewPane .wikilink {
  color: rgba(140, 180, 255, 0.9);
  border-bottom: 1px solid rgba(140, 180, 255, 0.3);
}

.saveNoteBtn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 5px;
  border: 1px solid rgba(100, 220, 100, 0.35);
  background: rgba(100, 220, 100, 0.08);
  color: rgba(120, 220, 120, 0.85);
  cursor: pointer;
  transition: all 0.15s;
}

.saveNoteBtn:hover:not(:disabled) {
  background: rgba(100, 220, 100, 0.15);
  border-color: rgba(100, 220, 100, 0.55);
}

.saveNoteBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Step 7: Verify TypeScript and visually check in browser**

Run: `cd obsidian-chat && npx tsc --noEmit 2>&1 | head -20`

Expected: No new errors.

**Step 8: Commit**
```bash
git add obsidian-chat/src/app/page.tsx obsidian-chat/src/app/page.module.css
git commit -m "feat: add side-by-side markdown editor with live preview and Save button"
```

---

## Task 9: Frontend — Key Note button + synthesis flow

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`
- Modify: `obsidian-chat/src/app/page.module.css`

**Step 1: Add Key Note state variables** (after `savingNote` state):
```typescript
const [keyNoteLoading, setKeyNoteLoading] = useState(false);
const [isKeyNotePreview, setIsKeyNotePreview] = useState(false);
const [keyNoteFilename, setKeyNoteFilename] = useState("");
```

**Step 2: Add `handleKeyNote` function** (after `handleSaveNote`):
```typescript
const handleKeyNote = async () => {
  if (!selectedNote || keyNoteLoading) return;
  setKeyNoteLoading(true);
  setIsKeyNotePreview(false);
  try {
    const resp = await fetch(`${CREWAI_URL}/keynote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vault_path: vaultPath, note_path: selectedNote.path }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    if (data.success) {
      setNoteContent(data.content);
      setKeyNoteFilename(data.suggested_filename);
      setIsKeyNotePreview(true);
      setNoteContentDirty(true);
      setSelectedNote({ title: data.suggested_filename.replace(".md", ""), path: data.suggested_filename });
    } else {
      alert(`Key Note failed: ${data.error}`);
    }
  } catch (error) {
    alert(`Error generating Key Note: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    setKeyNoteLoading(false);
  }
};
```

**Step 3: Add Key Note button to editor header actions**

In the `<div className={styles.editorActions}>` block, add the Key Note button AFTER the Format button and BEFORE the Obsidian button:
```tsx
<button
  className={styles.keyNoteBtn}
  onClick={handleKeyNote}
  disabled={keyNoteLoading || formatting}
  title="Collect all notes referencing this one and synthesize a Key Note"
>
  {keyNoteLoading ? (
    <>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinIcon} aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
      Synthesizing...
    </>
  ) : (
    <>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      Key Note
    </>
  )}
</button>
```

**Step 4: Show Key Note preview banner** when `isKeyNotePreview` is true.

Add this just before the `<div className={styles.editorSplitPane}>` in the editor:
```tsx
{isKeyNotePreview && (
  <div className={styles.keyNotePreviewBanner}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    <span>Key Note preview — edit above then click <strong>Save</strong> to write to vault as</span>
    <input
      type="text"
      value={keyNoteFilename}
      onChange={(e) => { setKeyNoteFilename(e.target.value); setSelectedNote({ title: e.target.value.replace(".md", ""), path: e.target.value }); }}
      className={styles.keyNoteFilenameInput}
    />
    <button className={styles.keyNoteDiscardBtn} onClick={() => { setIsKeyNotePreview(false); setKeyNoteFilename(""); setNoteContent(""); setNoteContentDirty(false); setSelectedNote(null); }}>
      Discard
    </button>
  </div>
)}
```

**Step 5: Add Key Note CSS to page.module.css**:
```css
.keyNoteBtn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 5px;
  border: 1px solid rgba(255, 210, 50, 0.3);
  background: rgba(255, 210, 50, 0.06);
  color: rgba(255, 210, 50, 0.8);
  cursor: pointer;
  transition: all 0.15s;
}

.keyNoteBtn:hover:not(:disabled) {
  background: rgba(255, 210, 50, 0.14);
  border-color: rgba(255, 210, 50, 0.5);
}

.keyNoteBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.keyNotePreviewBanner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(255, 210, 50, 0.07);
  border-bottom: 1px solid rgba(255, 210, 50, 0.2);
  font-size: 11px;
  color: rgba(255, 210, 50, 0.75);
  flex-shrink: 0;
}

.keyNoteFilenameInput {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 210, 50, 0.25);
  border-radius: 4px;
  color: rgba(255, 210, 50, 0.85);
  font-size: 11px;
  padding: 2px 6px;
  width: 220px;
  outline: none;
}

.keyNoteDiscardBtn {
  margin-left: auto;
  padding: 3px 8px;
  font-size: 10px;
  border-radius: 4px;
  border: 1px solid rgba(255, 100, 100, 0.3);
  background: rgba(255, 100, 100, 0.06);
  color: rgba(255, 100, 100, 0.7);
  cursor: pointer;
}

.keyNoteDiscardBtn:hover {
  background: rgba(255, 100, 100, 0.12);
}
```

**Step 6: Verify TypeScript**

Run: `cd obsidian-chat && npx tsc --noEmit 2>&1 | head -30`

Fix any errors before committing.

**Step 7: Commit**
```bash
git add obsidian-chat/src/app/page.tsx obsidian-chat/src/app/page.module.css
git commit -m "feat: add Key Note button — synthesizes all referencing vault notes into a single Key Note"
```

---

## Final Verification

**Step 1: Start the backend**

Run: `cd usmle_error_note && python server.py`

Expected: Server starts on port 8000, no import errors.

**Step 2: Start the frontend**

Run: `cd obsidian-chat && npm run dev`

Expected: Next.js starts on port 3000.

**Step 3: Manual smoke test — multi-note generation**
1. Paste a UWorld screenshot in chat and press Send
2. Answer the diagnostic questions
3. Verify: chat message shows "X micro-notes saved" with paths
4. Verify: right sidebar shows one result card per note created
5. Verify: notes appear in vault folder

**Step 4: Manual smoke test — editor**
1. Switch to Editor mode, select a note
2. Verify: left pane shows raw markdown, right pane shows rendered preview
3. Edit text in left pane → preview updates, Save button appears
4. Click Save → Save button disappears, note on disk is updated

**Step 5: Manual smoke test — Key Note**
1. Select a note that has wikilinks pointing to it from other notes
2. Click "Key Note" button
3. Verify: synthesized content loads in editor with banner
4. Edit the filename if desired, click Save
5. Verify: new key-*.md file appears in vault
