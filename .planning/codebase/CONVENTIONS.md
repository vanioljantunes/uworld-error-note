# Conventions

> Code style, naming, patterns, error handling

## Language & Style

- **TypeScript** with strict mode enabled across all Next.js apps
- **Python 3** for CrewAI backend (`usmle_error_note/`)
- 2-space indentation (TS/TSX), double quotes
- Next.js default ESLint config (`next/core-web-vitals`)
- No Prettier config found — relies on editor defaults
- Path aliases: `@/*` maps to `src/*` in all apps

## Component Patterns

### Single-File SPA
The primary UI (`gapstrike/src/app/page.tsx`) is a large single-page component with:
- All view state managed via `useState` hooks at top level
- View modes toggled by string state (`viewMode: "notes" | "anki" | "flow" | "templates"`)
- Conditional rendering blocks based on view mode
- No Redux/Zustand — pure React state

### Component Extraction
Heavier UI sections extracted to `src/components/`:
- `FlowView.tsx` — Flow study mode with embedded Anki panel
- `TemplatesView.tsx` — Template CRUD management
- `QuestionEditor.tsx` — MC question display/interaction
- `TableEditor.tsx`, `MermaidStructEditor.tsx` — specialized editors

### CSS Modules
- One CSS Module per page: `page.module.css`
- camelCase class names: `styles.comboboxWrap`, `styles.viewToggleDivider`
- No CSS-in-JS or Tailwind — pure CSS Modules
- Global styles in `globals.css`

## API Route Patterns

All API routes follow the same structure:

```typescript
// src/app/api/{endpoint}/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // ... logic ...
    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message || "Something went wrong" },
      { status: 500 }
    );
  }
}
```

Key patterns:
- `NextRequest`/`NextResponse` from `next/server`
- `try/catch` with `error: any` (no typed errors)
- `console.error()` for logging (no structured logging)
- JSON request/response throughout
- No middleware for auth on most routes (except `saas-shell`)

## Error Handling

- **Frontend**: `try/catch` around fetch calls, error shown in UI state
- **API routes**: Generic `catch (error: any)` → 500 response with `error.message`
- **Python backend**: FastAPI exception handlers, returns JSON errors
- No global error boundary in React
- No retry logic on failed API calls

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Functions | camelCase | `fetchNextQuestion`, `ankiConnect` |
| Components | PascalCase | `FlowView`, `QuestionEditor` |
| Constants | SCREAMING_SNAKE | `CREWAI_URL`, `VAULT_PATH` |
| Interfaces | PascalCase | `Note`, `Template`, `QuestionsRequest` |
| API routes | kebab-case dirs | `api/format-card/route.ts` |
| CSS classes | camelCase | `.comboboxToggle`, `.viewToggleDivider` |
| Files (lib) | kebab-case | `user-data.ts`, `render-markdown.ts` |
| Files (components) | PascalCase | `FlowView.tsx` |

## Data Flow

```
User Action → page.tsx state update
  → fetch("/api/{endpoint}")
    → API route (may call external: CrewAI backend, AnkiConnect, GitHub API, Supabase)
  → setState with response
  → Re-render
```

## Environment Variables

- `VAULT_PATH` — Local Obsidian vault path (hardcoded Windows paths in some routes)
- `CREWAI_URL` — Python backend URL (default `http://localhost:8000`)
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` — LLM provider keys
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — OAuth
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase

## Documentation

- No JSDoc comments — type annotations serve as documentation
- No README in `gapstrike/` (primary app)
- Design system reference: `design_system/design-system.html`
- Feature plans in `docs/plans/` as markdown