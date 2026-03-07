# Format Bar Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Feynman, Flowchart, Expand, and Concise format modes; replace the `<select>` dropdown with a semantic chip toolbar; stream LLM output live into the editor via SSE instead of showing a blocking overlay.

**Architecture:** Four new task prompts in `tasks.yaml` each handle one format mode. A new `/format/stream` FastAPI endpoint runs the CrewAI crew in a background thread while bridging LLM token callbacks to an `asyncio.Queue`, streaming results as SSE. The frontend reads the SSE stream with `fetch` + `ReadableStream` and progressively updates `noteContent`.

**Tech Stack:** FastAPI SSE (`StreamingResponse`), `crewai.LLM` with `stream=True` + `callbacks`, `langchain_core.callbacks.BaseCallbackHandler`, `asyncio.Queue` + `loop.call_soon_threadsafe`, React state updates on each SSE chunk.

---

## Task 1: Add 4 new task prompts to tasks.yaml

**Files:**
- Modify: `usmle_error_note/config/tasks.yaml`

**Step 1: Add `feynman_selection` task**

Append after the `format_selection` task block (after line ~193):

```yaml
feynman_selection:
  description: >
    You are a medical educator using the Feynman Technique.
    Rewrite the SELECTED TEXT below so a first-year medical student
    with zero prior knowledge can understand it instantly.

    SELECTED TEXT TO REWRITE:
    {selected_text}

    FULL NOTE CONTEXT (reference only — do NOT output):
    {note_content}

    RULES:
    1. Replace ALL jargon with plain language. If a term is unavoidable, define it in one clause.
    2. Use active voice, short sentences, and concrete analogies (everyday objects, stories, cause-and-effect chains).
    3. Preserve ALL factual content — never omit or add facts.
    4. Do NOT output YAML frontmatter, code blocks, or the full note.
    5. Return ONLY the rewritten version of the selected text.
  expected_output: >
    The selected text rewritten in plain, student-friendly language. No YAML, no code fences.
  agent: note_formatter

flowchart_selection:
  description: >
    You are a medical educator who visualizes reasoning with Mermaid diagrams.
    Your job is to KEEP the original selected text intact and APPEND a Mermaid
    flowchart that maps the causal or logical chain described in it.

    SELECTED TEXT:
    {selected_text}

    FULL NOTE CONTEXT (reference only — do NOT output):
    {note_content}

    RULES:
    1. Output the ORIGINAL selected text EXACTLY as-is first (do not change a single word).
    2. Then append one blank line followed by a ```mermaid block.
    3. Use `flowchart TD` direction. Nodes represent steps/concepts. Arrows show causation or sequence.
    4. Label each arrow with the relationship (e.g., "causes", "leads to", "prevents").
    5. Keep the diagram to 4-8 nodes — concise enough to read at a glance.
    6. Do NOT output YAML frontmatter or the full note.
  expected_output: >
    The original selected text unchanged, then a blank line, then a ```mermaid flowchart TD block.
    No YAML, no code fences around the whole response.
  agent: note_formatter

expand_selection:
  description: >
    You are a medical educator adding depth to a student's note.
    Expand the SELECTED TEXT by adding mechanism steps, clinical context,
    or clarifying detail that deepens understanding.

    SELECTED TEXT TO EXPAND:
    {selected_text}

    FULL NOTE CONTEXT (reference only — do NOT output):
    {note_content}

    RULES:
    1. ONLY add information that is logically entailed by or directly relevant to the selected text.
    2. Never invent facts, statistics, or drug names not present in the original note.
    3. Preserve ALL original content — expansion goes around and between existing sentences.
    4. Do NOT output YAML frontmatter, code blocks, or the full note.
    5. Return ONLY the expanded version of the selected text.
  expected_output: >
    The expanded selected text with added depth. No YAML, no code fences.
  agent: note_formatter

concise_selection:
  description: >
    You are a medical editor cutting a student's note to its core.
    Distill the SELECTED TEXT to its single essential point.

    SELECTED TEXT TO CONDENSE:
    {selected_text}

    FULL NOTE CONTEXT (reference only — do NOT output):
    {note_content}

    RULES:
    1. Remove filler, repetition, hedging language, and padding.
    2. Preserve every distinct fact — only remove redundancy, not content.
    3. Target 30-50% of the original length.
    4. Do NOT output YAML frontmatter, code blocks, or the full note.
    5. Return ONLY the condensed version of the selected text.
  expected_output: >
    The condensed selected text. No YAML, no code fences.
  agent: note_formatter
```

**Step 2: Verify YAML is valid**

```bash
cd usmle_error_note && python -c "
import yaml
with open('config/tasks.yaml') as f:
    data = yaml.safe_load(f)
expected = ['feynman_selection','flowchart_selection','expand_selection','concise_selection']
for k in expected:
    assert k in data, f'Missing: {k}'
print('OK — all 4 tasks present')
"
```
Expected: `OK — all 4 tasks present`

**Step 3: Commit**

```bash
git add usmle_error_note/config/tasks.yaml
git commit -m "feat: add feynman, flowchart, expand, concise task prompts"
```

---

## Task 2: Add `build_format_crew_streaming` to crew.py

**Files:**
- Modify: `usmle_error_note/crew.py`

**Step 1: Add imports at the top of crew.py**

After the existing imports block, add:

```python
from crewai import LLM
from langchain_core.callbacks import BaseCallbackHandler
```

**Step 2: Add the mode→task mapping constant** (after the existing `build_format_crew` function, before the Anki section):

```python
# ── Format mode routing ───────────────────────────────────────────────────

_MODE_TO_TASK = {
    "feynman":   "feynman_selection",
    "flowchart": "flowchart_selection",
    "expand":    "expand_selection",
    "concise":   "concise_selection",
    "list":      "format_selection",
    "table":     "format_selection",
    "split":     "format_selection",
    "sections":  "format_selection",
}

_MODE_TO_INSTRUCTIONS = {
    "list":     "Make a list",
    "table":    "Make a table",
    "split":    "Divide into shorter ideas by dividing in smaller rationales",
    "sections": "Divide into sub paragraphs with subtitles",
}
```

**Step 3: Add `build_format_crew_streaming` function**

```python
def build_format_crew_streaming(
    note_content: str,
    selected_text: str,
    format_mode: str,
    on_token,           # callable(str) — called with each token from the LLM
    on_done,            # callable() — called when generation is complete
    selected_template: str | None = None,
) -> Crew:
    """Build a streaming format crew. on_token/on_done are called from a background thread."""
    agents_cfg = _load_yaml("agents.yaml")
    tasks_cfg = _load_yaml("tasks.yaml")
    templates = _load_selected_templates(None, selected_template)

    task_key = _MODE_TO_TASK.get(format_mode, "format_selection")
    custom_instructions = _MODE_TO_INSTRUCTIONS.get(format_mode, "")

    # Callback that bridges sync LLM tokens to the async queue via on_token/on_done
    class _StreamHandler(BaseCallbackHandler):
        def on_llm_new_token(self, token: str, **kwargs):
            on_token(token)
        def on_llm_end(self, response, **kwargs):
            on_done()

    handler = _StreamHandler()

    model_cfg = _load_model_config()
    model_str = model_cfg.get("note_formatter", "openai/gpt-4o-mini")
    streaming_llm = LLM(model=model_str, stream=True, callbacks=[handler])

    formatter = Agent(
        role=agents_cfg["note_formatter"]["role"].strip(),
        goal=agents_cfg["note_formatter"]["goal"].strip(),
        backstory=agents_cfg["note_formatter"]["backstory"].strip(),
        tools=[],
        verbose=False,
        llm=streaming_llm,
    )

    format_inputs = {
        "note_content": note_content,
        "selected_text": selected_text,
        **templates,
    }
    t_cfg = tasks_cfg[task_key]
    description = t_cfg["description"].strip().format(**format_inputs)
    if custom_instructions:
        description += f"\n\nADDITIONAL USER INSTRUCTIONS:\n{custom_instructions}"

    task = Task(
        description=description,
        expected_output="The final rewritten text block only, with no YAML or code fences.",
        agent=formatter,
    )

    return Crew(agents=[formatter], tasks=[task], process=Process.sequential, verbose=False)
```

**Step 4: Verify import works**

```bash
cd usmle_error_note && python -c "
from crew import build_format_crew_streaming
print('OK — build_format_crew_streaming imported')
"
```
Expected: `OK — build_format_crew_streaming imported`

**Step 5: Commit**

```bash
git add usmle_error_note/crew.py
git commit -m "feat: add build_format_crew_streaming with SSE token callback"
```

---

## Task 3: Add `/format/stream` SSE endpoint to server.py

**Files:**
- Modify: `usmle_error_note/server.py`

**Step 1: Add imports** at the top of server.py (after existing imports):

```python
import asyncio
import threading
from fastapi.responses import StreamingResponse
```

**Step 2: Add `StreamFormatRequest` model** (right after the existing `FormatResponse` model):

```python
class StreamFormatRequest(BaseModel):
    vault_path: str
    note_path: str
    selected_template: str = ""
    selected_text: str = ""
    format_mode: str = "list"   # feynman | flowchart | expand | concise | list | table | split | sections
```

**Step 3: Add the `/format/stream` endpoint** (right after the existing `/format` endpoint):

```python
@app.post("/format/stream")
async def format_note_stream(req: StreamFormatRequest):
    """SSE endpoint: streams LLM tokens as they are generated."""
    # Read note from disk
    full = os.path.join(req.vault_path, req.note_path.replace("/", os.sep))
    if not os.path.isfile(full):
        async def err():
            yield "data: [ERROR] File not found\n\n"
        return StreamingResponse(err(), media_type="text/event-stream")

    with open(full, "r", encoding="utf-8") as fh:
        original_content = fh.read()

    loop = asyncio.get_event_loop()
    token_queue: asyncio.Queue[str | None] = asyncio.Queue()

    def on_token(tok: str):
        loop.call_soon_threadsafe(token_queue.put_nowait, tok)

    def on_done():
        loop.call_soon_threadsafe(token_queue.put_nowait, None)   # sentinel

    def run_crew():
        try:
            crew = build_format_crew_streaming(
                note_content=original_content,
                selected_text=req.selected_text,
                format_mode=req.format_mode,
                on_token=on_token,
                on_done=on_done,
                selected_template=req.selected_template or None,
            )
            crew.kickoff()
        except Exception as exc:
            traceback.print_exc()
            loop.call_soon_threadsafe(token_queue.put_nowait, f"[ERROR] {exc}")
            loop.call_soon_threadsafe(token_queue.put_nowait, None)

    threading.Thread(target=run_crew, daemon=True).start()

    async def generate():
        accumulated = ""
        while True:
            chunk = await token_queue.get()
            if chunk is None:
                # Write final result back to disk
                if req.selected_text.strip() and accumulated:
                    final = original_content.replace(req.selected_text, accumulated, 1)
                else:
                    final = accumulated
                if final and ("---" in final or req.selected_text.strip()):
                    with open(full, "w", encoding="utf-8") as fh:
                        fh.write(final)
                yield "data: [DONE]\n\n"
                break
            accumulated += chunk
            # Escape newlines so each SSE data line stays on one line
            safe = chunk.replace("\\", "\\\\").replace("\n", "\\n")
            yield f"data: {safe}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )
```

**Step 4: Add import for `build_format_crew_streaming`** in the existing crew import line:

Change:
```python
from crew import build_questions_crew, build_error_note_crew, build_format_crew, list_templates, build_anki_crew, build_anki_format_crew, build_keynote_crew, build_anki_create_crew
```
To:
```python
from crew import build_questions_crew, build_error_note_crew, build_format_crew, build_format_crew_streaming, list_templates, build_anki_crew, build_anki_format_crew, build_keynote_crew, build_anki_create_crew
```

**Step 5: Verify server starts without errors**

```bash
cd usmle_error_note && python -c "import server; print('OK — server imports clean')"
```
Expected: `OK — server imports clean`

**Step 6: Commit**

```bash
git add usmle_error_note/server.py
git commit -m "feat: add /format/stream SSE endpoint for live editor updates"
```

---

## Task 4: Add CSS for chip toolbar and streaming state

**Files:**
- Modify: `obsidian-chat/src/app/page.module.css`

**Step 1: Add chip toolbar styles** (append at end of file):

```css
/* ── Format Chip Toolbar ── */

.formatBar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.formatBar::-webkit-scrollbar {
  display: none;
}

.formatChip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-subtle);
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s, background 0.15s, box-shadow 0.15s;
  position: relative;
}

.formatChip:hover:not(:disabled) {
  color: var(--text);
  border-color: rgba(245, 158, 11, 0.5);
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.2);
}

.formatChip:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.formatChipFeynman {
  border-color: rgba(124, 58, 237, 0.4);
  color: #a78bfa;
}

.formatChipFeynman:hover:not(:disabled) {
  border-color: rgba(124, 58, 237, 0.8);
  box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.25);
  color: #c4b5fd;
}

.formatChipFlowchart {
  border-color: rgba(8, 145, 178, 0.4);
  color: #22d3ee;
}

.formatChipFlowchart:hover:not(:disabled) {
  border-color: rgba(8, 145, 178, 0.8);
  box-shadow: 0 0 0 1px rgba(8, 145, 178, 0.25);
  color: #67e8f9;
}

/* Pulsing dot shown on the active chip while streaming */
.formatChipStreaming::after {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--amber, #f59e0b);
  margin-left: 4px;
  animation: chipPulse 0.8s ease-in-out infinite;
}

@keyframes chipPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.3; transform: scale(0.6); }
}

/* Spacer that pushes Undo to the right */
.formatBarSpacer {
  flex: 1;
}

.formatUndoBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-subtle);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s;
}

.formatUndoBtn:hover:not(:disabled) {
  color: var(--text);
  border-color: rgba(245, 158, 11, 0.5);
}

.formatUndoBtn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ── Expand / Concise quick buttons (inside selection pill) ── */

.selectionQuickActions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.selectionQuickBtn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 14px;
  border: 1px solid rgba(147, 51, 234, 0.4);
  background: rgba(147, 51, 234, 0.1);
  color: #d8b4fe;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.selectionQuickBtn:hover:not(:disabled) {
  background: rgba(147, 51, 234, 0.22);
  border-color: rgba(147, 51, 234, 0.7);
  color: #ede9fe;
}

.selectionQuickBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── Streaming state: glowing amber border on editor ── */

.editorStreaming {
  box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.5), inset 0 0 0 1px rgba(245, 158, 11, 0.15);
  animation: streamingGlow 1.5s ease-in-out infinite;
}

@keyframes streamingGlow {
  0%, 100% { box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.5), inset 0 0 0 1px rgba(245, 158, 11, 0.15); }
  50%       { box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.25), inset 0 0 0 1px rgba(245, 158, 11, 0.08); }
}
```

**Step 2: Commit**

```bash
git add obsidian-chat/src/app/page.module.css
git commit -m "feat: add chip toolbar, streaming border, and quick-action CSS"
```

---

## Task 5: Rewrite format bar in page.tsx

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

**Step 1: Add `streamingChip` state** near the other format states (around line 133):

```tsx
const [streamingChip, setStreamingChip] = useState<string | null>(null); // which chip is streaming
```

**Step 2: Rewrite `formatNote` to use SSE streaming**

Replace the entire `formatNote` function (lines ~728–772) with:

```tsx
const formatNote = async (mode: string, customSelected?: string) => {
  if (!selectedNote || formatting) return;
  setFormatting(true);
  setStreamingChip(mode);

  // Save history before formatting
  setNoteHistory((prev) => [...prev, noteContent].slice(-20));

  const textToFormat = customSelected || selectedFormatText || (() => {
    if (!editorTextAreaRef.current) return "";
    const { selectionStart: s, selectionEnd: e } = editorTextAreaRef.current;
    return (s !== e && s !== undefined && e !== undefined) ? noteContent.substring(s, e) : "";
  })();

  const originalContent = noteContent;
  let accumulated = "";

  try {
    const resp = await fetch(`${CREWAI_URL}/format/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vault_path: vaultPath,
        note_path: selectedNote.path,
        selected_template: selectedTemplate,
        selected_text: textToFormat,
        format_mode: mode,
      }),
    });

    if (!resp.ok || !resp.body) throw new Error("Stream request failed");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        if (!event.startsWith("data: ")) continue;
        const payload = event.slice(6);
        if (payload === "[DONE]") break;
        if (payload.startsWith("[ERROR]")) {
          alert(`Format error: ${payload.slice(8)}`);
          break;
        }
        // Unescape newlines
        const chunk = payload.replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
        accumulated += chunk;

        // Progressively update the editor
        setNoteContent(
          textToFormat
            ? originalContent.replace(textToFormat, accumulated)
            : accumulated
        );
      }
    }

    setSelectedFormatText("");
  } catch (err) {
    console.error("Stream format error:", err);
    alert("Failed to stream format.");
    setNoteContent(originalContent); // restore on error
  } finally {
    setFormatting(false);
    setStreamingChip(null);
  }
};
```

**Step 3: Remove `handleFormatChat` function** (lines ~774–778) — it's no longer needed.

**Step 4: Replace the formatting overlay** — find and remove the block starting with `{/* Formatting overlay */}` (~line 1623–1634). Replace it with nothing (overlay is gone, streaming border on the editor handles state).

**Step 5: Add streaming border class to the editor wrapper**

Find the editor container div (the one wrapping the `<textarea>` and `.editorPreview`). Add the `editorStreaming` class conditionally:

```tsx
// Find the className that wraps the textarea (e.g. styles.editorContent or styles.editorWrap)
// Add: className={`${styles.editorWrap} ${formatting ? styles.editorStreaming : ""}`}
```

Find the exact class name by searching for the textarea in page.tsx and add the streaming class to its parent container.

**Step 6: Replace the format chat bar** — find the `{/* Format Chat Input */}` block (~line 1650–1713) and replace the entire `<form>` with the new chip toolbar:

```tsx
{/* Format Chip Toolbar */}
<div className={styles.formatBar}>
  {/* Feynman */}
  <button
    type="button"
    className={`${styles.formatChip} ${styles.formatChipFeynman} ${streamingChip === "feynman" ? styles.formatChipStreaming : ""}`}
    onClick={() => formatNote("feynman")}
    disabled={formatting || !selectedFormatText}
    title="Rewrite in plain student-friendly language (requires selection)"
    aria-label="Feynman: rewrite as simple explanation"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 3-2 5.5-4 7l-1 3H10l-1-3C7 14.5 5 12 5 9a7 7 0 0 1 7-7z"/><line x1="10" y1="22" x2="14" y2="22"/></svg>
    Feynman
  </button>

  {/* Flowchart */}
  <button
    type="button"
    className={`${styles.formatChip} ${styles.formatChipFlowchart} ${streamingChip === "flowchart" ? styles.formatChipStreaming : ""}`}
    onClick={() => formatNote("flowchart")}
    disabled={formatting || !selectedFormatText}
    title="Append a Mermaid flowchart (requires selection)"
    aria-label="Flowchart: append Mermaid diagram"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="4" rx="1"/><rect x="15" y="3" width="6" height="4" rx="1"/><rect x="9" y="17" width="6" height="4" rx="1"/><line x1="6" y1="7" x2="6" y2="19"/><line x1="18" y1="7" x2="18" y2="12"/><line x1="6" y1="19" x2="9" y2="19"/><line x1="15" y1="19" x2="18" y2="19"/><line x1="18" y1="12" x2="15" y2="19"/></svg>
    Flowchart
  </button>

  {/* List */}
  <button
    type="button"
    className={`${styles.formatChip} ${streamingChip === "list" ? styles.formatChipStreaming : ""}`}
    onClick={() => formatNote("list")}
    disabled={formatting}
    aria-label="Convert to list"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>
    List
  </button>

  {/* Table */}
  <button
    type="button"
    className={`${styles.formatChip} ${streamingChip === "table" ? styles.formatChipStreaming : ""}`}
    onClick={() => formatNote("table")}
    disabled={formatting}
    aria-label="Convert to table"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>
    Table
  </button>

  {/* Split */}
  <button
    type="button"
    className={`${styles.formatChip} ${streamingChip === "split" ? styles.formatChipStreaming : ""}`}
    onClick={() => formatNote("split")}
    disabled={formatting}
    aria-label="Split into shorter ideas"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M3 8h9"/><path d="M3 16h9"/><path d="M15 8h6"/><path d="M15 16h6"/></svg>
    Split
  </button>

  {/* Sections */}
  <button
    type="button"
    className={`${styles.formatChip} ${streamingChip === "sections" ? styles.formatChipStreaming : ""}`}
    onClick={() => formatNote("sections")}
    disabled={formatting}
    aria-label="Divide into sections with subtitles"
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
    Sections
  </button>

  <div className={styles.formatBarSpacer} />

  {/* Undo */}
  <button
    type="button"
    className={styles.formatUndoBtn}
    title="Undo last format"
    aria-label="Undo last format"
    disabled={noteHistory.length === 0 || formatting}
    onClick={() => {
      const newHistory = [...noteHistory];
      const prev = newHistory.pop();
      if (prev !== undefined) {
        setNoteContent(prev);
        setNoteHistory(newHistory);
      }
    }}
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 2.2-5.8"/></svg>
  </button>
</div>
```

**Step 7: Add Expand / Concise quick buttons inside the selection pill**

Find the selection pill block (`{selectedFormatText && ...}` around line 1636). Inside it, after the text preview `<div>`, add:

```tsx
<div className={styles.selectionQuickActions}>
  <button
    type="button"
    className={styles.selectionQuickBtn}
    onClick={() => formatNote("expand")}
    disabled={formatting}
    aria-label="Expand selected text"
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
    Expand
  </button>
  <button
    type="button"
    className={styles.selectionQuickBtn}
    onClick={() => formatNote("concise")}
    disabled={formatting}
    aria-label="Make selected text concise"
  >
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/></svg>
    Concise
  </button>
</div>
```

**Step 8: Verify dev server compiles**

```bash
cd obsidian-chat && npm run dev 2>&1 | grep -E "error|Error|ready|compiled" | head -10
```
Expected: `✓ Ready` or `compiled successfully` — no TypeScript errors.

**Step 9: Commit**

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: replace format select with chip toolbar and SSE streaming"
```

---

## Task 6: End-to-end manual test

**Step 1: Start the stack**

Double-click `start_uworld.bat` (or run both servers manually).

**Step 2: Test streaming — List chip**
1. Open a note in the editor
2. Click the **List** chip
3. Verify: amber glowing border appears on editor, chip shows pulsing dot
4. Verify: text updates progressively (not all at once)
5. Verify: overlay is gone (you can see the note throughout)

**Step 3: Test Feynman + Expand/Concise (selection required)**
1. Select a paragraph of text in the editor → "Targeting Selection" pill appears
2. Verify: **Expand** and **Concise** buttons appear inside the pill
3. Click **Feynman** chip → verify it's disabled before selection, enabled after
4. Click **Expand** → verify text grows with more detail
5. Click **Concise** → verify text shortens

**Step 4: Test Flowchart**
1. Select text describing a mechanism
2. Click **Flowchart** chip
3. Verify: original text preserved + ` ```mermaid ` block appended

**Step 5: Test Undo**
1. Apply any format
2. Click the undo button (⟲)
3. Verify: note reverts to pre-format state

**Step 6: Commit (if any fixes needed)**

```bash
git add -p
git commit -m "fix: address end-to-end format streaming issues"
```
