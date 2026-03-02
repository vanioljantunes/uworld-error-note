# Activity History Dedup + Logo Icons Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the activity history show each note/card only once (most-recently-used order), and replace emoji icons with inline SVG approximations of the Obsidian and Anki logos.

**Architecture:** All changes are in a single file — `page.tsx`. A pure helper `isSameItem` handles identity matching. The `addActivity` function is rewritten to filter-then-prepend instead of consecutive-skip. Two tiny SVG components (`ObsidianIcon`, `AnkiIcon`) are added above the main component and replace the emoji in the history render.

**Tech Stack:** React (Next.js), TypeScript, inline SVG.

---

## Task 1: Add `ObsidianIcon` and `AnkiIcon` SVG components

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

**Step 1: Find the insertion point**

Open `page.tsx` and locate the line:
```tsx
const CREWAI_URL = "http://localhost:8000";
```
(around line 73). The new components go directly above this line.

**Step 2: Insert both SVG components**

Add the following block immediately before `const CREWAI_URL`:

```tsx
// ── Activity history logo icons ───────────────────────────────────────────

function ObsidianIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Obsidian note">
      {/* Main gem body */}
      <polygon points="7,0.5 13.5,5 7,13.5 0.5,5" fill="#7c3aed" />
      {/* Top facet highlight */}
      <polygon points="7,0.5 13.5,5 7,5.5 0.5,5" fill="#a855f7" />
      {/* Right facet shadow */}
      <polygon points="7,5.5 13.5,5 7,13.5" fill="#6d28d9" />
    </svg>
  );
}

function AnkiIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Anki card">
      {/* 4-pointed star approximating Anki's burst logo */}
      <path
        d="M7 0.5 L8.3 5.7 L13.5 7 L8.3 8.3 L7 13.5 L5.7 8.3 L0.5 7 L5.7 5.7 Z"
        fill="#06b6d4"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
```

**Step 3: Verify TypeScript is happy**

```bash
cd obsidian-chat && npx tsc --noEmit
```
Expected: no output (zero errors).

**Step 4: Commit**

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: add ObsidianIcon and AnkiIcon SVG components"
```

---

## Task 2: Replace emoji with SVG icons in the history render

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

**Step 1: Find the emoji line**

Search for:
```tsx
<span className={styles.activityIcon}>{item.type === "open" ? "👁️" : item.type === "note" ? "📝" : "🃏"}</span>
```
(around line 2282 after Task 1's edit shifts lines).

**Step 2: Replace with SVG icons**

Change it to:
```tsx
<span className={styles.activityIcon}>
  {item.type === "card" ? <AnkiIcon /> : <ObsidianIcon />}
</span>
```

`"open"` and `"note"` both show `ObsidianIcon`. `"card"` shows `AnkiIcon`.

**Step 3: Verify TypeScript**

```bash
cd obsidian-chat && npx tsc --noEmit
```
Expected: no output.

**Step 4: Commit**

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: use Obsidian/Anki SVG logos in activity history"
```

---

## Task 3: Rewrite `addActivity` with full dedup

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

**Step 1: Add the `isSameItem` helper**

Find the `addActivity` function:
```tsx
const addActivity = (item: Omit<ActivityItem, "savedAt">) => {
```

Insert this helper **immediately before** that line:

```tsx
const isSameItem = (a: ActivityItem, b: Omit<ActivityItem, "savedAt">): boolean => {
  if (a.type !== b.type) return false;
  if (b.notePath) return a.notePath === b.notePath;
  if (b.noteId !== undefined) return a.noteId === b.noteId;
  if (b.questionId) return a.questionId === b.questionId;
  return false;
};
```

**Step 2: Replace the `addActivity` body**

Replace the entire function:

```tsx
// Before:
const addActivity = (item: Omit<ActivityItem, "savedAt">) => {
  setActivityHistory((prev) => {
    // Dedup: skip if the most recent item matches same type + path/noteId
    const top = prev[0];
    if (top && top.type === item.type) {
      if (item.notePath && top.notePath === item.notePath) return prev;
      if (item.noteId && top.noteId === item.noteId) return prev;
    }
    const next = [{ ...item, savedAt: Date.now() }, ...prev].slice(0, 50);
    try { localStorage.setItem("obsidianChatActivity", JSON.stringify(next)); } catch { }
    return next;
  });
};
```

```tsx
// After:
const addActivity = (item: Omit<ActivityItem, "savedAt">) => {
  setActivityHistory((prev) => {
    // Remove any existing entry for this item, then prepend (most-recently-used order)
    const deduped = prev.filter(existing => !isSameItem(existing, item));
    const next = [{ ...item, savedAt: Date.now() }, ...deduped].slice(0, 50);
    try { localStorage.setItem("obsidianChatActivity", JSON.stringify(next)); } catch { }
    return next;
  });
};
```

**Step 3: Verify TypeScript**

```bash
cd obsidian-chat && npx tsc --noEmit
```
Expected: no output.

**Step 4: Commit**

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "feat: deduplicate activity history with most-recently-used order"
```

---

## Task 4: Apply one-time dedup on localStorage load

**Files:**
- Modify: `obsidian-chat/src/app/page.tsx`

**Background:** Old localStorage data may contain duplicates. Dedup on mount so the history is clean immediately.

**Step 1: Find the on-mount useEffect**

Find:
```tsx
// Load activity history from localStorage on mount
useEffect(() => {
  try {
    const stored = localStorage.getItem("obsidianChatActivity");
    if (stored) setActivityHistory(JSON.parse(stored));
  } catch { }
}, []);
```

**Step 2: Add dedup on load**

Replace with:
```tsx
// Load activity history from localStorage on mount, deduplicating legacy data
useEffect(() => {
  try {
    const stored = localStorage.getItem("obsidianChatActivity");
    if (stored) {
      const items: ActivityItem[] = JSON.parse(stored);
      // Keep only the first (most-recent) occurrence of each unique item
      const seen = new Set<string>();
      const deduped = items.filter(item => {
        const key = `${item.type}:${item.notePath ?? item.noteId ?? item.questionId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setActivityHistory(deduped);
    }
  } catch { }
}, []);
```

**Step 3: Verify TypeScript**

```bash
cd obsidian-chat && npx tsc --noEmit
```
Expected: no output.

**Step 4: Commit**

```bash
git add obsidian-chat/src/app/page.tsx
git commit -m "fix: dedup legacy activity history on localStorage load"
```
