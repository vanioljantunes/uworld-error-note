# External Integrations

**Analysis Date:** 2026-03-06

## APIs & External Services

**Language Models (OpenAI):**
- OpenAI GPT-4 / GPT-4o - Used in generation, question creation, error analysis
  - SDK/Client: `openai` 4.77.3
  - Auth: `OPENAI_API_KEY` environment variable
  - Endpoints used:
    - `chat.completions.create()` - For text generation, JSON extraction, prompt-based workflows

**Model Context Protocol (MCP):**
- mcp-obsidian - Stdio-based MCP transport for Obsidian vault access (obsidian-chat only)
  - Client: `@modelcontextprotocol/sdk` 1.0.0
  - Implementation: `src/app/api/chat/route.ts` initializes `StdioClientTransport` with `npx mcp-obsidian [vaultPath]`
  - Tools exposed:
    - `search` - Search notes by query and optional tag filters
    - `read_note` - Read full content of a note by path
  - Vault path: Configured via `VAULT_PATH` constant or request parameter

**Screenshot/Document Processing:**
- Tesseract.js (OCR) - Extracts text from UWorld/medical screenshots
  - SDK/Client: `tesseract.js` 7.0.0
  - Used in: `gapstrike/src/app/api/extract/route.ts` for image quadrant analysis

**Markdown/HTML Conversion:**
- Turndown - Converts HTML explanations to Markdown
  - SDK/Client: `turndown` 7.2.2
  - Purpose: Format UWorld explanations for note generation

**Diagram Rendering:**
- Mermaid - Renders flowcharts and structural diagrams in notes
  - SDK/Client: `mermaid` 11.12.3
  - Usage: Embedded in note content for visual medical concept maps

## Data Storage

**Databases:**
- Supabase PostgreSQL
  - Connection: `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or anon key)
  - Client: `@supabase/supabase-js` 2.98.0
  - Location: `gapstrike/src/lib/supabase.ts` initializes client
  - Purpose: User data, settings, template defaults (inferred from user-data.ts)

**File Storage:**
- GitHub Repository - Primary vault storage
  - Service: GitHub API (REST)
  - Auth: GitHub personal access token stored in cookies (`github_token`)
  - Endpoints: GitHub Contents API for file operations
    - `GET /repos/{owner}/{repo}/contents/{path}` - Read note
    - `PUT /repos/{owner}/{repo}/contents/{path}` - Create/update note
    - `DELETE /repos/{owner}/{repo}/contents/{path}` - Delete note
    - `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1` - List all files
  - Default repo: `vanioljantunes/usmle-vault` (configurable via `DEFAULT_GITHUB_REPO`)
  - Implementation: `gapstrike/src/lib/github.ts` wraps all GitHub API calls
  - Local file system fallback for obsidian-chat (direct file I/O)

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- GitHub OAuth (custom implementation)
  - Method: GitHub personal access token stored in HTTP-only cookies
  - Cookie name: `github_token`
  - Validation: `getGithubUserId()` in `gapstrike/src/lib/auth.ts` verifies token by calling GitHub `/user` endpoint
  - Session: Token persists in cookies across requests

**User Identification:**
- GitHub user ID prefixed with `github_` (e.g., `github_12345678`)
- Used for user-scoped data in Supabase

## Monitoring & Observability

**Error Tracking:**
- Not detected (console.error used for local logging)

**Logs:**
- Server-side: Node.js console.log/error in Next.js API routes
- Server-side: Python print() statements in FastAPI backend
- Client-side: Browser console (no external logging service)

## CI/CD & Deployment

**Hosting:**
- Vercel - Hosts both gapstrike and obsidian-chat Next.js applications
  - Asset prefix: `https://gapstrike-app.vercel.app`
  - Environment variables deployed via Vercel dashboard

**Backend Server:**
- Self-hosted Python FastAPI server (usmle_error_note/)
  - CORS enabled for: `http://localhost:3000`, `http://127.0.0.1:3000`
  - Runs on default FastAPI port (typically 8000)

**CI Pipeline:**
- Not detected

## Environment Configuration

**Required env vars (Frontend - gapstrike):**
- `OPENAI_API_KEY` - OpenAI API access
- `NEXT_PUBLIC_SUPABASE_URL` - Public Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Database auth
- `DEFAULT_GITHUB_REPO` - GitHub repository name (optional, defaults to `vanioljantunes/usmle-vault`)

**Required env vars (Frontend - obsidian-chat):**
- `OPENAI_API_KEY` - OpenAI API access

**Required env vars (Backend - usmle_error_note):**
- `OPENAI_API_KEY` - OpenAI API access
- Loaded via `python-dotenv` from `.env` file

**Runtime Configuration:**
- Obsidian vault path: Passed via request body or defaults to `C:\\Users\\vanio\\OneDrive\\Área de Trabalho\\teste_crew\\teste`
- AnkiConnect endpoint: Hardcoded to `http://localhost:8765`

**Secrets location:**
- GitHub token: HTTP-only cookie (browser-managed, set via auth flow)
- API keys (.env): Local development only, deployed to Vercel/server environment

## Webhooks & Callbacks

**Incoming:**
- GitHub save fallback: When server save fails in obsidian-chat, client falls back to `obsidian://` URI protocol
  - Implementation: Not full webhook, but protocol-based fallback

**Outgoing:**
- None detected

## API Rate Limits & Constraints

**OpenAI:**
- No explicit rate limiting in code; relies on OpenAI account quotas
- max_tokens set per request (varies: 1024-4096 depending on endpoint)

**GitHub:**
- Uses GitHub API v3 rate limits (60 requests/minute for unauthenticated, 5000/hour authenticated)
- All requests authenticated with bearer token

**Supabase:**
- Standard Supabase rate limits apply (plan-dependent)

---

*Integration audit: 2026-03-06*
