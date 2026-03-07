# Navbar & Flow Page Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the navbar as minimal flat tabs with accent underline, and build the Flow page with a 3-panel adaptive layout that expands the focused panel.

**Architecture:** CSS-first approach. Navbar is a pure CSS restyle (no structural changes). Flow page adds a new `"flow"` ViewMode with state for panel focus and extraction selection. Reuses existing API routes and `savedExtractions` state.

**Tech Stack:** Next.js 14, React, CSS Modules

**Design doc:** `docs/plans/2026-03-03-navbar-flow-redesign-design.md`

---

### Task 1: Restyle Navbar CSS — Flat Tabs with Accent Underline

**Files:**
- Modify: `obsidian-chat/src/app/page.module.css:29-67` (`.navTabs`, `.navTab`, `.navTabActive`)

**Step 1: Replace `.navTabs` pill container with transparent flex**

In `page.module.css`, replace lines 29-35 (`.navTabs` class):

```css
/* OLD — remove pill container background */
.navTabs {
  display: flex;
  gap: 2px;
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 3px;
}
```

Replace with:

```css
.navTabs {
  display: flex;
  gap: 4px;
  background: transparent;
  padding: 0;
}
```

**Step 2: Restyle `.navTab` for flat appearance with underline support**

Replace lines 37-56 (`.navTab` and `:hover`):

```css
.navTab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 0;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #888;
  background: transparent;
  transition: color 200ms cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
  text-decoration: none;
  position: relative;
}

.navTab::after {
  content: '';
  position: absolute;
  bottom: -14px;
  left: 8px;
  right: 8px;
  height: 2px;
  background: var(--accent);
  border-radius: 1px;
  opacity: 0;
  transform: scaleX(0.5);
  transition: opacity 200ms cubic-bezier(0.16, 1, 0.3, 1),
              transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.navTab:hover {
  color: var(--text);
}
```

**Step 3: Replace `.navTabActive` pill fill with underline activation**

Replace lines 63-67:

```css
.navTabActive {
  color: white;
}

.navTabActive::after {
  opacity: 1;
  transform: scaleX(1);
}
```

**Step 4: Visual check**

Run: `cd obsidian-chat && npm run dev`

Open in browser. Verify:
- Tabs are flat text with no pill background
- Active tab text is white with a 2px accent underline
- Hover transitions color smoothly
- Underline appears with a scale+fade animation

**Step 5: Commit**

```bash
git add obsidian-chat/src/app/page.module.css
git commit -m "style: restyle navbar to flat tabs with accent underline"
```

---

### Task 2: Add Flow Tab to Navbar JSX

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx:7` (ViewMode type)
- Modify: `obsidian-chat/src/app/page.tsx:1479-1512` (navbar tabs JSX)

**Step 1: Add `"flow"` to ViewMode type**

At line 7, change:

```ts
type ViewMode = "chat" | "editor" | "anki" | "templates";
```

To:

```ts
type ViewMode = "flow" | "chat" | "editor" | "anki" | "templates";
```

**Step 2: Add Flow tab button as first tab**

At line 1479 (inside `.navTabs` div), insert a new Flow button as the first child, before the Chat button:

```tsx
<button
  className={`${styles.navTab} ${viewMode === "flow" ? styles.navTabActive : ""}`}
  onClick={() => setViewMode("flow")}
>
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
  Flow
</button>
```

**Step 3: Verify tab appears and switches viewMode**

Run the dev server. Click "Flow" tab — it should highlight with accent underline. Other tabs still work.

**Step 4: Commit**

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: add Flow tab to navbar"
```

---

### Task 3: Flow Page CSS — ID Bar and 3-Panel Adaptive Layout

**Files:**
- Modify: `obsidian-chat/src/app/page.module.css` (append at end, before line 3552)

**Step 1: Add Flow container and ID bar styles**

Append to the end of `page.module.css`:

```css
/* ── Flow View ── */

.flowContainer {
  display: flex;
  flex-direction: column;
  flex: 1;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 32px;
  width: 100%;
  min-height: 0;
}

.flowIdBar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.flowIdBtn {
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  padding: 8px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

.flowIdBtn:hover {
  border-color: var(--accent);
  color: white;
}

.flowIdBtnAccent {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.flowIdBtnAccent:hover {
  opacity: 0.9;
}

.flowActiveId {
  flex: 1;
  text-align: center;
  min-width: 0;
}

.flowActiveIdTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.flowActiveIdSub {
  font-size: 12px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

/* ID Bar dropdown */
.flowIdDropdown {
  position: relative;
}

.flowIdDropdownMenu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 280px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 50;
  padding: 4px;
}

.flowIdDropdownItem {
  display: block;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 6px;
  transition: background 150ms;
}

.flowIdDropdownItem:hover {
  background: var(--bg-hover);
}

.flowIdDropdownItemSub {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}
```

**Step 2: Add 3-panel adaptive layout styles**

Continue appending:

```css
/* Flow Panels */
.flowPanels {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
  padding: 16px 0;
}

.flowPanel {
  flex: 1 1 33.3%;
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  min-width: 0;
  transition: flex-basis 400ms cubic-bezier(0.16, 1, 0.3, 1);
}

.flowPanelFocused {
  flex: 1 1 60%;
}

.flowPanelShrunk {
  flex: 1 1 20%;
}

.flowPanelHeader {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.flowPanelBody {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

/* Flow panel content */
.flowEmpty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  font-size: 13px;
  text-align: center;
  padding: 32px;
}

.flowExtSummary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flowExtField {
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
}

.flowExtFieldLabel {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #888;
  margin-bottom: 4px;
}

.flowGenerateBtn {
  width: 100%;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: white;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 200ms;
  margin-top: 8px;
}

.flowGenerateBtn:hover {
  opacity: 0.9;
}

.flowGenerateBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.flowNoteEditor {
  width: 100%;
  height: 100%;
  min-height: 300px;
  padding: 16px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.flowSaveBtn {
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  transition: all 150ms;
}

.flowSaveBtn:hover {
  border-color: var(--accent);
}

.flowMakeCardBtn {
  width: 100%;
  padding: 8px 16px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 200ms;
  margin-bottom: 12px;
}

.flowMakeCardBtn:hover {
  border-color: var(--accent);
  background: rgba(94, 106, 210, 0.1);
}

.flowAnkiCard {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 8px;
  transition: border-color 150ms;
}

.flowAnkiCard:hover {
  border-color: var(--accent);
}

.flowAnkiCardFront {
  font-size: 13px;
  color: var(--text);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.flowAnkiCardMeta {
  font-size: 11px;
  color: #666;
  margin-top: 4px;
}

.flowTagBadge {
  display: inline-block;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(94, 106, 210, 0.15);
  color: var(--accent);
  margin-right: 4px;
  margin-top: 4px;
}

.flowPatternLabel {
  font-size: 13px;
  font-weight: 600;
  color: #22c55e;
  margin-top: 12px;
  margin-bottom: 4px;
}
```

**Step 3: Commit**

```bash
git add obsidian-chat/src/app/page.module.css
git commit -m "style: add Flow page CSS — ID bar, adaptive 3-panel layout"
```

---

### Task 4: Flow Page Component — State and JSX

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx` — add state variables and Flow view JSX

**Step 1: Add flow-specific state variables**

After the existing state declarations (around line 263 where `savedExtractions` is), add:

```ts
const [activeFlowExtraction, setActiveFlowExtraction] = useState<SavedExtraction | null>(null);
const [focusedPanel, setFocusedPanel] = useState<"questions" | "editor" | "anki" | null>(null);
const [flowNoteContent, setFlowNoteContent] = useState("");
const [flowNotePath, setFlowNotePath] = useState("");
const [flowAnkiCards, setFlowAnkiCards] = useState<AnkiCard[]>([]);
const [flowGenerating, setFlowGenerating] = useState(false);
const [flowSavingNote, setFlowSavingNote] = useState(false);
const [flowMakingCard, setFlowMakingCard] = useState(false);
const [showFlowIdDropdown, setShowFlowIdDropdown] = useState(false);
const [flowErrorPattern, setFlowErrorPattern] = useState<string>("");
const [flowTags, setFlowTags] = useState<string[]>([]);
```

**Step 2: Add Flow view rendering in the main container**

Find where the existing view modes are rendered (after `{viewMode === "templates" && ...}`). Add the Flow view conditional block:

```tsx
{viewMode === "flow" && (
  <div className={styles.flowContainer}>
    {/* ID Bar */}
    <div className={styles.flowIdBar}>
      <div className={styles.flowIdDropdown}>
        <button
          className={styles.flowIdBtn}
          onClick={() => setShowFlowIdDropdown(!showFlowIdDropdown)}
        >
          ▼ {activeFlowExtraction ? "Change extraction" : "Choose extraction"}
        </button>
        {showFlowIdDropdown && (
          <div className={styles.flowIdDropdownMenu}>
            {savedExtractions.map((ext) => (
              <button
                key={ext.id}
                className={styles.flowIdDropdownItem}
                onClick={() => {
                  setActiveFlowExtraction(ext);
                  setShowFlowIdDropdown(false);
                  setFlowNoteContent("");
                  setFlowNotePath("");
                  setFlowErrorPattern("");
                  setFlowTags([]);
                }}
              >
                {ext.questionId ? `#${ext.questionId}` : ext.id.slice(0, 8)} — {ext.title}
                {ext.extraction?.educational_objective && (
                  <div className={styles.flowIdDropdownItemSub}>
                    {ext.extraction.educational_objective}
                  </div>
                )}
              </button>
            ))}
            {savedExtractions.length === 0 && (
              <div className={styles.flowIdDropdownItem} style={{ color: "#666", cursor: "default" }}>
                No extractions yet
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.flowActiveId}>
        {activeFlowExtraction ? (
          <>
            <div className={styles.flowActiveIdTitle}>
              {activeFlowExtraction.questionId ? `#${activeFlowExtraction.questionId}` : activeFlowExtraction.id.slice(0, 8)} — {activeFlowExtraction.title}
            </div>
            {activeFlowExtraction.extraction?.educational_objective && (
              <div className={styles.flowActiveIdSub}>
                {activeFlowExtraction.extraction.educational_objective}
              </div>
            )}
          </>
        ) : (
          <div className={styles.flowActiveIdSub}>Select an extraction to begin</div>
        )}
      </div>

      <label className={`${styles.flowIdBtn} ${styles.flowIdBtnAccent}`} style={{ cursor: "pointer" }}>
        Upload
        <input
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={async (e) => {
            const files = e.target.files;
            if (!files || files.length === 0) return;
            // Reuse existing extraction logic
            const base64Arr: string[] = [];
            for (const f of Array.from(files)) {
              const reader = new FileReader();
              const b64: string = await new Promise((res) => {
                reader.onload = () => res(reader.result as string);
                reader.readAsDataURL(f);
              });
              base64Arr.push(b64.split(",")[1]);
            }
            try {
              const resp = await fetch("/api/extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ images: base64Arr }),
              });
              const data = await resp.json();
              if (data.extraction) {
                const newExt: SavedExtraction = {
                  id: Date.now().toString(),
                  questionId: data.extraction.question_id || null,
                  title: data.extraction.question_id
                    ? `Q${data.extraction.question_id}`
                    : data.extraction.educational_objective?.slice(0, 40) || "Extraction",
                  extraction: data.extraction,
                  savedAt: Date.now(),
                };
                setSavedExtractions((prev) => [newExt, ...prev]);
                setActiveFlowExtraction(newExt);
                setFlowNoteContent("");
                setFlowNotePath("");
              }
            } catch (err) {
              console.error("Extract failed:", err);
            }
            e.target.value = "";
          }}
        />
      </label>
    </div>

    {/* 3-Panel Layout */}
    <div className={styles.flowPanels}>
      {/* Questions Panel */}
      <div
        className={`${styles.flowPanel} ${focusedPanel === "questions" ? styles.flowPanelFocused : focusedPanel ? styles.flowPanelShrunk : ""}`}
        onClick={() => setFocusedPanel(focusedPanel === "questions" ? null : "questions")}
      >
        <div className={styles.flowPanelHeader}>Questions</div>
        <div className={styles.flowPanelBody}>
          {activeFlowExtraction ? (
            <div className={styles.flowExtSummary}>
              {activeFlowExtraction.extraction?.question_stem && (
                <div className={styles.flowExtField}>
                  <div className={styles.flowExtFieldLabel}>Question</div>
                  {activeFlowExtraction.extraction.question_stem}
                </div>
              )}
              {activeFlowExtraction.extraction?.student_answer && (
                <div className={styles.flowExtField}>
                  <div className={styles.flowExtFieldLabel}>Your Answer (Wrong)</div>
                  {activeFlowExtraction.extraction.student_answer}
                </div>
              )}
              {activeFlowExtraction.extraction?.correct_answer && (
                <div className={styles.flowExtField}>
                  <div className={styles.flowExtFieldLabel}>Correct Answer</div>
                  {activeFlowExtraction.extraction.correct_answer}
                </div>
              )}
              {activeFlowExtraction.extraction?.educational_objective && (
                <div className={styles.flowExtField}>
                  <div className={styles.flowExtFieldLabel}>Educational Objective</div>
                  {activeFlowExtraction.extraction.educational_objective}
                </div>
              )}
              <button
                className={styles.flowGenerateBtn}
                disabled={flowGenerating}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!activeFlowExtraction) return;
                  setFlowGenerating(true);
                  try {
                    const resp = await fetch("/api/generate", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        extraction: activeFlowExtraction.extraction,
                        vault_path: vaultPath,
                      }),
                    });
                    const data = await resp.json();
                    if (data.notes && data.notes.length > 0) {
                      const note = data.notes[0];
                      setFlowNoteContent(note.note_content || "");
                      setFlowNotePath(note.file_path || "");
                      setFlowErrorPattern(note.error_pattern || "");
                      setFlowTags(note.tags || []);
                      setFocusedPanel("editor");
                    }
                  } catch (err) {
                    console.error("Generate failed:", err);
                  } finally {
                    setFlowGenerating(false);
                  }
                }}
              >
                {flowGenerating ? "Generating..." : "Generate Note"}
              </button>

              {flowErrorPattern && (
                <>
                  <div className={styles.flowPatternLabel}>{flowErrorPattern}</div>
                  <div>
                    {flowTags.map((t) => (
                      <span key={t} className={styles.flowTagBadge}>{t}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className={styles.flowEmpty}>Select an extraction to see question details</div>
          )}
        </div>
      </div>

      {/* Note Editor Panel */}
      <div
        className={`${styles.flowPanel} ${focusedPanel === "editor" ? styles.flowPanelFocused : focusedPanel ? styles.flowPanelShrunk : ""}`}
        onClick={() => setFocusedPanel(focusedPanel === "editor" ? null : "editor")}
      >
        <div className={styles.flowPanelHeader}>
          Note Editor
          {flowNotePath && (
            <button
              className={styles.flowSaveBtn}
              disabled={flowSavingNote}
              onClick={async (e) => {
                e.stopPropagation();
                if (!flowNotePath) return;
                setFlowSavingNote(true);
                try {
                  await fetch("/api/save-note", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      path: flowNotePath,
                      content: flowNoteContent,
                      vault_path: vaultPath,
                    }),
                  });
                } catch (err) {
                  console.error("Save failed:", err);
                } finally {
                  setFlowSavingNote(false);
                }
              }}
            >
              {flowSavingNote ? "Saving..." : "Save"}
            </button>
          )}
        </div>
        <div className={styles.flowPanelBody} style={{ padding: 0 }}>
          {flowNoteContent ? (
            <textarea
              className={styles.flowNoteEditor}
              value={flowNoteContent}
              onChange={(e) => setFlowNoteContent(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className={styles.flowEmpty}>
              {activeFlowExtraction
                ? "Click \"Generate Note\" to create a note"
                : "Select an extraction and generate a note"}
            </div>
          )}
        </div>
      </div>

      {/* Anki Panel */}
      <div
        className={`${styles.flowPanel} ${focusedPanel === "anki" ? styles.flowPanelFocused : focusedPanel ? styles.flowPanelShrunk : ""}`}
        onClick={() => setFocusedPanel(focusedPanel === "anki" ? null : "anki")}
      >
        <div className={styles.flowPanelHeader}>Anki</div>
        <div className={styles.flowPanelBody}>
          <button
            className={styles.flowMakeCardBtn}
            disabled={!flowNoteContent || flowMakingCard}
            onClick={async (e) => {
              e.stopPropagation();
              if (!flowNoteContent) return;
              setFlowMakingCard(true);
              try {
                const resp = await fetch("/api/create-card", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    note_content: flowNoteContent,
                    vault_path: vaultPath,
                  }),
                });
                const data = await resp.json();
                if (data.success) {
                  // Refresh Anki cards
                  await refreshFlowAnkiCards();
                }
              } catch (err) {
                console.error("Make card failed:", err);
              } finally {
                setFlowMakingCard(false);
              }
            }}
          >
            {flowMakingCard ? "Creating..." : "+ Make Card"}
          </button>

          {flowAnkiCards.length > 0 ? (
            flowAnkiCards.map((card) => (
              <div key={card.card_id} className={styles.flowAnkiCard}>
                <div
                  className={styles.flowAnkiCardFront}
                  dangerouslySetInnerHTML={{ __html: card.front }}
                />
                <div className={styles.flowAnkiCardMeta}>
                  {card.deck} · {card.tags.join(", ")}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.flowEmpty}>
              {activeFlowExtraction
                ? "No Anki cards found for this extraction"
                : "Select an extraction to see cards"}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
)}
```

**Step 3: Verify the Flow view renders**

Run dev server. Click "Flow" tab. Verify:
- ID bar shows with dropdown and upload button
- Three panels render side by side at equal width
- Clicking a panel expands it smoothly, others shrink
- Clicking same panel again resets to equal widths

**Step 4: Commit**

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: add Flow view with 3-panel adaptive layout and ID bar"
```

---

### Task 5: Wire Flow Page to APIs — Generate, Save, Anki Refresh

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx` — add `refreshFlowAnkiCards` function and auto-refresh on extraction change

**Step 1: Add `refreshFlowAnkiCards` helper function**

Place this near other handler functions in page.tsx (around the area where `ankiConnect` helper is used):

```ts
const refreshFlowAnkiCards = useCallback(async () => {
  if (!activeFlowExtraction) {
    setFlowAnkiCards([]);
    return;
  }
  const qid = activeFlowExtraction.questionId || activeFlowExtraction.id;
  try {
    const cardIds = await ankiConnect("findCards", { query: `tag:${qid}` });
    if (cardIds && cardIds.length > 0) {
      const cardsInfo = await ankiConnect("cardsInfo", { cards: cardIds });
      setFlowAnkiCards(
        (cardsInfo || []).map((c: any) => ({
          note_id: c.note,
          card_id: c.cardId,
          front: c.fields?.Front?.value || c.fields?.[Object.keys(c.fields)[0]]?.value || "",
          back: c.fields?.Back?.value || c.fields?.[Object.keys(c.fields)[1]]?.value || "",
          deck: c.deckName || "",
          tags: c.tags || [],
          field_names: Object.keys(c.fields || {}),
          suspended: c.suspended || false,
        }))
      );
    } else {
      setFlowAnkiCards([]);
    }
  } catch {
    setFlowAnkiCards([]);
  }
}, [activeFlowExtraction]);
```

**Step 2: Add useEffect to refresh Anki cards when extraction changes**

```ts
useEffect(() => {
  if (viewMode === "flow") {
    refreshFlowAnkiCards();
  }
}, [activeFlowExtraction, viewMode]);
```

**Step 3: Add useEffect to close ID dropdown on outside click**

```ts
useEffect(() => {
  if (!showFlowIdDropdown) return;
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(`.${styles.flowIdDropdown}`)) {
      setShowFlowIdDropdown(false);
    }
  };
  document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}, [showFlowIdDropdown]);
```

**Step 4: End-to-end test**

1. Open Flow tab
2. Upload a screenshot → extraction appears in dropdown
3. Select extraction → Questions panel fills with data
4. Click "Generate Note" → note appears in editor, panel auto-focuses
5. Edit note → click "Save"
6. Click "Make Card" → Anki panel refreshes with new card

**Step 5: Commit**

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: wire Flow page to generate, save, and AnkiConnect APIs"
```

---

### Task 6: Hide Sidebar/Activity Panel in Flow View

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx` — conditionally hide sidebar when in flow mode

**Step 1: Wrap the sidebar and main container rendering**

Find the `.container` div that holds the sidebar (around line 1524). The Flow view should render **outside** this container, replacing it entirely.

The structure should be:

```tsx
{viewMode === "flow" ? (
  /* Flow container JSX (already added in Task 4) */
) : (
  <div className={styles.container}>
    {/* Existing sidebar + main content */}
  </div>
)}
```

Move the Flow view JSX from inside `styles.container` to this conditional. The Flow view renders instead of the sidebar layout, not alongside it.

**Step 2: Verify**

- Flow tab: full-width 3-panel layout, no sidebar
- Other tabs: sidebar + main content as before

**Step 3: Commit**

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: Flow view replaces sidebar layout with full-width panels"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Navbar CSS — flat tabs + underline | `page.module.css` |
| 2 | Flow tab in navbar JSX | `page.tsx` |
| 3 | Flow page CSS — ID bar + panels | `page.module.css` |
| 4 | Flow page component — state + JSX | `page.tsx` |
| 5 | Wire APIs — generate, save, Anki | `page.tsx` |
| 6 | Hide sidebar in Flow view | `page.tsx` |
