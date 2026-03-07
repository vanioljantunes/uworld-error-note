# Top Nav Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the left sidebar with a horizontal top nav bar containing Chat/Editor/Anki tabs, tag filter chips, and a Dashboard link. Move contextual panels (note list, chat sessions, anki search) inline within their respective content areas.

**Architecture:** Remove the 3-column flex layout (sidebar | content | activity). Replace with CSS Grid: top nav spanning full width, then content + activity panel below. Each view (chat, editor, anki) handles its own inline panels.

**Tech Stack:** React (page.tsx), CSS Modules (page.module.css), Next.js App Router

---

### Task 1: Add CSS for Top Nav Bar and New Grid Layout

**Files:**
- Modify: `gapstrike/src/app/page.module.css`

**Step 1: Replace `.container` with CSS Grid layout**

Find the existing `.container` class (~line 1) and replace:

```css
.container {
  display: grid;
  grid-template-rows: 52px 1fr;
  grid-template-columns: 1fr 272px;
  height: 100vh;
  background: var(--bg);
  color: var(--text);
}
```

**Step 2: Add `.topNav` class after `.container`**

```css
.topNav {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
  gap: 4px;
  overflow: hidden;
}

.topNavLogo {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-right: 12px;
  flex-shrink: 0;
}

.topNavTabs {
  display: flex;
  gap: 2px;
  background: var(--bg-elevated);
  border-radius: 8px;
  padding: 3px;
  flex-shrink: 0;
}

.topNavTab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #888;
  background: transparent;
  transition: all 0.2s;
  font-family: inherit;
}

.topNavTab:hover {
  color: #ccc;
}

.topNavTabActive {
  background: var(--accent);
  color: white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.topNavSpacer {
  width: 1px;
  height: 24px;
  background: var(--border);
  margin: 0 10px;
  flex-shrink: 0;
}

.topNavTags {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 2px 0;
}

.topNavTags::-webkit-scrollbar {
  display: none;
}

.topNavTag {
  padding: 2px 10px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-subtle);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
  font-family: inherit;
}

.topNavTag:hover {
  border-color: #7c3aed;
  color: #a78bfa;
}

.topNavTagActive {
  border-color: #7c3aed;
  background: rgba(124, 58, 237, 0.15);
  color: #a78bfa;
}

.topNavDashboard {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: #888;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  flex-shrink: 0;
  margin-left: 10px;
  font-family: inherit;
}

.topNavDashboard:hover {
  color: #ccc;
  border-color: var(--border-hover);
  background: var(--bg-elevated);
}
```

**Step 3: Add inline panel CSS for editor note list**

```css
.editorInlinePanel {
  width: 240px;
  border-right: 1px solid var(--border);
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
  padding: 12px;
  gap: 8px;
}
```

**Step 4: Add inline panel CSS for chat session list**

```css
.chatInlinePanel {
  width: 220px;
  border-right: 1px solid var(--border);
  background: var(--bg-surface);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  flex-shrink: 0;
  padding: 0;
}
```

**Step 5: Commit**

```bash
git add gapstrike/src/app/page.module.css
git commit -m "feat: add top nav bar and inline panel CSS classes"
```

---

### Task 2: Remove Left Sidebar and Dead State from page.tsx

**Files:**
- Modify: `gapstrike/src/app/page.tsx`

**Step 1: Remove dead state variables**

Delete lines 170-171:
```typescript
const [showPathSettings, setShowPathSettings] = useState(false);
const [tempPath, setTempPath] = useState(vaultPath);
```

**Step 2: Remove `handleSavePath` function**

Delete lines 1238-1244 (the `handleSavePath` function).

**Step 3: Remove the entire sidebar JSX block**

Delete lines 1358-1529 — the entire `<div className={styles.sidebar}>...</div>` block. This removes:
- `sidebarHeader` (logo + name)
- `viewToggle` (Chat/Editor/Anki tabs)
- `viewToggleDivider`
- `pathSection` (vault path settings)
- Chat sidebar (session list, reset button)
- Editor sidebar (note list)
- Anki sidebar (search form, hints)

**Step 4: Commit**

```bash
git add gapstrike/src/app/page.tsx
git commit -m "refactor: remove left sidebar and dead vault path state"
```

---

### Task 3: Add Top Nav Bar JSX

**Files:**
- Modify: `gapstrike/src/app/page.tsx`

**Step 1: Add top nav bar as first child of `.container`**

Insert immediately after `<div className={styles.container}>` (was line ~1356):

```jsx
{/* ── Top Nav Bar ── */}
<nav className={styles.topNav}>
  {/* Logo */}
  <div className={styles.topNavLogo}>
    <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#0d0618"/>
      <defs>
        <linearGradient id="navBolt" x1="0.4" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#d8b4fe"/>
          <stop offset="50%" stopColor="#a855f7"/>
          <stop offset="100%" stopColor="#6d28d9"/>
        </linearGradient>
      </defs>
      <line x1="2" y1="17" x2="6" y2="17" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round"/>
      <line x1="25" y1="17" x2="30" y2="17" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round"/>
      <polygon points="18,2 7,17 14,17 12,30 23,17 16,17" fill="url(#navBolt)"/>
    </svg>
    <span className={styles.sidebarAppName}>GapStrike</span>
  </div>

  {/* View Tabs */}
  <div className={styles.topNavTabs}>
    <button
      className={`${styles.topNavTab} ${viewMode === "chat" ? styles.topNavTabActive : ""}`}
      onClick={() => setViewMode("chat")}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      Chat
    </button>
    <button
      className={`${styles.topNavTab} ${viewMode === "editor" ? styles.topNavTabActive : ""}`}
      onClick={() => setViewMode("editor")}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
      Editor
    </button>
    <button
      className={`${styles.topNavTab} ${viewMode === "anki" ? styles.topNavTabActive : ""}`}
      onClick={() => setViewMode("anki")}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
      Anki
    </button>
  </div>

  {/* Divider */}
  <div className={styles.topNavSpacer} />

  {/* Tag Chips */}
  <div className={styles.topNavTags}>
    {allNotesTags.map((tag) => (
      <button
        key={tag}
        className={`${styles.topNavTag} ${tagFilter === tag ? styles.topNavTagActive : ""}`}
        onClick={() => setTagFilter((f) => f === tag ? "" : tag)}
      >
        {tag}
      </button>
    ))}
  </div>

  {/* Dashboard Link */}
  <a href="/dashboard" className={styles.topNavDashboard}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
    Dashboard
  </a>
</nav>
```

**Step 2: Commit**

```bash
git add gapstrike/src/app/page.tsx
git commit -m "feat: add horizontal top nav bar with tabs, tags, and dashboard link"
```

---

### Task 4: Update `filteredNotes` to Respect Global Tag Filter

**Files:**
- Modify: `gapstrike/src/app/page.tsx`

**Step 1: Update `filteredNotes` computation (~line 1261)**

Replace:
```typescript
const filteredNotes = allNotes.filter((n) =>
  n.title.toLowerCase().includes(noteSearch.toLowerCase())
);
```

With:
```typescript
const filteredNotes = allNotes.filter((n) => {
  const matchSearch = n.title.toLowerCase().includes(noteSearch.toLowerCase());
  const matchTag = !tagFilter || (n.tags || []).includes(tagFilter);
  return matchSearch && matchTag;
});
```

**Step 2: Commit**

```bash
git add gapstrike/src/app/page.tsx
git commit -m "feat: apply global tag filter to editor note list"
```

---

### Task 5: Move Chat Session List Inline

**Files:**
- Modify: `gapstrike/src/app/page.tsx`

**Step 1: Wrap chat view in a flex row with inline session panel**

Find the chat view section (starts with `{viewMode === "chat" ? (` followed by `<div className={styles.chatContainer}`). Wrap the existing chat container in a parent flex row and add the session panel.

The chat view should become:

```jsx
{viewMode === "chat" ? (
  <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
    {/* Inline chat session panel */}
    <div className={styles.chatInlinePanel}>
      <div className={styles.chatHistorySection}>
        <div className={styles.chatHistoryHeader}>
          <span className={styles.chatHistoryTitle}>Chats</span>
        </div>
        <button className={styles.newChatBtn} onClick={startNewChat}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New chat
        </button>
        <div className={styles.chatHistoryList}>
          {/* existing session list rendering — unchanged */}
        </div>
      </div>
      {isInWorkflow && (
        <button onClick={resetWorkflow} className={styles.resetBtn}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" /></svg>
          Start Over
        </button>
      )}
    </div>

    {/* Main chat container (existing) */}
    <div className={styles.chatContainer} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* existing chat content — unchanged */}
    </div>
  </div>
) : /* ... */
```

**Step 2: Commit**

```bash
git add gapstrike/src/app/page.tsx
git commit -m "feat: move chat session list to inline panel within chat view"
```

---

### Task 6: Move Editor Note List Inline

**Files:**
- Modify: `gapstrike/src/app/page.tsx`

**Step 1: Add inline note list panel to editor view**

Find the editor view section. It should render a flex row with the inline note panel and editor content:

```jsx
viewMode === "editor" ? (
  <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
    {/* Inline note list panel */}
    <div className={styles.editorInlinePanel}>
      <input
        type="text"
        placeholder="Search notes..."
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

    {/* Main editor area (existing editorContainer) */}
    <div className={styles.editorContainer}>
      {/* existing editor content — unchanged */}
    </div>
  </div>
) : /* ... */
```

**Step 2: Commit**

```bash
git add gapstrike/src/app/page.tsx
git commit -m "feat: move editor note list to inline panel within editor view"
```

---

### Task 7: Move Anki Search Inline

**Files:**
- Modify: `gapstrike/src/app/page.tsx`

**Step 1: Add search bar to top of anki content area**

The anki search input and syntax hints should be placed at the top of the anki view's main content, before the card results. Find the anki view section and add the search form as an inline header:

```jsx
{/* Anki search header — inline at top of content */}
<div className={styles.ankiSearchForm} style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)" }}>
  <input
    type="text"
    placeholder="e.g. 2513  →  tag::2513"
    value={ankiQuery}
    onChange={(e) => setAnkiQuery(e.target.value)}
    className={styles.noteSearchInput}
    style={{ maxWidth: "400px" }}
  />
  <div className={styles.ankiSyntaxHints}>
    <div className={styles.ankiHint}>2513 → ::2513</div>
    <div className={styles.ankiHint}>uworld → ::uworld</div>
  </div>
</div>
```

**Step 2: Commit**

```bash
git add gapstrike/src/app/page.tsx
git commit -m "feat: move anki search bar inline within anki content area"
```

---

### Task 8: Clean Up Unused CSS Classes

**Files:**
- Modify: `gapstrike/src/app/page.module.css`

**Step 1: Remove unused sidebar CSS classes**

Delete these CSS class blocks that are no longer referenced:
- `.sidebar`
- `.sidebarHeader`
- `.sidebarAppName` — keep this one (still used by nav bar logo)
- `.viewToggle`
- `.viewToggleBtn`
- `.viewToggleActive`
- `.viewToggleDivider`
- `.pathSection`
- `.settingsBtn`
- `.pathSettings`
- `.pathLabel`
- `.pathManualInput`
- `.pathInput`
- `.pathButtonsGroup`
- `.pathSaveBtn`
- `.pathCancelBtn`

**Step 2: Commit**

```bash
git add gapstrike/src/app/page.module.css
git commit -m "chore: remove unused sidebar CSS classes"
```

---

### Task 9: Build, Test, and Deploy

**Files:**
- None (verification only)

**Step 1: Build the app locally**

```bash
cd gapstrike && npm run build
```

Expected: Clean build with no errors.

**Step 2: Fix any build errors**

If TypeScript errors about removed state/functions, find and remove remaining references.

**Step 3: Deploy to Vercel**

```bash
cd gapstrike && npx vercel --prod
```

Expected: Deploys successfully to `gapstrike-app.vercel.app`.

**Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix: resolve build issues from nav bar redesign"
```
