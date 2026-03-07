# Templates Management — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users view and edit all 8 app templates (3 error note + 5 Anki) via a new Templates tab, stored per-user in Supabase.

**Architecture:** New `templates` table in Supabase with RLS. saas-shell serves GET/PUT/reset API routes. gapstrike frontend adds a Templates tab that fetches, displays, and edits templates. The `/api/generate` route accepts the template from the request body instead of using a hardcoded string.

**Tech Stack:** Next.js (App Router), Supabase (Postgres + RLS), TypeScript, CSS Modules

---

## Task 1: Create the `templates` table in Supabase

**Files:**
- Reference: `saas-shell/src/lib/types.ts` (will update in Task 2)

**Step 1: Run SQL in Supabase Dashboard**

Go to the Supabase SQL Editor and run:

```sql
CREATE TABLE templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, slug)
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates"
  ON templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**Step 2: Verify**

In Supabase Table Editor, confirm `templates` table exists with the correct columns and RLS is enabled.

---

## Task 2: Add `templates` type to Database

**Files:**
- Modify: `saas-shell/src/lib/types.ts:95` (insert before the closing `}` of `Tables`)

**Step 1: Add the templates table type**

Insert after the `subscriptions` block (after line 95, before `}` closing `Tables`):

```typescript
      templates: {
        Row: {
          id: string
          user_id: string
          slug: string
          category: string
          title: string
          content: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          slug: string
          category: string
          title: string
          content: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          slug?: string
          category?: string
          title?: string
          content?: string
          updated_at?: string
        }
        Relationships: []
      }
```

**Step 2: Verify**

Run: `cd saas-shell && npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add saas-shell/src/lib/types.ts
git commit -m "feat: add templates table type to Database"
```

---

## Task 3: Create template defaults file

**Files:**
- Create: `saas-shell/src/lib/template-defaults.ts`

This file contains the default content for all 8 templates. The API route imports it for seeding and resetting.

**Step 1: Create the file**

```typescript
export interface TemplateDefault {
  slug: string;
  category: "error_note" | "anki";
  title: string;
  content: string;
}

export const TEMPLATE_DEFAULTS: TemplateDefault[] = [
  {
    slug: "error_note_a",
    category: "error_note",
    title: "Error Note A",
    content: `---
tags:
  - 483921
  - neurology
  - vitamin_deficiency
---

## ❌ What I got wrong

**My choice:** Vitamin B12
**Correct:** Thiamine (Vitamin B1)

## 🔍 Why I got it wrong

I mapped the neurological findings to [[Vitamin B12]] neuropathy instead of recognizing the acute [[Wernicke encephalopathy]] pattern.

## ✅ The key concept

In chronic alcohol use, the **triad of confusion + ataxia + nystagmus** is the classic presentation of [[Wernicke encephalopathy]] caused by [[Thiamine]] deficiency.

> **Anchor:** Confusion + Ataxia + Nystagmus + Alcohol → Thiamine deficiency → Wernicke

## 📌 The rule I must remember

- Wernicke triad = **C**onfusion + **A**taxia + **N**ystagmus (**CAN**)
- Always consider thiamine deficiency first in alcoholic patients with neurological symptoms
- B12 deficiency presents with **subacute** combined degeneration, not an acute triad

## 🔗 Connections

Related topics: [[Neurology]], [[Thiamine]], [[Wernicke encephalopathy]], [[Alcohol use disorder]]`,
  },
  {
    slug: "error_note_b",
    category: "error_note",
    title: "Error Note B",
    content: `---
tags:
  - 771204
  - pharmacology
  - adrenergic_blockade
---

## ❌ What I got wrong

**My choice:** Start propranolol (beta-blocker first)
**Correct:** Alpha blockade before beta blockade

## 🔍 Why I got it wrong

I defaulted to treating the tachycardia symptomatically and ignored the **order-of-operations** principle for [[Pheochromocytoma]] management.

## ✅ The key concept

In [[Pheochromocytoma]], giving a beta-blocker first causes **unopposed alpha stimulation** → hypertensive crisis. You must start with **alpha blockade** (e.g., phenoxybenzamine), then add beta blockade.

> **Anchor:** Pheochromocytoma → **A**lpha first, **B**eta second (alphabetical order = treatment order)

## 📌 The rule I must remember

- **Alpha before Beta** — always, no exceptions in pheochromocytoma
- Unopposed alpha = vasoconstriction = hypertensive crisis
- Episodic headache + sweating + palpitations + ↑metanephrines = pheochromocytoma

## ⚡ Clinical pearl

The mnemonic is built into the alphabet: **A** (alpha) comes before **B** (beta).

## 🔗 Connections

Related topics: [[Pheochromocytoma]], [[Adrenergic receptors]], [[Pharmacology]], [[Hypertensive emergency]]`,
  },
  {
    slug: "error_note_c",
    category: "error_note",
    title: "Error Note C",
    content: `---
tags:
  - 105588
  - immunology
  - primary_immunodeficiency
---

## ❌ What I got wrong

**My choice:** Defective NADPH oxidase (→ CGD)
**Correct:** WAS gene mutation (→ Wiskott-Aldrich syndrome)

## 🔍 Why I got it wrong

I focused on the "recurrent infections" clue and jumped to [[Chronic granulomatous disease|CGD]], ignoring the **platelet size** which is the true differentiator.

## ✅ The key concept

The unique finding in [[Wiskott-Aldrich syndrome]] is **small platelets** (low MPV). The classic triad is:

1. **E**czema
2. **T**hrombocytopenia (with **small** platelets)
3. Recurrent **I**nfections

> **Anchor:** Eczema + Small platelets + Infections → **W**iskott-**A**ldrich **S**yndrome (WAS)

## 📌 The rule I must remember

- CGD = recurrent infections with **catalase-positive** organisms + normal platelet size
- Wiskott-Aldrich = recurrent infections + eczema + **small platelets**
- The differentiator is **platelet size**, not infection pattern

## 🔗 Connections

Related topics: [[Primary immunodeficiency]], [[Wiskott-Aldrich syndrome]], [[Chronic granulomatous disease|CGD]], [[Immunology]]`,
  },
  {
    slug: "anki_line_of_thought",
    category: "anki",
    title: "Line of Thought",
    content: `# Line of Thought — Structural Template

## FRONT (reasoning prompt)

[Symptom / Finding / Scenario] → What is your line of thought?

Rules for front:
- State the clinical trigger or finding
- Use "→ What is your line of thought?" or "→ Walk through your reasoning"
- Keep to 1-2 lines

## BACK (step-by-step reasoning chain)

<b>1. First think:</b> [Initial recognition — what category/system]<br>
<b>2. Then ask:</b> [Key discriminating question]<br>
<b>3. Evidence points to:</b> [Diagnosis or conclusion]<br>
<b>4. Confirm by:</b> [Test or feature that confirms]<br>
<b>5. Act:</b> [Next step / Treatment]<br><br>
<b>Pitfall:</b> [Common mistake or mimicker to avoid]

Rules for back:
- Use numbered bold headers for each reasoning step
- Use <br> for line breaks (not markdown)
- Steps 1-5 are mandatory; add step 6 only if needed
- Keep each step to 1 line
- Always include a Pitfall at the end`,
  },
  {
    slug: "anki_questions",
    category: "anki",
    title: "Questions",
    content: `# Q&A — Structural Template

## FRONT (clinical vignette question)

A [age]-year-old [sex] presents with [chief complaint]. [Key findings from history/exam]. What is the [diagnosis / mechanism / next step / treatment]?

Rules for front:
- One focused clinical question
- Include only the most discriminating clues
- End with a clear question stem

## BACK (structured answer)

<b>Answer:</b> [Direct answer]<br><br>
<b>Key clues:</b><br>
- [Clue 1 → why it matters]<br>
- [Clue 2 → why it matters]<br><br>
<b>Mechanism:</b> [1-2 sentences]<br><br>
<b>Differentials to exclude:</b><br>
- [Distractor 1]: [distinguishing feature]<br>
- [Distractor 2]: [distinguishing feature]

Rules for back:
- Use <b>bold</b> for answer and section headers
- Use <br> for line breaks (not markdown)
- Keep differentials ≤ 2 entries
- Total ≤ 8 lines`,
  },
  {
    slug: "anki_table",
    category: "anki",
    title: "Table",
    content: `# Table — Structural Template

## FRONT (question with comparison table)

<b>[Topic/Question]</b>

Rules for front:
- One clear question or comparison prompt
- Keep it ≤ 2 lines before the table

## BACK (structured table answer)

<table style="width:100%;border-collapse:collapse;font-size:12px">
<tr style="background:rgba(255,255,255,0.08)">
  <th style="padding:4px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)">[Category]</th>
  <th style="padding:4px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)">[Option A]</th>
  <th style="padding:4px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)">[Option B]</th>
</tr>
<tr>
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">[Row 1]</td>
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">[Value]</td>
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">[Value]</td>
</tr>
<tr style="background:rgba(255,255,255,0.04)">
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">[Row 2]</td>
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">[Value]</td>
  <td style="padding:4px 8px;border:1px solid rgba(255,255,255,0.1)">[Value]</td>
</tr>
</table>

Rules for back:
- Use HTML table tags (not markdown)
- Use inline styles for borders and spacing
- Max 4-5 rows; keep values short (1-3 words)
- Bold key distinguishing features with <b>`,
  },
  {
    slug: "anki_mermaid",
    category: "anki",
    title: "Mermaid Flowchart",
    content: `# Mermaid — Structural Template

## FRONT (clinical prompt)

[Symptom / Finding / Concept] → Map the [mechanism / algorithm / pathway]:

Rules for front:
- State the concept or scenario requiring visualization
- Keep to 1-2 lines
- End with "→ Map the mechanism" or "→ Draw the diagnostic algorithm"
- No cloze syntax on Mermaid cards

## BACK (Mermaid diagram + key points)

Use flowchart TD for pathways, algorithms, or decision trees:

<div class="mermaid">
flowchart TD
    A[Trigger / Finding] --> B{Key Decision}
    B -->|Condition A| C[Outcome A]
    B -->|Condition B| D[Outcome B]
    C --> E[Final Step]
    D --> E
</div>
<br>
<b>Key point:</b> [1-sentence mechanistic takeaway]<br>
<b>Pitfall:</b> [Common mistake or mimicker]

Use sequenceDiagram for signal cascades or cell-cell interactions:

<div class="mermaid">
sequenceDiagram
    Cell A->>Cell B: Signal (ligand/receptor)
    Cell B->>Cell C: Downstream effect
    Cell C-->>Cell A: Feedback
</div>
<br>
<b>Key point:</b> [1-sentence takeaway]<br>
<b>Pitfall:</b> [What breaks this cascade]

Rules for back:
- Choose flowchart TD OR sequenceDiagram — whichever best fits the concept
- Keep diagram to 4-8 nodes — readable at a glance
- Label every arrow with the relationship (causes, activates, inhibits, leads to)
- Always include <b>Key point</b> and <b>Pitfall</b> after the diagram using <b> and <br>
- Wrap diagram in <div class="mermaid"> ... </div>
- No markdown code fences — use the HTML div wrapper only`,
  },
  {
    slug: "anki_cloze_basic",
    category: "anki",
    title: "Cloze Basic",
    content: `# Cloze Basic — Structural Template

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
- No redundant restatement of the front`,
  },
];
```

**Step 2: Verify**

Run: `cd saas-shell && npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add saas-shell/src/lib/template-defaults.ts
git commit -m "feat: add template default content definitions"
```

---

## Task 4: Create saas-shell `/api/templates` route (GET + PUT)

**Files:**
- Create: `saas-shell/src/app/api/templates/route.ts`
- Reference: `saas-shell/src/app/api/me/route.ts` (auth pattern)
- Reference: `saas-shell/src/lib/supabase/server.ts` (client creation)
- Reference: `saas-shell/src/lib/template-defaults.ts` (defaults)

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_DEFAULTS } from "@/lib/template-defaults";

// GET — return all templates for authenticated user (seed if empty)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }

  // Check if user already has templates
  let { data: templates, error } = await supabase
    .from("templates")
    .select("*")
    .eq("user_id", user.id)
    .order("category")
    .order("slug");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Seed defaults if user has no templates
  if (!templates || templates.length === 0) {
    const rows = TEMPLATE_DEFAULTS.map((t) => ({
      user_id: user.id,
      slug: t.slug,
      category: t.category,
      title: t.title,
      content: t.content,
    }));

    const { error: insertError } = await supabase
      .from("templates")
      .insert(rows);

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Re-fetch after insert
    const { data: seeded } = await supabase
      .from("templates")
      .select("*")
      .eq("user_id", user.id)
      .order("category")
      .order("slug");

    templates = seeded;
  }

  return NextResponse.json({ templates });
}

// PUT — update one template by slug
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }

  const body = await request.json();
  const { slug, content } = body;

  if (!slug || typeof content !== "string") {
    return NextResponse.json(
      { error: "slug and content are required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("templates")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("slug", slug)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}
```

**Step 2: Verify**

Run: `cd saas-shell && npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add saas-shell/src/app/api/templates/route.ts
git commit -m "feat: add GET/PUT /api/templates endpoints"
```

---

## Task 5: Create saas-shell `/api/templates/reset` route

**Files:**
- Create: `saas-shell/src/app/api/templates/reset/route.ts`

**Step 1: Create the route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TEMPLATE_DEFAULTS } from "@/lib/template-defaults";

// POST — reset one template to its default content
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(null, { status: 401 });
  }

  const body = await request.json();
  const { slug } = body;

  if (!slug) {
    return NextResponse.json(
      { error: "slug is required" },
      { status: 400 }
    );
  }

  const defaultTemplate = TEMPLATE_DEFAULTS.find((t) => t.slug === slug);
  if (!defaultTemplate) {
    return NextResponse.json(
      { error: `Unknown template slug: ${slug}` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("templates")
    .update({
      content: defaultTemplate.content,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("slug", slug)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: data });
}
```

**Step 2: Verify**

Run: `cd saas-shell && npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

```bash
git add saas-shell/src/app/api/templates/reset/route.ts
git commit -m "feat: add POST /api/templates/reset endpoint"
```

---

## Task 6: Build and deploy saas-shell

**Step 1: Build**

Run: `cd saas-shell && npm run build`
Expected: Build succeeds with new API routes listed.

**Step 2: Deploy**

Run: `cd saas-shell && npx vercel --prod`
Expected: Deployment succeeds. New routes `/api/templates` and `/api/templates/reset` available.

**Step 3: Verify the fallback rewrite**

The saas-shell `next.config.ts` has `/api/templates` as its own route (served by saas-shell directly, before the fallback rewrite to gapstrike-app). Confirm this by checking that `GET https://gapstrike.vercel.app/api/templates` returns 401 (not proxied to gapstrike-app).

**Step 4: Commit if any build fixes were needed**

---

## Task 7: Create TemplatesView component

**Files:**
- Create: `gapstrike/src/components/TemplatesView.tsx`

This is a client component that shows the grid of template cards and an inline editor when a card is clicked.

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import styles from "../app/page.module.css";

export interface Template {
  id: string;
  slug: string;
  category: string;
  title: string;
  content: string;
  updated_at: string;
}

interface Props {
  templates: Template[];
  onUpdate: (slug: string, content: string) => Promise<void>;
  onReset: (slug: string) => Promise<void>;
}

export default function TemplatesView({ templates, onUpdate, onReset }: Props) {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const errorNoteTemplates = templates.filter((t) => t.category === "error_note");
  const ankiTemplates = templates.filter((t) => t.category === "anki");

  const openEditor = (t: Template) => {
    setEditingSlug(t.slug);
    setEditContent(t.content);
  };

  const handleSave = async () => {
    if (!editingSlug) return;
    setSaving(true);
    try {
      await onUpdate(editingSlug, editContent);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!editingSlug) return;
    setResetting(true);
    try {
      await onReset(editingSlug);
      // Find the updated template from parent state after reset
      setEditingSlug(null);
    } finally {
      setResetting(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  // ── Editor View ──
  if (editingSlug) {
    const tpl = templates.find((t) => t.slug === editingSlug);
    if (!tpl) return null;

    return (
      <div className={styles.tplEditorWrap}>
        <div className={styles.tplEditorHeader}>
          <button
            className={styles.tplBackBtn}
            onClick={() => setEditingSlug(null)}
          >
            ← Back
          </button>
          <span className={styles.tplEditorTitle}>{tpl.title}</span>
          <div className={styles.tplEditorActions}>
            <button
              className={styles.tplResetBtn}
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? "Resetting…" : "Reset to Default"}
            </button>
            <button
              className={styles.tplSaveBtn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        <textarea
          className={styles.tplEditor}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          spellCheck={false}
        />
        <div className={styles.tplEditorFooter}>
          Last edited: {formatDate(tpl.updated_at)}
        </div>
      </div>
    );
  }

  // ── Grid View ──
  const renderCard = (t: Template) => (
    <button
      key={t.slug}
      className={styles.tplCard}
      onClick={() => openEditor(t)}
    >
      <div className={styles.tplCardTitle}>{t.title}</div>
      <div className={styles.tplCardPreview}>
        {t.content.slice(0, 80).replace(/\n/g, " ")}…
      </div>
      <div className={styles.tplCardMeta}>
        Edited {formatDate(t.updated_at)}
      </div>
    </button>
  );

  return (
    <div className={styles.tplContainer}>
      <section className={styles.tplSection}>
        <h2 className={styles.tplSectionTitle}>Error Note Templates</h2>
        <div className={styles.tplGrid}>
          {errorNoteTemplates.map(renderCard)}
        </div>
      </section>

      <section className={styles.tplSection}>
        <h2 className={styles.tplSectionTitle}>Anki Card Templates</h2>
        <div className={styles.tplGrid}>
          {ankiTemplates.map(renderCard)}
        </div>
      </section>
    </div>
  );
}
```

**Step 2: Verify**

Run: `cd gapstrike && npx tsc --noEmit`
Expected: No type errors (CSS module imports may warn — that's fine until styles are added).

**Step 3: Commit**

```bash
git add gapstrike/src/components/TemplatesView.tsx
git commit -m "feat: add TemplatesView component with grid and editor"
```

---

## Task 8: Add template CSS styles

**Files:**
- Modify: `gapstrike/src/app/page.module.css` (append at end)

**Step 1: Add styles**

Append to the end of the CSS file:

```css
/* ── Templates View ─────────────────────────────────────────── */

.tplContainer {
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  padding: 32px 24px;
}

.tplSection {
  margin-bottom: 32px;
}

.tplSectionTitle {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #888;
  margin-bottom: 12px;
}

.tplGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.tplCard {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: left;
  font-family: inherit;
  color: inherit;
}

.tplCard:hover {
  border-color: var(--accent);
  background: var(--bg-elevated);
}

.tplCardTitle {
  font-size: 14px;
  font-weight: 600;
  color: #eee;
}

.tplCardPreview {
  font-size: 12px;
  color: #888;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.tplCardMeta {
  font-size: 11px;
  color: #666;
  margin-top: 4px;
}

/* ── Template Editor ────────────────────────────────────────── */

.tplEditorWrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 24px;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
}

.tplEditorHeader {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.tplBackBtn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  padding: 4px 8px;
  border-radius: 4px;
}

.tplBackBtn:hover {
  background: rgba(124, 58, 237, 0.1);
}

.tplEditorTitle {
  font-size: 16px;
  font-weight: 700;
  color: #eee;
  flex: 1;
}

.tplEditorActions {
  display: flex;
  gap: 8px;
}

.tplResetBtn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: #ccc;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s;
}

.tplResetBtn:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tplResetBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tplSaveBtn {
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  background: var(--accent);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.15s;
}

.tplSaveBtn:hover {
  opacity: 0.9;
}

.tplSaveBtn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.tplEditor {
  flex: 1;
  width: 100%;
  min-height: 400px;
  padding: 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: #ddd;
  font-family: "SF Mono", "Fira Code", "Consolas", monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
}

.tplEditor:focus {
  border-color: var(--accent);
}

.tplEditorFooter {
  font-size: 11px;
  color: #666;
  margin-top: 8px;
  text-align: right;
}
```

**Step 2: Commit**

```bash
git add gapstrike/src/app/page.module.css
git commit -m "feat: add CSS styles for templates view"
```

---

## Task 9: Wire Templates tab into page.tsx

**Files:**
- Modify: `gapstrike/src/app/page.tsx`

**Step 1: Update ViewMode type (line 6)**

Change:
```typescript
type ViewMode = "chat" | "editor" | "anki";
```
To:
```typescript
type ViewMode = "chat" | "editor" | "anki" | "templates";
```

**Step 2: Add import for TemplatesView (after line 4)**

Add:
```typescript
import TemplatesView, { Template } from "../components/TemplatesView";
```

**Step 3: Add templates state**

Near the existing state declarations (around line 168), add:

```typescript
const [userTemplates, setUserTemplates] = useState<Template[]>([]);
const [templatesLoaded, setTemplatesLoaded] = useState(false);
```

**Step 4: Add template fetching function**

Add a function (near the other fetch helpers) that loads templates when the tab is first opened:

```typescript
const fetchTemplates = useCallback(async () => {
  if (templatesLoaded) return;
  try {
    const resp = await fetch("/api/templates");
    if (resp.ok) {
      const data = await resp.json();
      setUserTemplates(data.templates || []);
      setTemplatesLoaded(true);
    }
  } catch (error) {
    console.error("Failed to load templates:", error);
  }
}, [templatesLoaded]);
```

**Step 5: Trigger fetch when tab is selected**

Add a `useEffect` that calls `fetchTemplates` when viewMode changes to "templates":

```typescript
useEffect(() => {
  if (viewMode === "templates") fetchTemplates();
}, [viewMode, fetchTemplates]);
```

**Step 6: Add template update and reset handlers**

```typescript
const handleTemplateUpdate = async (slug: string, content: string) => {
  const resp = await fetch("/api/templates", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug, content }),
  });
  if (resp.ok) {
    const { template } = await resp.json();
    setUserTemplates((prev) =>
      prev.map((t) => (t.slug === slug ? { ...t, content: template.content, updated_at: template.updated_at } : t))
    );
  }
};

const handleTemplateReset = async (slug: string) => {
  const resp = await fetch("/api/templates/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug }),
  });
  if (resp.ok) {
    const { template } = await resp.json();
    setUserTemplates((prev) =>
      prev.map((t) => (t.slug === slug ? { ...t, content: template.content, updated_at: template.updated_at } : t))
    );
  }
};
```

**Step 7: Add Templates tab button to navbar (after the Anki tab, around line 1433)**

Add before the Dashboard `<a>` tag:

```tsx
<button
  className={`${styles.navTab} ${viewMode === "templates" ? styles.navTabActive : ""}`}
  onClick={() => setViewMode("templates")}
>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
  Templates
</button>
```

**Step 8: Add templates view to the main content switch**

Find the Anki view section (the last branch of the ternary, around line 2183). Before its closing, add a new branch. The ternary chain should become:

```tsx
{viewMode === "chat" ? (
  /* ...existing chat view... */
) : viewMode === "editor" ? (
  /* ...existing editor view... */
) : viewMode === "templates" ? (
  <TemplatesView
    templates={userTemplates}
    onUpdate={handleTemplateUpdate}
    onReset={handleTemplateReset}
  />
) : (
  /* ...existing anki view... */
)}
```

**Step 9: Pass template to handleSubmitAnswers fetch call**

In `handleSubmitAnswers` (around line 796), update the fetch body to include the template:

Change:
```typescript
body: JSON.stringify({ extraction: extractedJson, questions: diagnosticQuestions, answers: answers })
```
To:
```typescript
body: JSON.stringify({ extraction: extractedJson, questions: diagnosticQuestions, answers: answers, template: userTemplates.find((t) => t.slug === "error_note_a")?.content || "" })
```

**Step 10: Verify**

Run: `cd gapstrike && npx tsc --noEmit`
Expected: No type errors.

**Step 11: Commit**

```bash
git add gapstrike/src/app/page.tsx
git commit -m "feat: wire Templates tab into main app"
```

---

## Task 10: Update `/api/generate` to use request template

**Files:**
- Modify: `gapstrike/src/app/api/generate/route.ts`

**Step 1: Update the GenerateRequest interface (line 42-58)**

Add `template` field:

```typescript
interface GenerateRequest {
  extraction: {
    question_id?: string | null;
    question?: string | null;
    choosed_alternative?: string | null;
    wrong_alternative?: string | null;
    full_explanation?: string | null;
    educational_objective?: string | null;
  };
  questions: Array<{
    question: string;
    options: string[];
    correct: number;
    difficulty: string;
  }>;
  answers: string[];
  template?: string;
}
```

**Step 2: Update buildUserPrompt to use body.template**

Change the hardcoded `${TEMPLATE_EXAMPLE}` reference in the prompt (line 87) to use the request body template with a fallback:

```typescript
function buildUserPrompt(body: GenerateRequest): string {
  const ext = body.extraction || {};
  const questionsJson = JSON.stringify(body.questions || []);
  const answersJson = JSON.stringify(body.answers || []);
  const explanation = (ext.full_explanation || "").slice(0, 500);
  const template = body.template || TEMPLATE_EXAMPLE;

  // ... rest of prompt, using ${template} instead of ${TEMPLATE_EXAMPLE}
```

At line 87, change `${TEMPLATE_EXAMPLE}` to `${template}`.

**Step 3: Remove the hardcoded TEMPLATE_EXAMPLE** (optional — keep as fallback)

Keep `TEMPLATE_EXAMPLE` as a fallback constant but it's no longer the primary source. The frontend passes the user's customized template.

**Step 4: Verify**

Run: `cd gapstrike && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add gapstrike/src/app/api/generate/route.ts
git commit -m "feat: accept template from request body in /api/generate"
```

---

## Task 11: Copy changes to obsidian-chat, build, and deploy

**Files:**
- Copy: `gapstrike/src/components/TemplatesView.tsx` → `obsidian-chat/src/components/TemplatesView.tsx`
- Copy: `gapstrike/src/app/page.tsx` → `obsidian-chat/src/app/page.tsx`
- Copy: `gapstrike/src/app/page.module.css` → `obsidian-chat/src/app/page.module.css`
- Copy: `gapstrike/src/app/api/generate/route.ts` → `obsidian-chat/src/app/api/generate/route.ts`

**Step 1: Copy files**

```bash
cp gapstrike/src/components/TemplatesView.tsx obsidian-chat/src/components/TemplatesView.tsx
cp gapstrike/src/app/page.tsx obsidian-chat/src/app/page.tsx
cp gapstrike/src/app/page.module.css obsidian-chat/src/app/page.module.css
cp gapstrike/src/app/api/generate/route.ts obsidian-chat/src/app/api/generate/route.ts
```

**Step 2: Build gapstrike**

Run: `cd gapstrike && npm run build`
Expected: Build succeeds with `/api/generate` and `/api/templates` routes listed.

**Step 3: Deploy**

Run: `cd gapstrike && npx vercel --prod`
Expected: Deploys to gapstrike-app.vercel.app.

**Step 4: Verify end-to-end**

1. Open `https://gapstrike.vercel.app/app`
2. Click the "Templates" tab
3. Verify 8 template cards appear (3 error note + 5 Anki)
4. Click one to edit, make a change, save
5. Refresh page, verify change persists
6. Test "Reset to Default"
7. Test note generation still works (Chat tab → extract → question → answer → note)

**Step 5: Commit**

```bash
git add .
git commit -m "feat: templates management — full end-to-end"
```

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `saas-shell/src/lib/types.ts` | Database types — add templates table |
| `saas-shell/src/lib/template-defaults.ts` | Default template content for seeding/reset |
| `saas-shell/src/app/api/templates/route.ts` | GET + PUT endpoints |
| `saas-shell/src/app/api/templates/reset/route.ts` | POST reset endpoint |
| `gapstrike/src/components/TemplatesView.tsx` | Grid + editor UI component |
| `gapstrike/src/app/page.tsx` | Main app — add tab, state, wiring |
| `gapstrike/src/app/page.module.css` | Template CSS styles |
| `gapstrike/src/app/api/generate/route.ts` | Accept template from request body |
