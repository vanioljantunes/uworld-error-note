# Flow Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a three-column "Flow" view (Questions | Note Editor | Anki) where all panels are visible simultaneously, tied to a single question ID.

**Architecture:** New `"flow"` ViewMode alongside existing tabs. A `FlowView.tsx` client component renders the three-column layout. It receives props from `page.tsx` (savedExtractions, userTemplates, vaultPath) and manages its own panel state internally. All API routes and AnkiConnect calls are reused as-is.

**Tech Stack:** Next.js 15, React 19, CSS Modules, AnkiConnect (browser-direct), OpenAI via `/api/generate` and `/api/create-card`

---

### Task 1: Add Flow CSS classes to page.module.css

**Files:**
- Modify: `gapstrike/src/app/page.module.css`

**Step 1: Add Flow CSS classes at the end of the file**

Append these classes to the bottom of `page.module.css`:

```css
/* ── Flow View ──────────────────────────────────────────── */

.flowContainer {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.flowIdBar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.flowIdBtn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.flowIdBtn:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.flowIdDropdown {
  position: relative;
}

.flowIdDropdownMenu {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 320px;
  max-height: 280px;
  overflow-y: auto;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  z-index: 100;
  padding: 4px;
}

.flowIdDropdownItem {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.1s;
}
.flowIdDropdownItem:hover {
  background: var(--bg-hover);
}

.flowIdDropdownTitle {
  font-weight: 500;
  margin-bottom: 2px;
}

.flowIdDropdownMeta {
  color: var(--text-muted);
  font-size: 11px;
}

.flowActiveId {
  text-align: center;
  padding: 4px 0;
}

.flowActiveIdLabel {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}

.flowActiveIdSub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.flowPanels {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.flowPanel {
  flex: 1;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.flowPanelWide {
  flex: 2;
}

.flowPanelHeader {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.flowPanelBody {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.flowEmpty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
  padding: 24px;
}

/* Questions panel */
.flowExtSummary {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text);
}

.flowExtField {
  margin-bottom: 12px;
}

.flowExtFieldLabel {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  margin-bottom: 4px;
}

.flowExtFieldValue {
  color: var(--text);
}

.flowGenerateBtn {
  width: 100%;
  padding: 10px 16px;
  margin-top: 16px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}
.flowGenerateBtn:hover {
  opacity: 0.9;
}
.flowGenerateBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.flowResultTag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-subtle);
  margin: 2px 4px 2px 0;
}

/* Note editor panel */
.flowNoteEditor {
  width: 100%;
  height: 100%;
  min-height: 200px;
  background: transparent;
  color: var(--text);
  border: none;
  resize: none;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.6;
  outline: none;
}

.flowNoteSaveRow {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.flowNoteSaveBtn {
  padding: 6px 16px;
  border-radius: 6px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.flowNoteSaveBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.flowNoteSaveMsg {
  font-size: 12px;
  color: var(--text-muted);
}

/* Anki panel */
.flowAnkiCard {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  margin-bottom: 8px;
  background: var(--bg-elevated);
  font-size: 12px;
  cursor: default;
}

.flowAnkiCardFront {
  color: var(--text);
  margin-bottom: 4px;
  line-height: 1.5;
}

.flowAnkiCardMeta {
  color: var(--text-muted);
  font-size: 11px;
}

.flowMakeCardBtn {
  width: 100%;
  padding: 10px 16px;
  margin-bottom: 12px;
  border-radius: 8px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.flowMakeCardBtn:hover {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.flowMakeCardBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.flowUploadInput {
  display: none;
}
```

**Step 2: Verify build**

Run: `cd gapstrike && npm run build`
Expected: Build succeeds (CSS is just added, no references yet)

**Step 3: Commit**

```bash
git add gapstrike/src/app/page.module.css
git commit -m "feat: add Flow view CSS classes"
```

---

### Task 2: Create FlowView.tsx component shell

**Files:**
- Create: `gapstrike/src/components/FlowView.tsx`

**Step 1: Create the component with all three panels**

Create `gapstrike/src/components/FlowView.tsx` with this content:

```tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "../app/page.module.css";

// ── Types (mirrored from page.tsx) ────────────────────────────────────────

interface SavedExtraction {
  id: string;
  questionId: string | null;
  title: string;
  extraction: any;
  savedAt: number;
}

interface AnkiCard {
  note_id: number;
  card_id: number;
  front: string;
  back: string;
  deck: string;
  tags: string[];
  field_names: string[];
  suspended: boolean;
}

interface Template {
  id: string;
  slug: string;
  category: string;
  title: string;
  content: string;
  updated_at: string;
}

interface NoteResultItem {
  action: string;
  file_path: string;
  error_pattern: string;
  tags: string[];
  note_content: string;
}

// ── AnkiConnect (browser-direct) ──────────────────────────────────────────

const ANKI_CONNECT_URL = "http://localhost:8765";

async function ankiConnect(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const resp = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });
  if (!resp.ok) throw new Error(`AnkiConnect HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || "";
}

// ── Props ─────────────────────────────────────────────────────────────────

interface FlowViewProps {
  savedExtractions: SavedExtraction[];
  userTemplates: Template[];
  vaultPath: string;
  onNewExtraction: (ext: SavedExtraction) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function FlowView({ savedExtractions, userTemplates, vaultPath, onNewExtraction }: FlowViewProps) {
  // ID selection
  const [activeExtraction, setActiveExtraction] = useState<SavedExtraction | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Note generation
  const [generating, setGenerating] = useState(false);
  const [noteResult, setNoteResult] = useState<NoteResultItem | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [notePath, setNotePath] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Anki
  const [ankiCards, setAnkiCards] = useState<AnkiCard[]>([]);
  const [ankiLoading, setAnkiLoading] = useState(false);
  const [ankiError, setAnkiError] = useState("");
  const [makingCard, setMakingCard] = useState(false);
  const [makeCardMsg, setMakeCardMsg] = useState("");

  // Upload
  const uploadRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);

  // ── Close dropdown on outside click ─────────────────────────────────────

  useEffect(() => {
    if (!dropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [dropdownOpen]);

  // ── Fetch Anki cards when extraction changes ────────────────────────────

  useEffect(() => {
    if (!activeExtraction) { setAnkiCards([]); setAnkiError(""); return; }
    const qId = activeExtraction.questionId || activeExtraction.extraction?.question_id;
    if (!qId) { setAnkiCards([]); return; }

    setAnkiLoading(true);
    setAnkiError("");
    (async () => {
      try {
        const cardIds = (await ankiConnect("findCards", { query: `tag:${qId}` })) as number[];
        if (!cardIds || cardIds.length === 0) { setAnkiCards([]); return; }
        const cardsInfo = (await ankiConnect("cardsInfo", { cards: cardIds.slice(-20).reverse() })) as any[];
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
        setAnkiCards(cards);
      } catch (err: any) {
        const msg = err?.message || "";
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("unreachable")) {
          setAnkiError("Anki is not running.");
        } else {
          setAnkiError(msg || "AnkiConnect error.");
        }
      } finally {
        setAnkiLoading(false);
      }
    })();
  }, [activeExtraction]);

  // Also check if a note already exists for this extraction
  useEffect(() => {
    if (!activeExtraction) { setNoteContent(""); setNotePath(""); setNoteResult(null); return; }
    const qId = activeExtraction.questionId || activeExtraction.extraction?.question_id;
    if (!qId) return;

    // Try to find an existing note with this question ID in the vault
    (async () => {
      try {
        const resp = await fetch("/api/list-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vaultPath }),
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const notes = data.notes || [];
        const match = notes.find((n: any) => (n.tags || []).includes(qId));
        if (match) {
          const readResp = await fetch("/api/read-note", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vaultPath, notePath: match.path }),
          });
          if (readResp.ok) {
            const readData = await readResp.json();
            setNoteContent(readData.content || "");
            setNotePath(match.path);
          }
        }
      } catch { /* ignore */ }
    })();
  }, [activeExtraction, vaultPath]);

  // ── Select extraction ───────────────────────────────────────────────────

  const selectExtraction = (ext: SavedExtraction) => {
    setActiveExtraction(ext);
    setDropdownOpen(false);
    setNoteResult(null);
    setNoteContent("");
    setNotePath("");
    setSaveMsg("");
    setMakeCardMsg("");
  };

  // ── Upload & extract ────────────────────────────────────────────────────

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setExtracting(true);
    try {
      // Convert to base64
      const images: string[] = [];
      for (const file of imageFiles) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        images.push(base64);
      }
      // Extract
      const resp = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      if (!resp.ok) throw new Error("Extraction failed");
      const data = await resp.json();
      const extracted = data.extraction || data;
      const newExt: SavedExtraction = {
        id: Date.now().toString(),
        questionId: extracted.question_id || null,
        title: extracted.educational_objective || extracted.question?.slice(0, 60) || "New Extraction",
        extraction: extracted,
        savedAt: Date.now(),
      };
      onNewExtraction(newExt);
      selectExtraction(newExt);
    } catch {
      /* ignore */
    } finally {
      setExtracting(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  // ── Generate note ───────────────────────────────────────────────────────

  const handleGenerateNote = async () => {
    if (!activeExtraction || generating) return;
    setGenerating(true);
    setSaveMsg("");
    setMakeCardMsg("");
    try {
      const template = userTemplates.find((t) => t.slug === "error_note_a")?.content || "";
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraction: activeExtraction.extraction,
          questions: [],
          answers: [],
          template,
        }),
      });
      if (!resp.ok) throw new Error("Generation failed");
      const result = await resp.json();
      const note = result.notes?.[0];
      if (note) {
        setNoteResult(note);
        setNoteContent(note.note_content || "");
        setNotePath(note.file_path || "");
        // Save note to vault
        await fetch("/api/save-note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vaultPath, notePath: note.file_path, content: note.note_content }),
        });
      }
    } catch {
      /* ignore */
    } finally {
      setGenerating(false);
    }
  };

  // ── Save note ───────────────────────────────────────────────────────────

  const handleSaveNote = async () => {
    if (!notePath || savingNote) return;
    setSavingNote(true);
    setSaveMsg("");
    try {
      const resp = await fetch("/api/save-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultPath, notePath, content: noteContent }),
      });
      if (resp.ok) setSaveMsg("Saved");
      else setSaveMsg("Save failed");
    } catch {
      setSaveMsg("Save failed");
    } finally {
      setSavingNote(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  // ── Make card ───────────────────────────────────────────────────────────

  const handleMakeCard = async () => {
    if (!noteContent || makingCard) return;
    setMakingCard(true);
    setMakeCardMsg("");
    try {
      const tpl = userTemplates.find((t) => t.category === "anki")?.content || "";
      const resp = await fetch("/api/create-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_content: noteContent, template: tpl }),
      });
      const data = await resp.json();
      if (data.success && data.front) {
        // Add to Anki
        await ankiConnect("addNote", {
          note: {
            deckName: "Default",
            modelName: "Cloze",
            fields: { Text: data.front, Extra: data.back || "" },
            tags: activeExtraction?.questionId ? [activeExtraction.questionId] : [],
            options: { allowDuplicate: false },
          },
        });
        setMakeCardMsg("Card added!");
        // Refresh Anki cards
        setActiveExtraction((prev) => prev ? { ...prev } : null); // trigger re-fetch
      } else {
        setMakeCardMsg(data.error || "Failed");
      }
    } catch (err: any) {
      setMakeCardMsg(err?.message || "Failed to create card.");
    } finally {
      setMakingCard(false);
      setTimeout(() => setMakeCardMsg(""), 4000);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const ext = activeExtraction?.extraction;
  const qId = activeExtraction?.questionId || ext?.question_id || null;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={styles.flowContainer}>
      {/* ID Bar */}
      <div className={styles.flowIdBar}>
        <div className={styles.flowIdDropdown} ref={dropdownRef}>
          <button className={styles.flowIdBtn} onClick={() => setDropdownOpen(!dropdownOpen)}>
            ▼ Choose from extractions
          </button>
          {dropdownOpen && (
            <div className={styles.flowIdDropdownMenu}>
              {savedExtractions.length === 0 ? (
                <div className={styles.flowIdDropdownItem} style={{ cursor: "default", color: "var(--text-muted)" }}>
                  No extractions yet
                </div>
              ) : (
                savedExtractions.map((e) => (
                  <button
                    key={e.id}
                    className={styles.flowIdDropdownItem}
                    onClick={() => selectExtraction(e)}
                  >
                    <div className={styles.flowIdDropdownTitle}>
                      {e.questionId ? `#${e.questionId}` : "?"} — {e.title}
                    </div>
                    <div className={styles.flowIdDropdownMeta}>
                      {new Date(e.savedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <button
          className={styles.flowIdBtn}
          onClick={() => uploadRef.current?.click()}
          disabled={extracting}
        >
          {extracting ? "Extracting…" : "Upload Screenshot"}
        </button>
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          multiple
          className={styles.flowUploadInput}
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {/* Active ID */}
      {activeExtraction && (
        <div className={styles.flowActiveId}>
          <div className={styles.flowActiveIdLabel}>
            {qId ? `#${qId}` : "Unknown ID"} — {activeExtraction.title}
          </div>
          <div className={styles.flowActiveIdSub}>
            {ext?.educational_objective?.slice(0, 120) || ""}
          </div>
        </div>
      )}

      {/* Three panels */}
      <div className={styles.flowPanels}>
        {/* ── Questions Panel ────────────────────────────────────────── */}
        <div className={styles.flowPanel}>
          <div className={styles.flowPanelHeader}>Questions</div>
          <div className={styles.flowPanelBody}>
            {!activeExtraction ? (
              <div className={styles.flowEmpty}>Select an extraction or upload a screenshot to begin</div>
            ) : (
              <div className={styles.flowExtSummary}>
                {ext?.question && (
                  <div className={styles.flowExtField}>
                    <div className={styles.flowExtFieldLabel}>Question</div>
                    <div className={styles.flowExtFieldValue}>{ext.question}</div>
                  </div>
                )}
                {ext?.choosed_alternative && (
                  <div className={styles.flowExtField}>
                    <div className={styles.flowExtFieldLabel}>Your Answer (Wrong)</div>
                    <div className={styles.flowExtFieldValue}>{ext.choosed_alternative}</div>
                  </div>
                )}
                {ext?.wrong_alternative && (
                  <div className={styles.flowExtField}>
                    <div className={styles.flowExtFieldLabel}>Correct Answer</div>
                    <div className={styles.flowExtFieldValue}>{ext.wrong_alternative}</div>
                  </div>
                )}
                {ext?.educational_objective && (
                  <div className={styles.flowExtField}>
                    <div className={styles.flowExtFieldLabel}>Educational Objective</div>
                    <div className={styles.flowExtFieldValue}>{ext.educational_objective}</div>
                  </div>
                )}

                {noteResult && (
                  <div className={styles.flowExtField}>
                    <div className={styles.flowExtFieldLabel}>Generated Note</div>
                    <div className={styles.flowExtFieldValue}>{noteResult.error_pattern}</div>
                    <div style={{ marginTop: 6 }}>
                      {noteResult.tags.map((t) => (
                        <span key={t} className={styles.flowResultTag}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  className={styles.flowGenerateBtn}
                  onClick={handleGenerateNote}
                  disabled={generating}
                >
                  {generating ? "Generating…" : noteResult ? "Regenerate Note" : "Generate Note"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Note Editor Panel ──────────────────────────────────────── */}
        <div className={`${styles.flowPanel} ${styles.flowPanelWide}`}>
          <div className={styles.flowPanelHeader}>Note Editor</div>
          {noteContent ? (
            <>
              <div className={styles.flowPanelBody}>
                <textarea
                  className={styles.flowNoteEditor}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className={styles.flowNoteSaveRow}>
                {saveMsg && <span className={styles.flowNoteSaveMsg}>{saveMsg}</span>}
                <button
                  className={styles.flowNoteSaveBtn}
                  onClick={handleSaveNote}
                  disabled={savingNote}
                >
                  {savingNote ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          ) : (
            <div className={styles.flowPanelBody}>
              <div className={styles.flowEmpty}>
                {activeExtraction
                  ? "Click \"Generate Note\" to create an error note"
                  : "Select an extraction to get started"}
              </div>
            </div>
          )}
        </div>

        {/* ── Anki Panel ─────────────────────────────────────────────── */}
        <div className={styles.flowPanel}>
          <div className={styles.flowPanelHeader}>Anki</div>
          <div className={styles.flowPanelBody}>
            {!activeExtraction ? (
              <div className={styles.flowEmpty}>Select an extraction to see matching cards</div>
            ) : (
              <>
                <button
                  className={styles.flowMakeCardBtn}
                  onClick={handleMakeCard}
                  disabled={makingCard || !noteContent}
                >
                  {makingCard ? "Creating…" : "+ Make Card"}
                </button>
                {makeCardMsg && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textAlign: "center" }}>
                    {makeCardMsg}
                  </div>
                )}

                {ankiLoading ? (
                  <div className={styles.flowEmpty}>Searching Anki…</div>
                ) : ankiError ? (
                  <div className={styles.flowEmpty}>{ankiError}</div>
                ) : ankiCards.length === 0 ? (
                  <div className={styles.flowEmpty}>No cards found for #{qId}</div>
                ) : (
                  ankiCards.map((card) => (
                    <div key={card.card_id} className={styles.flowAnkiCard}>
                      <div
                        className={styles.flowAnkiCardFront}
                        dangerouslySetInnerHTML={{ __html: stripHtml(card.front).slice(0, 120) + (card.front.length > 120 ? "…" : "") }}
                      />
                      <div className={styles.flowAnkiCardMeta}>
                        {card.deck} · {card.tags.join(", ")}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `cd gapstrike && npm run build`
Expected: Build succeeds (component exists but isn't imported yet)

**Step 3: Commit**

```bash
git add gapstrike/src/components/FlowView.tsx
git commit -m "feat: add FlowView component with three-panel layout"
```

---

### Task 3: Wire FlowView into page.tsx

**Files:**
- Modify: `gapstrike/src/app/page.tsx`

**Step 1: Add "flow" to ViewMode type**

At line 7, change:
```typescript
type ViewMode = "chat" | "editor" | "anki" | "templates";
```
to:
```typescript
type ViewMode = "flow" | "chat" | "editor" | "anki" | "templates";
```

**Step 2: Add FlowView import**

Near the existing `import TemplatesView` line (approximately line 3-5), add:
```typescript
import FlowView from "../components/FlowView";
```

**Step 3: Add onNewExtraction handler**

Inside the `Home` component (after the existing `savedExtractions` state and localStorage loading), add a handler function. Find the `setSavedExtractions` pattern used in `runFullWorkflow` (around line 777) and add nearby:

```typescript
const handleFlowNewExtraction = (ext: SavedExtraction) => {
  setSavedExtractions((prev) => {
    const updated = [ext, ...prev];
    localStorage.setItem("savedExtractions", JSON.stringify(updated));
    return updated;
  });
};
```

**Step 4: Add Flow tab to navbar**

Find the navbar `<div className={styles.navTabs}>` section (around line 1456). Add a Flow button as the **first** tab, before the Chat button:

```tsx
<button
  className={`${styles.navTab} ${viewMode === "flow" ? styles.navTabActive : ""}`}
  onClick={() => setViewMode("flow")}
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
  Flow
</button>
```

**Step 5: Add FlowView to content switch**

Find where the content rendering switches on `viewMode`. The main content area is inside `<div className={styles.container}>`. Currently the structure is:

```tsx
{viewMode === "chat" && ( ... sidebar + chatContainer ... )}
```

Before the `viewMode === "chat"` conditional, add:

```tsx
{viewMode === "flow" ? (
  <FlowView
    savedExtractions={savedExtractions}
    userTemplates={userTemplates}
    vaultPath={vaultPath}
    onNewExtraction={handleFlowNewExtraction}
  />
) : viewMode === "chat" ? (
```

This means Flow view renders *instead of* the sidebar + main content area (it has its own layout).

**Important:** The existing ternary chain currently starts with `viewMode === "chat" && (`. You need to restructure it so Flow comes first. The pattern is:

```tsx
{viewMode === "flow" ? (
  <FlowView ... />
) : (
  <>
    <div className={styles.sidebar}>
      {/* existing sidebar code */}
    </div>
    {viewMode === "chat" ? (
      /* existing chat content */
    ) : viewMode === "editor" ? (
      /* existing editor content */
    ) : viewMode === "templates" ? (
      /* existing templates content */
    ) : (
      /* existing anki content */
    )}
    {/* existing right panel / sourcesPanel */}
  </>
)}
```

**Step 6: Set default viewMode to "flow"**

At line 183, change:
```typescript
const [viewMode, setViewMode] = useState<ViewMode>("chat");
```
to:
```typescript
const [viewMode, setViewMode] = useState<ViewMode>("flow");
```

**Step 7: Verify build**

Run: `cd gapstrike && npm run build`
Expected: Build succeeds with no type errors

**Step 8: Commit**

```bash
git add gapstrike/src/app/page.tsx
git commit -m "feat: wire FlowView into page with navbar tab and content switch"
```

---

### Task 4: Build, deploy, and verify

**Files:**
- No file changes — build & deploy only

**Step 1: Full build**

Run: `cd gapstrike && npm run build`
Expected: Build succeeds with all routes listed including `/api/create-card` and `/api/format-card`

**Step 2: Deploy to Vercel**

Run: `cd gapstrike && npx vercel --prod`
Expected: Deployment succeeds, aliased to `gapstrike-app.vercel.app`

**Step 3: Report for review**

Report what was built:
- Flow tab in navbar (first position)
- Three-column layout with centered container
- ID bar with extraction dropdown + upload button
- Centered active ID label
- Questions panel showing extraction summary + Generate Note button
- Note Editor panel with editable textarea + Save button
- Anki panel with card search + Make Card button
