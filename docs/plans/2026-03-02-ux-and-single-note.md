# UX + Single Note + Anki Speed Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 issues — enforce 1 note per question, switch to unlimited on-demand questions with question index persistence, rename the app, polish the left sidebar, and make Anki search bypass the Python backend for near-instant results.

**Architecture:** Backend changes (models.py, tasks.yaml, server.py) are independent of frontend changes (page.tsx, page.module.css, layout.tsx). Within backend: model constraints flow through to prompt changes to server wiring. Within frontend: the state refactor (single question) is the biggest change; rename and CSS polish are trivial and done first.

**Tech Stack:** Python/FastAPI/CrewAI (backend), Next.js/React/TypeScript (frontend), AnkiConnect HTTP API (direct browser→Anki).

---

## Task 1: Models — enforce 1 note and 1 question per call

**Files:**
- Modify: `usmle_error_note/models.py`

**Step 1: Change QuestionsOutput to max 1 question**

In `models.py`, find:
```python
class QuestionsOutput(BaseModel):
    questions: List[MCQuestion] = Field(
        description="1 to 3 MC questions ordered from hardest to easiest",
        min_length=1,
        max_length=3,
    )
```

Replace with:
```python
class QuestionsOutput(BaseModel):
    questions: List[MCQuestion] = Field(
        description="Exactly 1 multiple-choice diagnostic question",
        min_length=1,
        max_length=1,
    )
```

**Step 2: Change ErrorPatternOutput to max 1 gap**

Find:
```python
class ErrorPatternOutput(BaseModel):
    gaps: List[GapItem] = Field(description="1-3 distinct knowledge gaps identified", min_length=1, max_length=3)
```

Replace with:
```python
class ErrorPatternOutput(BaseModel):
    gaps: List[GapItem] = Field(description="Exactly 1 primary knowledge gap", min_length=1, max_length=1)
```

**Step 3: Add previous_questions and difficulty_target to QuestionsRequest**

Find:
```python
class QuestionsRequest(BaseModel):
    extraction: ExtractionInput
```

Replace with:
```python
class QuestionsRequest(BaseModel):
    extraction: ExtractionInput
    previous_questions: List[str] = []
    difficulty_target: str = "hard"
```

**Step 4: Verify no syntax errors**

```bash
cd usmle_error_note && python -c "from models import QuestionsOutput, ErrorPatternOutput, QuestionsRequest; print('OK')"
```
Expected: `OK`

**Step 5: Commit**

```bash
git add usmle_error_note/models.py
git commit -m "feat: constrain QuestionsOutput to 1 question, ErrorPatternOutput to 1 gap"
```

---

## Task 2: tasks.yaml — rewrite generate_questions for single on-demand question

**Files:**
- Modify: `usmle_error_note/config/tasks.yaml`

**Step 1: Replace the generate_questions task**

Find the entire `generate_questions:` block (lines 1–45) and replace with:

```yaml
generate_questions:
  description: >
    You received a UWorld question extraction:
    - question_id: {question_id}
    - question_stem: {question}
    - user_chose (WRONG): {choosed_alternative}
    - correct_answer: {wrong_alternative}
    - educational_objective: {educational_objective}
    - explanation (summary): {explanation_summary}

    Target difficulty for this question: {difficulty_target}

    Previously asked questions (DO NOT repeat these):
    {previous_questions_json}

    YOUR TASK: Generate exactly 1 multiple-choice diagnostic question at the
    specified difficulty level. The question must test a specific hypothesis
    about why the user got the original UWorld question wrong.

    Difficulty guidelines:
    - hard: Tests complex reasoning — integrating multiple concepts. Uses specific
      terms from the stem. Cannot be answered without understanding the mechanism.
    - medium: Tests one key concept — the core mechanism or fact from the
      educational objective.
    - easy: Tests a basic fact — a simple definition or identification that
      should be trivially known if the concept is understood.

    STRICT RULES:
    1. Generate EXACTLY 1 question at the "{difficulty_target}" level.
    2. NEVER repeat any question from the "Previously asked questions" list.
    3. NEVER ask broad questions like "What was your reasoning?" or open-ended prompts.
    4. The question MUST name specific medical terms from the extraction.
    5. The question MUST have exactly 3 or 4 options.
    6. Exactly ONE option is correct. Wrong options must be plausible distractors.
    7. The "correct" field is the 0-based index of the right option.

    Return a JSON object with a "questions" key containing a list of exactly 1 object:
    [{{"question": "...", "options": ["A", "B", "C"], "correct": 0, "difficulty": "{difficulty_target}"}}]
  expected_output: >
    A JSON object with key "questions" containing a list of exactly 1 MC question object
    with: question (string), options (list of 3-4 strings), correct (int 0-based index),
    difficulty (string matching the target difficulty).
  agent: gap_identifier
```

**Step 2: Rewrite infer_error_pattern to identify exactly 1 gap**

Find the `infer_error_pattern:` block and replace:
- Line: `identify 1-3 DISTINCT knowledge gaps and prepare metadata for each.`
- With: `identify exactly 1 primary knowledge gap and prepare its metadata.`

Replace:
```yaml
    3. Identify 1-3 DISTINCT knowledge gaps. Create multiple gaps only if they
       are genuinely different concepts. When in doubt, prefer fewer (1 is fine).
    4. For EACH gap:
```
With:
```yaml
    3. Identify exactly 1 PRIMARY knowledge gap — the single most important
       concept the user needs to learn to avoid this error in the future.
    4. For that gap:
```

Replace:
```yaml
    Return: a JSON object with key "gaps" containing a list of 1-3 gap objects.
  expected_output: >
    A JSON object with key "gaps" containing a list of 1-3 objects,
    each with: slug, action, existing_file, system_tag, topic_tag, concept_tags.
```
With:
```yaml
    Return: a JSON object with key "gaps" containing a list of exactly 1 gap object.
  expected_output: >
    A JSON object with key "gaps" containing a list of exactly 1 object
    with: slug, action, existing_file, system_tag, topic_tag, concept_tags.
```

**Step 3: Rewrite compose_note for single note**

Find:
```yaml
compose_note:
  description: >
    Compose multiple micro-notes — one per knowledge gap — based on the gap list
    from the previous task.
```
Replace the first line:
```yaml
compose_note:
  description: >
    Compose exactly one micro-note for the single knowledge gap identified in
    the previous task.
```

Find:
```yaml
    FOR EACH GAP in the gap list:
```
Replace with:
```yaml
    FOR THE SINGLE GAP from the previous task:
```

Find:
```yaml
    Return all notes as: {{"notes": [{{"action": "created", "file_path": "Title String.md", "error_pattern": "Title String", "tags": ["tag1"], "note_content": "# Note content..."}}]}}
  expected_output: >
    A JSON object with key "notes" containing a list of note objects,
    each with: action, file_path, error_pattern, tags, note_content.
```
Replace with:
```yaml
    Return: {{"notes": [{{"action": "created", "file_path": "Title String.md", "error_pattern": "Title String", "tags": ["tag1"], "note_content": "# Note content..."}}]}}
  expected_output: >
    A JSON object with key "notes" containing a list of exactly 1 note object
    with: action, file_path, error_pattern, tags, note_content.
```

**Step 4: Verify YAML is valid**

```bash
cd usmle_error_note && python -c "import yaml; yaml.safe_load(open('config/tasks.yaml')); print('YAML OK')"
```
Expected: `YAML OK`

**Step 5: Commit**

```bash
git add usmle_error_note/config/tasks.yaml
git commit -m "feat: rewrite tasks.yaml for 1 question + 1 gap + 1 note per call"
```

---

## Task 3: server.py — wire new question params + save question index

**Files:**
- Modify: `usmle_error_note/server.py`

**Step 1: Update /questions endpoint to pass new inputs**

Find the `/questions` endpoint body (around line 164):
```python
    inputs = {
        "question_id": ext.question_id or "unknown",
        "question": ext.question or "N/A",
        "choosed_alternative": ext.choosed_alternative or "N/A",
        "wrong_alternative": ext.wrong_alternative or "N/A",
        "educational_objective": ext.educational_objective or "N/A",
        "explanation_summary": explanation_summary,
    }
```

Replace with:
```python
    inputs = {
        "question_id": ext.question_id or "unknown",
        "question": ext.question or "N/A",
        "choosed_alternative": ext.choosed_alternative or "N/A",
        "wrong_alternative": ext.wrong_alternative or "N/A",
        "educational_objective": ext.educational_objective or "N/A",
        "explanation_summary": explanation_summary,
        "difficulty_target": req.difficulty_target,
        "previous_questions_json": json.dumps(req.previous_questions) if req.previous_questions else "[]",
    }
```

**Step 2: Add question index save helper**

After the `_strip_code_fence` function (around line 119), add:

```python
# ── Helper: save extraction to question index ──────────────────────────────

def _save_question_index(vault_path: str, ext) -> None:
    """Persist extraction data to {vault_path}/question_index.json, keyed by question_id."""
    if not vault_path or not ext.question_id:
        return
    index_path = os.path.join(vault_path, "question_index.json")
    try:
        existing: dict = {}
        if os.path.isfile(index_path):
            with open(index_path, "r", encoding="utf-8") as fh:
                existing = json.load(fh)
        existing[ext.question_id] = {
            "question_id": ext.question_id,
            "question": ext.question or "",
            "choosed_alternative": ext.choosed_alternative or "",
            "wrong_alternative": ext.wrong_alternative or "",
            "explanation": ext.full_explanation or "",
            "educational_objective": ext.educational_objective or "",
            "timestamp": int(__import__("time").time()),
        }
        with open(index_path, "w", encoding="utf-8") as fh:
            json.dump(existing, fh, indent=2, ensure_ascii=False)
        print(f"📚 Saved question {ext.question_id} to question_index.json")
    except Exception as e:
        print(f"⚠️  Could not save question index: {e}")
```

**Step 3: Call _save_question_index from /questions endpoint**

Find in `generate_questions` (after `ext = req.extraction`):
```python
    ext = req.extraction

    # Truncate explanation to ~300 chars for the prompt
```

Add the call after `ext = req.extraction`:
```python
    ext = req.extraction

    # Persist extraction data for later reference
    if hasattr(req, 'vault_path') and req.vault_path:
        _save_question_index(req.vault_path, ext)

    # Truncate explanation to ~300 chars for the prompt
```

Wait — `QuestionsRequest` currently has no `vault_path`. Add it.

**Step 4: Add vault_path to QuestionsRequest (in models.py)**

Open `models.py`. Find:
```python
class QuestionsRequest(BaseModel):
    extraction: ExtractionInput
    previous_questions: List[str] = []
    difficulty_target: str = "hard"
```

Replace with:
```python
class QuestionsRequest(BaseModel):
    extraction: ExtractionInput
    previous_questions: List[str] = []
    difficulty_target: str = "hard"
    vault_path: str = ""
```

**Step 5: Call save in server.py (now vault_path is available)**

In `generate_questions`, after `ext = req.extraction`, add:
```python
    # Persist extraction data to vault question index
    _save_question_index(req.vault_path, ext)
```

**Step 6: Remove len(notes)==1 guard in /generate endpoint**

Find (around line 265):
```python
        # Get formatted content from task 3 (format_note) — may override note_content
        formatted_text = str(result).strip()
        if formatted_text and "---" in formatted_text and len(notes) == 1:
            notes[0] = NoteResult(
```

Remove the `len(notes) == 1` condition:
```python
        # Get formatted content from task 3 (format_note) — overrides note_content
        formatted_text = str(result).strip()
        if formatted_text and "---" in formatted_text and notes:
            notes[0] = NoteResult(
```

**Step 7: Verify server imports/starts cleanly**

```bash
cd usmle_error_note && python -c "from server import app; print('server OK')"
```
Expected: `server OK`

**Step 8: Commit**

```bash
git add usmle_error_note/models.py usmle_error_note/server.py
git commit -m "feat: /questions accepts difficulty+previous context, saves question_index.json"
```

---

## Task 4: Rename app and update browser title

**Files:**
- Modify: `obsidian-chat/src/app/layout.tsx`
- Modify: `obsidian-chat/src/app/page.tsx`

**Step 1: Update browser tab title in layout.tsx**

Find:
```typescript
export const metadata: Metadata = {
  title: "Obsidian Chat",
  description: "Chat with your Obsidian vault using MCP",
};
```

Replace with:
```typescript
export const metadata: Metadata = {
  title: "USMLE Error Agent",
  description: "Diagnose USMLE errors and create Obsidian micro-notes",
};
```

**Step 2: Update sidebar h1 in page.tsx (line ~1204)**

Find:
```tsx
        <h1>Obsidian Chat</h1>
```
Replace with:
```tsx
        <h1>USMLE Error Agent</h1>
```

**Step 3: Update empty state h2 in page.tsx (line ~1369)**

Find:
```tsx
                <h2>Obsidian Chat</h2>
```
Replace with:
```tsx
                <h2>USMLE Error Agent</h2>
```

**Step 4: TypeScript check**

```bash
cd obsidian-chat && npx tsc --noEmit
```
Expected: no output.

**Step 5: Commit**

```bash
git add obsidian-chat/src/app/layout.tsx obsidian-chat/src/app/page.tsx
git commit -m "feat: rename app to USMLE Error Agent"
```

---

## Task 5: Left sidebar visual polish

**Files:**
- Modify: `obsidian-chat/src/app/page.module.css`

**Step 1: Polish the sidebar h1**

Find:
```css
.sidebar h1 {
  padding: 20px 16px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
  margin-bottom: 0;
}
```

Replace with:
```css
.sidebar h1 {
  padding: 16px 16px 14px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  margin-bottom: 0;
}
```

**Step 2: Add separator after view toggle**

Find:
```css
.viewToggle {
  display: flex;
  gap: 2px;
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 3px;
  margin: 12px 12px 0;
}
```

Replace with:
```css
.viewToggle {
  display: flex;
  gap: 2px;
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 3px;
  margin: 14px 12px 0;
}

.viewToggleDivider {
  height: 1px;
  background: var(--border);
  margin: 12px 0 0;
}
```

**Step 3: Add the divider element in page.tsx after viewToggle**

In `page.tsx`, find the view toggle closing `</div>` (the one that contains all three view toggle buttons, around line 1229):
```tsx
        </div>

        {/* Vault Path */}
```

Replace with:
```tsx
        </div>
        <div className={styles.viewToggleDivider} />

        {/* Vault Path */}
```

**Step 4: TypeScript check**

```bash
cd obsidian-chat && npx tsc --noEmit
```
Expected: no output.

**Step 5: Commit**

```bash
git add obsidian-chat/src/app/page.module.css obsidian-chat/src/app/page.tsx
git commit -m "feat: polish left sidebar — bolder title, cleaner dividers"
```

---

## Task 6: Frontend — single on-demand question state refactor

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

This is the largest change. Read `page.tsx` fully before editing.

### Step 1: Replace question state declarations

Find (around line 143–155):
```tsx
  // Error-Note workflow
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("idle");
  const [extractedJson, setExtractedJson] = useState<any>(null);
  const [mcQuestions, setMcQuestions] = useState<MCQuestionItem[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState<string[]>([]);
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<string[]>([]);
  const [mcFeedback, setMcFeedback] = useState<{ selected: number; correct: boolean } | null>(null);
  const [errorNoteResult, setErrorNoteResult] = useState<ErrorNoteResult | null>(null);
  const [showContinueChoice, setShowContinueChoice] = useState(false);
  const [pendingAnswersForNote, setPendingAnswersForNote] = useState<string[]>([]);
  const [showPostGenChoice, setShowPostGenChoice] = useState(false);
  const [showCreateNoteChoice, setShowCreateNoteChoice] = useState(false);
```

Replace with:
```tsx
  // Error-Note workflow
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("idle");
  const [extractedJson, setExtractedJson] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<MCQuestionItem | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<string[]>([]);
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<string[]>([]);
  const [mcFeedback, setMcFeedback] = useState<{ selected: number; correct: boolean } | null>(null);
  const [errorNoteResult, setErrorNoteResult] = useState<ErrorNoteResult | null>(null);
  const [showPostGenChoice, setShowPostGenChoice] = useState(false);
  const [showCreateNoteChoice, setShowCreateNoteChoice] = useState(false);
```

(Note: `showContinueChoice` and `pendingAnswersForNote` are removed — no longer needed.)

### Step 2: Add fetchNextQuestion helper

Add this function immediately before `runFullWorkflow` (around line 570):

```tsx
  // ── Fetch one question on demand ───────────────────────────────────────

  const fetchNextQuestion = async (
    extraction: any,
    prevQuestions: string[],
    count: number
  ): Promise<MCQuestionItem | null> => {
    const difficulties = ["hard", "medium", "easy"];
    const difficulty = difficulties[count % 3];
    try {
      const resp = await fetch(`${CREWAI_URL}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraction,
          previous_questions: prevQuestions,
          difficulty_target: difficulty,
          vault_path: vaultPath,
        }),
      });
      if (!resp.ok) throw new Error(`Questions error: ${resp.status}`);
      const data = await resp.json();
      const q = (data.questions || [])[0];
      if (!q || !q.question || !Array.isArray(q.options) || q.options.length === 0) return null;
      return q as MCQuestionItem;
    } catch {
      return null;
    }
  };
```

### Step 3: Rewrite runFullWorkflow

Find the entire `runFullWorkflow` function (lines ~570–613) and replace:

```tsx
  const runFullWorkflow = async () => {
    if (uploadedImages.length === 0 || loading) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: `📸 Sent ${uploadedImages.length} screenshot${uploadedImages.length > 1 ? "s" : ""} for error note` }]);
    setLoading(true);
    setWorkflowStep("extracting");
    const imagesToSend = [...uploadedImages];
    setUploadedImages([]);

    try {
      const extractResp = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: imagesToSend }) });
      if (!extractResp.ok) throw new Error(`Extract error: ${extractResp.status}`);
      const extractData = await extractResp.json();
      if (extractData.error) throw new Error(extractData.error);
      const extracted = extractData.result;
      setExtractedJson(extracted);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: JSON.stringify(extracted, null, 2), isJson: true }]);

      setWorkflowStep("questioning");
      const firstQuestion = await fetchNextQuestion(extracted, [], 0);
      if (!firstQuestion) throw new Error("No valid MC question returned");

      setCurrentQuestion(firstQuestion);
      setQuestionCount(1);
      setPreviousQuestions([firstQuestion.question]);
      setQuestionAnswers([]);
      setDiagnosticQuestions([firstQuestion.question]);
      setMcFeedback(null);

      const optionsText = firstQuestion.options.map((o: string, i: number) => `  ${String.fromCharCode(65 + i)}) ${o}`).join("\n");
      setMessages((prev) => [...prev, { id: (Date.now() + 2).toString(), role: "assistant", content: `🧠 **Question 1** *(${firstQuestion.difficulty})*\n\n${firstQuestion.question}\n\n${optionsText}` }]);
      setWorkflowStep("answering");
    } catch (error) {
      console.error("Workflow error:", error);
      setMessages((prev) => [...prev, { id: (Date.now() + 3).toString(), role: "assistant", content: `Error: ${error instanceof Error ? error.message : "Workflow failed."}` }]);
      setWorkflowStep("idle");
    } finally {
      setLoading(false);
    }
  };
```

### Step 4: Rewrite handleMCAnswer

Find the entire `handleMCAnswer` function (lines ~615–648) and replace:

```tsx
  const handleMCAnswer = (optionIdx: number) => {
    if (mcFeedback || loading || !currentQuestion) return;
    const q = currentQuestion;
    const isCorrect = optionIdx === q.correct;
    const chosenLetter = String.fromCharCode(65 + optionIdx);
    const correctLetter = String.fromCharCode(65 + q.correct);
    setMcFeedback({ selected: optionIdx, correct: isCorrect });

    const updatedAnswers = [...questionAnswers, `${chosenLetter}) ${q.options[optionIdx]} [${isCorrect ? "CORRECT" : "WRONG - correct: " + correctLetter + ") " + q.options[q.correct]}]`];
    setQuestionAnswers(updatedAnswers);

    setMessages((prev) => [...prev, {
      id: Date.now().toString(), role: "user",
      content: `${chosenLetter}) ${q.options[optionIdx]}`
    }]);

    setTimeout(() => {
      if (!isCorrect) {
        const msg = `❌ That was **${correctLetter}) ${q.options[q.correct]}**. Generating your note now...`;
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: msg }]);
        handleSubmitAnswers(updatedAnswers);
      } else {
        const msg = `✅ Correct! **${chosenLetter}) ${q.options[optionIdx]}**`;
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: msg }]);
        setShowCreateNoteChoice(true);
      }
    }, 1200);
  };
```

### Step 5: Rewrite resetWorkflow

Find:
```tsx
  const resetWorkflow = () => {
    setWorkflowStep("idle");
    setExtractedJson(null);
    setDiagnosticQuestions([]);
    setQuestionAnswers([]);
    setMcQuestions([]);
    setCurrentQuestionIdx(0);
    setMcFeedback(null);
    setErrorNoteResult(null);
    setShowContinueChoice(false);
    setPendingAnswersForNote([]);
    setShowPostGenChoice(false);
    setShowCreateNoteChoice(false);
  };
```

Replace with:
```tsx
  const resetWorkflow = () => {
    setWorkflowStep("idle");
    setExtractedJson(null);
    setCurrentQuestion(null);
    setQuestionCount(0);
    setPreviousQuestions([]);
    setDiagnosticQuestions([]);
    setQuestionAnswers([]);
    setMcFeedback(null);
    setErrorNoteResult(null);
    setShowPostGenChoice(false);
    setShowCreateNoteChoice(false);
  };
```

### Step 6: Update handleSubmitAnswers — "More Questions" path

Find in `handleSubmitAnswers` (around line 687–693):
```tsx
      // If more questions are available, ask user; otherwise mark done
      if (currentQuestionIdx < mcQuestions.length - 1) {
        setShowPostGenChoice(true);
        setWorkflowStep("answering");
      } else {
        setWorkflowStep("done");
      }
```

Replace with:
```tsx
      // Always offer more questions
      setShowPostGenChoice(true);
      setWorkflowStep("answering");
```

### Step 7: Rewrite the Post-Gen choice UI (showPostGenChoice block)

Find the "More Questions" button handler inside `showPostGenChoice` (around line 1421–1435):
```tsx
                    <button
                      style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #22c55e", background: "rgba(34,197,94,0.15)", color: "#22c55e", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}
                      onClick={() => {
                        setShowPostGenChoice(false);
                        const nextIdx = currentQuestionIdx + 1;
                        setCurrentQuestionIdx(nextIdx);
                        setMcFeedback(null);
                        const nextQ = mcQuestions[nextIdx];
                        const optionsText = nextQ.options.map((o, i) => `  ${String.fromCharCode(65 + i)}) ${o}`).join("\n");
                        setMessages((prev) => [...prev, {
                          id: Date.now().toString(), role: "assistant",
                          content: `➡️ Next question *(${nextQ.difficulty})*:\n\n${nextQ.question}\n\n${optionsText}`
                        }]);
                      }}
                    >
                      More Questions
                    </button>
```

Replace with:
```tsx
                    <button
                      style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #22c55e", background: "rgba(34,197,94,0.15)", color: "#22c55e", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}
                      onClick={async () => {
                        setShowPostGenChoice(false);
                        setLoading(true);
                        const nextQ = await fetchNextQuestion(extractedJson, previousQuestions, questionCount);
                        setLoading(false);
                        if (!nextQ) {
                          setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: "No more unique questions could be generated. You're done!" }]);
                          setWorkflowStep("done");
                          return;
                        }
                        const newCount = questionCount + 1;
                        setCurrentQuestion(nextQ);
                        setQuestionCount(newCount);
                        setPreviousQuestions((prev) => [...prev, nextQ.question]);
                        setDiagnosticQuestions((prev) => [...prev, nextQ.question]);
                        setMcFeedback(null);
                        setQuestionAnswers([]);
                        const optionsText = nextQ.options.map((o: string, i: number) => `  ${String.fromCharCode(65 + i)}) ${o}`).join("\n");
                        setMessages((prev) => [...prev, {
                          id: Date.now().toString(), role: "assistant",
                          content: `➡️ **Question ${newCount}** *(${nextQ.difficulty})*:\n\n${nextQ.question}\n\n${optionsText}`
                        }]);
                      }}
                    >
                      More Questions
                    </button>
```

### Step 8: Remove the showContinueChoice block from JSX

Find the `showContinueChoice` ternary branch in the JSX (around line 1487–1523):
```tsx
            ) : showContinueChoice ? (
              /* ── After skipping note: want more questions? ──────────── */
              <div className={styles.questionCards}>
                ...entire block...
              </div>
```

Delete this entire branch (from `) : showContinueChoice ? (` down to the matching closing `)`).

Also remove the "No, Skip" button's continuation logic inside `showCreateNoteChoice`:

Find:
```tsx
                      onClick={() => {
                        setShowCreateNoteChoice(false);
                        if (currentQuestionIdx < mcQuestions.length - 1) {
                          // More questions available — ask if user wants to continue
                          setShowContinueChoice(true);
                        } else {
                          // No more questions
                          resetWorkflow();
                          setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: "✅ Done! Paste more screenshots whenever you're ready." }]);
                        }
                      }}
```

Replace with:
```tsx
                      onClick={() => {
                        setShowCreateNoteChoice(false);
                        setShowPostGenChoice(true);
                      }}
```

### Step 9: Update the question display card footer

Find (around line 1557):
```tsx
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "#666", textTransform: "uppercase" as const, letterSpacing: "1px" }}>
                    {mcQuestions[currentQuestionIdx].difficulty} • Question {currentQuestionIdx + 1} of {mcQuestions.length}
                  </div>
```

Replace with:
```tsx
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "#666", textTransform: "uppercase" as const, letterSpacing: "1px" }}>
                    {currentQuestion?.difficulty} • Question {questionCount}
                  </div>
```

### Step 10: Update the question card JSX guard condition

Find:
```tsx
            ) : currentQuestionIdx < mcQuestions.length ? (
              <div className={styles.questionCards}>
                <div className={styles.questionCard}>
                  <label className={styles.questionLabel}>
                    <span className={styles.questionNumber}>{currentQuestionIdx + 1}</span>
                    <span>{mcQuestions[currentQuestionIdx].question}</span>
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                    {mcQuestions[currentQuestionIdx].options.map((opt, i) => {
                      let btnStyle: React.CSSProperties = {
                        padding: "12px 16px", border: "1px solid #444", borderRadius: "10px",
                        background: "#2a2a2a", color: "#dcddde", cursor: "pointer", textAlign: "left" as const,
                        fontSize: "13px", fontFamily: "inherit", transition: "all 0.2s",
                        display: "flex", alignItems: "center", gap: "10px",
                      };
                      if (mcFeedback) {
                        if (i === mcQuestions[currentQuestionIdx].correct) {
                          btnStyle = { ...btnStyle, border: "2px solid #22c55e", background: "rgba(34,197,94,0.15)", color: "#22c55e" };
                        } else if (i === mcFeedback.selected && !mcFeedback.correct) {
                          btnStyle = { ...btnStyle, border: "2px solid #ef4444", background: "rgba(239,68,68,0.15)", color: "#ef4444" };
                        } else {
                          btnStyle = { ...btnStyle, opacity: 0.4 };
                        }
                      }
                      return (
                        <button key={i} style={btnStyle} onClick={() => handleMCAnswer(i)} disabled={!!mcFeedback}>
                          <span style={{ fontWeight: 700, minWidth: "20px" }}>{String.fromCharCode(65 + i)})</span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
```

Replace with:
```tsx
            ) : currentQuestion ? (
              <div className={styles.questionCards}>
                <div className={styles.questionCard}>
                  <label className={styles.questionLabel}>
                    <span className={styles.questionNumber}>{questionCount}</span>
                    <span>{currentQuestion.question}</span>
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                    {currentQuestion.options.map((opt: string, i: number) => {
                      let btnStyle: React.CSSProperties = {
                        padding: "12px 16px", border: "1px solid #444", borderRadius: "10px",
                        background: "#2a2a2a", color: "#dcddde", cursor: "pointer", textAlign: "left" as const,
                        fontSize: "13px", fontFamily: "inherit", transition: "all 0.2s",
                        display: "flex", alignItems: "center", gap: "10px",
                      };
                      if (mcFeedback) {
                        if (i === currentQuestion.correct) {
                          btnStyle = { ...btnStyle, border: "2px solid #22c55e", background: "rgba(34,197,94,0.15)", color: "#22c55e" };
                        } else if (i === mcFeedback.selected && !mcFeedback.correct) {
                          btnStyle = { ...btnStyle, border: "2px solid #ef4444", background: "rgba(239,68,68,0.15)", color: "#ef4444" };
                        } else {
                          btnStyle = { ...btnStyle, opacity: 0.4 };
                        }
                      }
                      return (
                        <button key={i} style={btnStyle} onClick={() => handleMCAnswer(i)} disabled={!!mcFeedback}>
                          <span style={{ fontWeight: 700, minWidth: "20px" }}>{String.fromCharCode(65 + i)})</span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
```

### Step 11: TypeScript check

```bash
cd obsidian-chat && npx tsc --noEmit
```
Expected: no output. Fix any type errors before committing.

### Step 12: Commit

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: single on-demand questions — unlimited, no 'of N', question index saved"
```

---

## Task 7: Anki direct search — bypass Python backend

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

### Step 1: Add ankiConnect helper function

Find the line `const CREWAI_URL = "http://localhost:8000";` (around line 102 after earlier tasks). Add immediately after:

```tsx
// ── AnkiConnect direct helper ─────────────────────────────────────────────

async function ankiConnect(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const resp = await fetch("http://localhost:8765", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });
  if (!resp.ok) throw new Error(`AnkiConnect HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

// ─────────────────────────────────────────────────────────────────────────────
```

### Step 2: Replace the Anki search useEffect

Find the useEffect that currently fetches `${CREWAI_URL}/anki/direct-search` (around line 940):
```tsx
    // Debounce timer
    const timeoutId = setTimeout(async () => {
      setAnkiLoading(true);
      setAnkiError("");

      try {
        const resp = await fetch(`${CREWAI_URL}/anki/direct-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: ankiQuery }),
        });

        if (resp.status === 503) {
          setAnkiError("Anki is not running. Open Anki with the AnkiConnect plugin installed.");
          setAnkiLoading(false);
          return;
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = await resp.json();
        if (data.error) {
          setAnkiError(data.error);
        } else {
          // Keep selection stability
          setEditingCard(null);
          setExpandedTagCards(new Set());

          const seen = new Set<number>();
          const unique = (data.cards || []).filter((c: AnkiCard) => {
            if (seen.has(c.note_id)) return false;
            seen.add(c.note_id);
            return true;
          });
          setAnkiCards(unique);
        }
      } catch (err) {
        setAnkiError("Failed to reach the backend. Is the server running?");
      } finally {
        setAnkiLoading(false);
      }
    }, 400); // 400ms debounce
```

Replace with:
```tsx
    // Debounce timer — direct AnkiConnect (no Python backend roundtrip)
    const timeoutId = setTimeout(async () => {
      setAnkiLoading(true);
      setAnkiError("");

      try {
        const q = ankiQuery.trim();
        const isEmpty = !q;
        let searchQuery = q;
        if (isEmpty) {
          searchQuery = "deck:*";
        } else if (!q.includes("::") && !["tag:", "deck:", "note:", "is:", "prop:"].some(p => q.startsWith(p))) {
          searchQuery = `tag::${q}`;
        }

        const limit = isEmpty ? 10 : 20;
        const allCardIds = (await ankiConnect("findCards", { query: searchQuery })) as number[];
        if (!allCardIds || allCardIds.length === 0) {
          setAnkiCards([]);
          return;
        }

        const cardIds = allCardIds.slice(-limit).reverse();
        const cardsInfo = (await ankiConnect("cardsInfo", { cards: cardIds })) as any[];
        const noteIds = [...new Set(cardsInfo.map((c: any) => c.note as number))];
        const notesInfo = (await ankiConnect("notesInfo", { notes: noteIds })) as any[];
        const tagsByNote: Record<number, string[]> = {};
        for (const n of notesInfo) tagsByNote[n.noteId] = n.tags || [];

        const seen = new Set<number>();
        const cards: AnkiCard[] = [];
        for (const card of cardsInfo) {
          if (seen.has(card.note)) continue;
          seen.add(card.note);
          const fieldKeys = Object.keys(card.fields || {});
          const fieldVals = Object.values(card.fields || {}) as any[];
          cards.push({
            note_id: card.note,
            card_id: card.cardId,
            front: fieldVals[0]?.value ?? "",
            back: fieldVals[1]?.value ?? "",
            deck: card.deckName ?? "",
            tags: tagsByNote[card.note] ?? [],
            field_names: fieldKeys.slice(0, 2),
            suspended: card.queue === -1,
          });
        }

        setEditingCard(null);
        setExpandedTagCards(new Set());
        setAnkiCards(cards);
      } catch (err: any) {
        const msg = err?.message || "";
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("ERR_CONNECTION_REFUSED")) {
          setAnkiError("Anki is not running. Open Anki with the AnkiConnect plugin installed.");
        } else {
          setAnkiError(msg || "AnkiConnect error.");
        }
      } finally {
        setAnkiLoading(false);
      }
    }, 150); // 150ms debounce — direct localhost call, no backend needed
```

### Step 3: Also update the on-mount Anki fetch (around line 321)

There is also a fetch to `/anki/direct-search` in an initial `useEffect` that loads cards when switching to Anki mode. Find it:

```tsx
        const resp = await fetch(`${CREWAI_URL}/anki/direct-search`, {
```
(There may be 1-2 of these in other useEffects or handlers — search for all occurrences.)

For each occurrence that fetches from `CREWAI_URL/anki/direct-search`, replace with a call to `ankiConnect` using the same logic. In practice, the debounced useEffect on `ankiQuery` already handles refresh when the tab is switched (since `viewMode` is a dependency). If there's a separate initial fetch, remove it — the query useEffect firing on mount with `ankiQuery=""` already handles loading cards.

Search for any remaining `CREWAI_URL}/anki/direct-search` references and delete them (the debounced useEffect now covers all cases).

Also check around lines 2255 and 2308 for any inline fetch calls to `/anki/direct-search` (these are in the note card count check for the activity panel). These call a *different* purpose (card count by tag, not search), so **leave those alone** — only replace the search useEffect.

### Step 4: TypeScript check

```bash
cd obsidian-chat && npx tsc --noEmit
```
Expected: no output.

### Step 5: Manual smoke test

1. Open the app in browser, go to Anki tab
2. Leave search blank — cards should appear within 200ms
3. Type a number like `2513` — results should appear within 200ms
4. With Anki closed, verify the error message shows inline

### Step 6: Commit

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: Anki search calls AnkiConnect directly, 150ms debounce"
```

---

## Verification Checklist

After all tasks:

- [ ] `python -c "from models import *; print('OK')"` — no errors
- [ ] `python -c "import yaml; yaml.safe_load(open('config/tasks.yaml')); print('OK')"` — no errors
- [ ] `npx tsc --noEmit` — no TypeScript errors
- [ ] App title in browser tab shows "USMLE Error Agent"
- [ ] Sidebar h1 shows "USMLE Error Agent" in a larger, non-uppercase font
- [ ] After screenshot workflow: single question shown, no "of N" counter
- [ ] "More Questions" fetches a new question dynamically
- [ ] `question_index.json` appears in vault root after first question fetch
- [ ] Anki search results appear in ~150ms (vs ~600ms+ before)
- [ ] Generating a note from a wrong answer produces exactly 1 note
