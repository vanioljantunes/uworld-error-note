# Structure

> Directory layout, key locations, naming conventions

## Top-Level Layout

```
crewAI/
├── gapstrike/            # Primary Next.js app (deployed to Vercel) — "USMLE Error Agent"
├── obsidian-chat/        # Earlier iteration of the app (local dev)
├── obsidian/             # Earliest iteration (local dev)
├── saas-shell/           # SaaS wrapper with auth/middleware
├── usmle_error_note/     # Python/CrewAI backend (FastAPI)
├── design_system/        # Design system reference (HTML + template sites)
├── templates/anki/       # Anki card templates (HTML)
├── docs/plans/           # Feature design docs and implementation plans
├── .claude/              # Claude Code config, skills, settings
├── .planning/            # GSD planning directory
└── model_config.yaml     # CrewAI model configuration
```

## App Variants (Evolution)

The codebase contains 3 iterations of the same app:

| Directory | Role | Status |
|-----------|------|--------|
| `obsidian/` | V1 — basic chat + notes | Superseded |
| `obsidian-chat/` | V2 — added Anki, templates, generation | Superseded |
| `gapstrike/` | V3 — current production app | Active, deployed |

All share the same architecture pattern (Next.js App Router, single `page.tsx` SPA).

## gapstrike/ (Primary App)

```
gapstrike/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main SPA — all UI state, views, panels
│   │   ├── page.module.css       # CSS Modules for page
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Global styles
│   │   ├── integrations/         # OAuth callback pages
│   │   │   └── github/callback/
│   │   └── api/                  # API routes (Next.js Route Handlers)
│   │       ├── auth/             # GitHub OAuth endpoints
│   │       ├── chat/             # LLM chat endpoint
│   │       ├── extract/          # UWorld text extraction
│   │       ├── generate/         # Note generation via CrewAI
│   │       ├── list-notes/       # Obsidian vault listing
│   │       ├── read-note/        # Read single note
│   │       ├── save-note/        # Save note to vault
│   │       ├── delete-note/      # Delete note from vault
│   │       ├── format-note/      # LLM note formatting
│   │       ├── format-card/      # LLM Anki card formatting
│   │       ├── rewrite/          # LLM rewrite endpoint
│   │       ├── create-card/      # Anki card creation
│   │       ├── anki-connect/     # AnkiConnect proxy
│   │       ├── templates/reset/  # Template reset endpoint
│   │       └── user-data/        # User preferences (Supabase)
│   ├── components/
│   │   ├── FlowView.tsx          # Flow/study view with Anki panel
│   │   ├── TemplatesView.tsx     # Template management
│   │   ├── QuestionEditor.tsx    # MC question editor
│   │   ├── TableEditor.tsx       # Table-format card editor
│   │   ├── MermaidStructEditor.tsx # Mermaid diagram editor
│   │   └── NoteGraph.tsx         # Note relationship graph
│   └── lib/
│       ├── auth.ts               # GitHub OAuth helpers
│       ├── github.ts             # GitHub API client
│       ├── supabase.ts           # Supabase client
│       ├── user-data.ts          # User data persistence
│       ├── render-markdown.ts    # Markdown rendering
│       └── template-defaults.ts  # Default Anki templates
├── package.json
├── tsconfig.json
├── next.config.js
├── vercel.json
└── .env.local.vercel
```

## usmle_error_note/ (Python Backend)

```
usmle_error_note/
├── main.py               # FastAPI app entry, /questions and /generate endpoints
├── config/               # CrewAI agent/task YAML configs
├── templates/            # Prompt templates
└── __pycache__/
```

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Directories | kebab-case | `obsidian-chat/`, `list-notes/` |
| Components | PascalCase | `FlowView.tsx`, `TableEditor.tsx` |
| Lib files | kebab-case | `user-data.ts`, `render-markdown.ts` |
| API routes | kebab-case dirs | `api/format-card/route.ts` |
| CSS modules | camelCase selectors | `page.module.css` → `styles.comboboxWrap` |
| Constants | SCREAMING_SNAKE | `CREWAI_URL`, `VAULT_PATH` |
| Functions | camelCase | `fetchNextQuestion()`, `ankiConnect()` |
| Interfaces | PascalCase | `Note`, `Template` |

## Key Entry Points

- **UI**: `gapstrike/src/app/page.tsx` — single-page app, all view modes
- **API**: `gapstrike/src/app/api/*/route.ts` — Next.js Route Handlers
- **Backend**: `usmle_error_note/main.py` — FastAPI with CrewAI
- **Styles**: `gapstrike/src/app/page.module.css` — CSS Modules
- **Design ref**: `design_system/design-system.html` — mandatory design tokens