# Technology Stack

**Analysis Date:** 2026-03-06

## Languages

**Primary:**
- TypeScript 5.0.0 - Frontend applications in Next.js
- Python 3.x - Backend CrewAI server for error-note generation

**Secondary:**
- JavaScript - Next.js configuration
- YAML - Configuration files and frontmatter in notes
- Markdown - Knowledge vault structure

## Runtime

**Environment:**
- Node.js (version managed via package manager)
- Python 3.x (backend requirements via `usmle_error_note/requirements.txt`)

**Package Managers:**
- npm - Lockfile: `package-lock.json` present in both `obsidian-chat/` and `gapstrike/`
- pip - Python dependencies in `usmle_error_note/requirements.txt`

## Frameworks

**Core Frontend:**
- Next.js 15.1.3 - Full-stack React framework
- React 19.0.0 - UI component library
- React DOM 19.0.0 - DOM rendering

**Backend:**
- FastAPI - Python web framework for REST API
- CrewAI - Agent framework for multi-step workflows (questions generation, error analysis, note composition)
- Uvicorn[standard] - ASGI server for FastAPI

**Testing:**
- Not detected

**Build/Dev:**
- TypeScript 5.0.0 - Type checking
- Node types (@types/node 20.0.0)
- React types (@types/react, @types/react-dom 19.0.0)

## Key Dependencies

**Critical:**
- openai 4.77.3 - GPT-4, GPT-4o, GPT-4o-mini API client for extraction, question generation, and note composition
- @modelcontextprotocol/sdk 1.0.0 - MCP client for Obsidian vault integration (in obsidian-chat)
- @supabase/supabase-js 2.98.0 - Supabase client for user data storage (in gapstrike)

**Markdown & Content Processing:**
- mermaid 11.12.3 - Diagram rendering for flowcharts in notes
- turndown 7.2.2 - HTML to Markdown conversion
- tesseract.js 7.0.0 - OCR for screenshot text extraction

**Utilities:**
- dotenv 16.4.5 - Environment variable loading
- pyyaml - YAML parsing for Python backend

**Backend-specific:**
- crewai - CrewAI framework for agent-based workflows
- crewai-tools - CrewAI tool integrations
- python-dotenv - Environment variable management

## Configuration

**Environment:**
- `.env` files for secrets (not committed, `.gitignore` updated)
- `OPENAI_API_KEY` - Required for all LLM operations
- `NEXT_PUBLIC_SUPABASE_URL` - Public Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase authentication
- `DEFAULT_GITHUB_REPO` - Default GitHub repository (defaults to `vanioljantunes/usmle-vault`)
- AnkiConnect local endpoint: `http://localhost:8765`

**Build:**
- `next.config.js` - Next.js configuration with assetPrefix set to Vercel deployment URL
- `tsconfig.json` - TypeScript strict mode enabled, path aliases for `@/*` → `./src/*`
- `package.json` scripts: `dev`, `build`, `start`, `lint`

## Platform Requirements

**Development:**
- Node.js (for Next.js projects)
- Python 3.x with pip (for CrewAI backend)
- AnkiConnect running on localhost:8765 (for Anki integration)
- GitHub token in cookies for file operations (GitHub API integration)

**Production:**
- Vercel deployment (gapstrike and obsidian-chat)
- Python FastAPI server (usmle_error_note backend)
- Environment variables for OpenAI, Supabase, GitHub authentication
- Obsidian vault on local filesystem or GitHub repository

---

*Stack analysis: 2026-03-06*
