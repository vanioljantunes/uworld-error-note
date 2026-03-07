# Templates Management — Design Doc

## Problem

Templates are hardcoded as local `.md` files and embedded directly in API routes. Users can't customize them. The deployed app on Vercel can't read from disk, so the `/api/generate` route uses a copy-pasted template that may drift from the source of truth.

## Decision

Add a **Templates** tab to the app where users can view and edit all 8 templates. Templates are stored per-user in Supabase and passed to LLM API routes at call time.

## Architecture

### Database

New `templates` table in Supabase:

```sql
CREATE TABLE templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'error_note' | 'anki'
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

8 fixed slugs, seeded on first access:

| Slug | Category | Title | Default Source |
|------|----------|-------|---------------|
| `error_note_a` | error_note | Error Note A | templates/template_a.md |
| `error_note_b` | error_note | Error Note B | templates/template_b.md |
| `error_note_c` | error_note | Error Note C | templates/template_c.md |
| `anki_line_of_thought` | anki | Line of Thought | templates/anki/line_of_thought.md |
| `anki_questions` | anki | Questions | templates/anki/questions.md |
| `anki_table` | anki | Table | templates/anki/table.md |
| `anki_mermaid` | anki | Mermaid Flowchart | templates/anki/mermaid.md |
| `anki_cloze_basic` | anki | Cloze Basic | templates/anki/cloze_basic.md |

### API (saas-shell)

**`GET /api/templates`** — Returns all templates for the authenticated user. If no rows exist, seeds defaults and returns them.

**`PUT /api/templates`** — Body: `{ slug: string, content: string }`. Updates one template.

**`POST /api/templates/reset`** — Body: `{ slug: string }`. Resets one template to its default content.

### Type Update

Add `templates` table to `saas-shell/src/lib/types.ts` Database type.

### UI (gapstrike app)

New `viewMode: "templates"` in `page.tsx`. Renders a `TemplatesView` component.

**Grid view (default):** Two sections — "Error Note Templates" (3 cards) and "Anki Card Templates" (5 cards). Each card shows title, first ~80 chars of content as preview, and "Edited X ago" or "Default" status.

**Editor view (on card click):** Full-width monospace textarea. Top bar: back arrow, template title, "Reset to Default" button, "Save" button. Footer: last edited date.

Templates are fetched once when the Templates tab is opened and cached in component state.

### Integration with LLM APIs

The frontend passes template content in the request body when calling:
- `/api/generate` — receives `template_a` content for note generation
- `/api/questions` — no template needed (already self-contained)
- Anki format endpoints — receive the relevant anki template content

The `/api/generate` route removes its hardcoded `TEMPLATE_EXAMPLE` and uses the template from the request body instead.

### Data Flow

```
User opens Templates tab
  → GET /api/templates (proxied to saas-shell)
  → saas-shell checks Supabase for user's templates
  → If none: seed 8 defaults, return them
  → If exists: return them
  → Frontend renders grid

User edits a template
  → PUT /api/templates { slug, content } (proxied to saas-shell)
  → saas-shell updates row in Supabase
  → Frontend updates local state

User generates a note (Chat tab)
  → Frontend reads template_a from cached templates state
  → POST /api/generate { extraction, questions, answers, template }
  → /api/generate uses provided template in LLM prompt
```

## Files Changed

### New files
- `saas-shell/src/app/api/templates/route.ts` — GET + PUT
- `saas-shell/src/app/api/templates/reset/route.ts` — POST reset
- `gapstrike/src/components/TemplatesView.tsx` — grid + editor UI
- `gapstrike/src/app/page.module.css` — template-related styles

### Modified files
- `saas-shell/src/lib/types.ts` — add templates table type
- `gapstrike/src/app/page.tsx` — add Templates tab, viewMode, pass templates to generate
- `gapstrike/src/app/api/generate/route.ts` — accept template from request body
- `gapstrike/src/app/page.module.css` — template styles
