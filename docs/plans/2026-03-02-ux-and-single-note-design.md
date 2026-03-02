# UX Improvements + Single Note + Anki Speed Design

**Date:** 2026-03-02
**Goals:** 5 distinct improvements — single note per question, unlimited on-demand questions with question index persistence, left sidebar visual polish, app rename, and direct-to-AnkiConnect search.

---

## 1. One Note Per Question (Backend)

**Problem:** The crew generates 1–3 "gaps" and 1–3 notes per question. User wants exactly 1 note per question.

**Changes:**

### `models.py`
- `QuestionsOutput.questions`: `max_length=3` → `max_length=1`
- `ErrorPatternOutput.gaps`: `max_length=3` → `max_length=1`

### `tasks.yaml`
- `generate_questions`: Remove the 3-question hard/medium/easy structure. Ask for exactly 1 question at a specific difficulty. Add `{difficulty_target}` and `{previous_questions_json}` placeholders.
- `infer_error_pattern`: Change "identify 1-3 DISTINCT knowledge gaps" → "identify exactly 1 primary knowledge gap". Remove the multi-gap instructions.
- `compose_note`: Change "Compose multiple micro-notes — one per knowledge gap" → "Compose exactly one micro-note for the single knowledge gap."

### `server.py` — `/questions` endpoint
- `QuestionsRequest` gains optional `previous_questions: List[str] = []` and `difficulty_target: str = "hard"`
- Pass `previous_questions_json` and `difficulty_target` to the crew inputs
- The `generate_questions` task uses these to avoid repeating questions

### `server.py` — `/generate` endpoint
- Remove the `len(notes) == 1` guard on the `formatted_text` override (always 1 note now, safe to unconditionally apply formatted content)
- Keep everything else as-is

### `models.py` — new `QuestionsRequest` fields
```python
class QuestionsRequest(BaseModel):
    extraction: ExtractionInput
    previous_questions: List[str] = []
    difficulty_target: str = "hard"
```

---

## 2. Unlimited On-Demand Questions + Question Index File

**Problem:** Questions are pre-generated in a batch of 3 with hard limit. User wants unlimited questions on demand.

**Architecture:** Generate 1 question at a time, on demand. Track previous questions in frontend state to avoid repeats. After extraction, save question data to a JSON index file in the vault.

### Backend — `server.py`

**`/questions` endpoint update:**
- Receives `previous_questions: List[str]` (text of questions already asked)
- Receives `difficulty_target: str` ("hard" | "medium" | "easy" — cycles or picks based on count)
- Returns 1 question (`QuestionsResponse.questions` is a list of 1)

**New: question index file write**
After successful extraction (in the `/extract` endpoint or called from the frontend), write to `{vault_path}/question_index.json`:
```json
{
  "q12345": {
    "question_id": "12345",
    "question": "...",
    "choosed_alternative": "...",
    "wrong_alternative": "...",
    "explanation": "...",
    "educational_objective": "...",
    "timestamp": 1234567890
  }
}
```
- Read existing file if present, merge by `question_id`, write back
- This is done in `server.py` inside the `/extract` endpoint

### Frontend — `page.tsx`

**State changes:**
- Remove: `mcQuestions: MCQuestion[]`, `currentQuestionIdx: number`
- Add: `currentQuestion: MCQuestion | null`, `questionCount: number`, `previousQuestions: string[]`

**Flow:**
1. Screenshot → `/extract` → extraction saved → `/questions` (with `previous_questions=[]`, `difficulty_target="hard"`) → `currentQuestion` set, `questionCount=1`
2. User answers → wrong → generate note → "More Questions?" prompt
3. User clicks "More Questions" → `/questions` called with `previous_questions=[...all asked so far]`, `difficulty_target` cycles (hard→medium→easy→hard...) → `currentQuestion` updated, `questionCount++`, `previousQuestions` appended
4. Display: "Question {questionCount}" (no "of N")
5. User clicks "Done" → `resetWorkflow()`

**Difficulty cycling:** `["hard", "medium", "easy"][(questionCount - 1) % 3]`

---

## 3. Left Sidebar Visual Polish

**File:** `obsidian-chat/src/app/page.module.css`

**Changes to `.sidebar h1`:**
- Increase font-size: `11px` → `13px`
- Change color: `var(--text-muted)` → `var(--text)` (more prominent)
- Remove `text-transform: uppercase` and `letter-spacing`
- Increase bottom padding

**`.viewToggle`:**
- Increase top margin: `12px` → `16px`

**`.pathSection`:**
- Add `margin-top: 12px`, padding normalization

**`.extractorInfo` / `.extractorDesc`:**
- Tighten font size, improve muted color

**General:** Add a subtle `border-bottom: 1px solid var(--border)` after the view toggle to visually separate navigation from content.

---

## 4. App Rename

**File:** `obsidian-chat/src/app/page.tsx`

- Line 1204: `<h1>Obsidian Chat</h1>` → `<h1>USMLE Error Agent</h1>`
- Line 1369: `<h2>Obsidian Chat</h2>` → `<h2>USMLE Error Agent</h2>`

**File:** `obsidian-chat/src/app/layout.tsx` (if it exists — check for `<title>`)
- Update browser tab title to "USMLE Error Agent"

---

## 5. Anki Direct Search (Bypass Python Backend)

**Problem:** 400ms debounce + Python backend roundtrip + 3 sequential AnkiConnect calls = slow.
**Fix:** Call AnkiConnect directly from the browser.

### Frontend — `page.tsx`

**Add helper:**
```ts
async function ankiConnect(action: string, params: Record<string, unknown> = {}) {
  const resp = await fetch("http://localhost:8765", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}
```

**Replace `useEffect` for Anki search:**
- Debounce: `400ms` → `150ms`
- Instead of `fetch(CREWAI_URL/anki/direct-search)`, call:
  1. `ankiConnect("findCards", { query: searchQuery })` → card IDs
  2. `ankiConnect("cardsInfo", { cards: limitedIds })` → card details
  3. Extract note IDs → `ankiConnect("notesInfo", { notes: noteIds })` → tags
- Build `AnkiCard[]` from combined data (same logic as current Python backend)
- `connection refused` / `fetch` error → `setAnkiError("Anki is not running...")`

**Same search query logic as Python backend:**
- Empty query → `"deck:*"`, limit 10
- Bare word/number → `tag::${q}`, limit 20
- Otherwise pass as-is

**No changes to Python backend** — `/anki/direct-search` stays for reference but UI no longer calls it.

---

## File Change Summary

| File | Changes |
|------|---------|
| `usmle_error_note/models.py` | QuestionsOutput max=1, ErrorPatternOutput max=1, QuestionsRequest gains `previous_questions` + `difficulty_target` |
| `usmle_error_note/config/tasks.yaml` | generate_questions → 1 question with difficulty/previous context; infer_error_pattern → 1 gap; compose_note → 1 note |
| `usmle_error_note/crew.py` | Pass new inputs to build_questions_crew |
| `usmle_error_note/server.py` | /questions: accept previous_questions + difficulty_target; /extract: write question_index.json; /generate: remove len==1 guard |
| `obsidian-chat/src/app/page.tsx` | State refactor (single question, count, previousQuestions); ankiConnect helper; direct Anki search; rename h1/h2 |
| `obsidian-chat/src/app/page.module.css` | Sidebar h1 polish, spacing improvements |
| `obsidian-chat/src/app/layout.tsx` | Browser title rename |
