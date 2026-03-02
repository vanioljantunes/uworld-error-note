# Activity History Dedup + Logo Icons — Design

**Date:** 2026-03-02

## Goal

1. Each note/card appears only once in the history panel ("most recently used" list).
2. Replace emoji icons with inline SVG approximations of the Obsidian and Anki logos.

---

## Dedup Logic

**Location:** `addActivity` function in `page.tsx` (~line 1086).

**Current behavior:** Skips insertion only if the top item matches (consecutive dedup). The same note can appear many times if accessed non-consecutively.

**New behavior:** On every insertion, filter the existing array to remove any entry with the same identity, then prepend the new entry. This produces a "most recently used" list with no duplicates.

### Identity key

| Item type | Identity |
|-----------|----------|
| `"note"` / `"open"` | `notePath` |
| `"card"` | `noteId` (preferred) or `questionId` |

### Implementation sketch

```ts
function isSameItem(a: ActivityItem, b: Omit<ActivityItem, "savedAt">): boolean {
  if (a.type !== b.type) return false;
  if (b.notePath) return a.notePath === b.notePath;
  if (b.noteId)   return a.noteId === b.noteId;
  if (b.questionId) return a.questionId === b.questionId;
  return false;
}

const addActivity = (item: Omit<ActivityItem, "savedAt">) => {
  setActivityHistory((prev) => {
    const deduped = prev.filter(existing => !isSameItem(existing, item));
    const next = [{ ...item, savedAt: Date.now() }, ...deduped].slice(0, 50);
    try { localStorage.setItem("obsidianChatActivity", JSON.stringify(next)); } catch {}
    return next;
  });
};
```

### On-mount migration

Apply a one-time dedup pass when loading from localStorage (keep first occurrence per key since the array is already sorted newest-first).

---

## Logo Icons

**Location:** Top of `page.tsx`, outside the component (pure presentational components).

### `ObsidianIcon` (for `type === "note"` and `type === "open"`)

Purple (#a855f7) faceted diamond SVG, 16×16px. Approximates the Obsidian gem logo with a simple polygon shape and inner facet line.

### `AnkiIcon` (for `type === "card"`)

Teal (#06b6d4) stylized star SVG, 16×16px. Approximates the Anki logo with a 4-pointed star / cross shape with rounded stroke ends.

### Usage

Replace the current emoji at line 2282:
```tsx
// Before
<span className={styles.activityIcon}>
  {item.type === "open" ? "👁️" : item.type === "note" ? "📝" : "🃏"}
</span>

// After
<span className={styles.activityIcon}>
  {item.type === "card" ? <AnkiIcon /> : <ObsidianIcon />}
</span>
```

---

## Files Changed

- `obsidian-chat/src/app/page.tsx` — only file touched

## No CSS changes needed

The `.activityIcon` class already styles the icon container. The SVGs will inherit sizing from it.
