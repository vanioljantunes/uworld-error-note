# Concerns

> Technical debt, bugs, security, performance, fragile areas

## High Priority

### 1. No Test Coverage
- Zero test files across entire codebase
- No test framework configured
- All verification is manual
- Risk: regressions go undetected, especially in complex state flows

### 2. Security — Hardcoded Secrets Pattern
- `.env.local.vercel` committed alongside code
- API keys referenced in multiple route files
- No rate limiting on any API endpoints
- GitHub tokens handled in client-accessible patterns
- `catch (error: any)` may leak internal details to clients

### 3. Hardcoded Windows Paths
- `VAULT_PATH` contains hardcoded Windows paths (e.g., `C:\Users\vanio\...`)
- Not portable across machines or OS
- Prevents deployment to non-Windows environments
- Found in multiple API routes: `list-notes`, `read-note`, `save-note`, `delete-note`

## Medium Priority

### 4. Monolithic Page Component
- `gapstrike/src/app/page.tsx` is a single massive file containing all UI logic
- All state lives at the top level via `useState`
- Difficult to reason about, maintain, or extract features
- Any change risks breaking unrelated view modes

### 5. Three App Copies
- `obsidian/`, `obsidian-chat/`, `gapstrike/` are evolutionary copies
- Code diverges between them — bug fixes in one don't propagate
- `obsidian/` and `obsidian-chat/` appear abandoned but still exist
- Confusing for navigation and maintenance

### 6. Untyped Error Handling
- `catch (error: any)` used in all 40+ catch blocks
- No custom error types or error codes
- Error messages are inconsistent strings
- No structured logging — just `console.error()`

### 7. No Auth on Most API Routes
- Only `saas-shell` has middleware-based auth
- `gapstrike` API routes have no authentication
- Anyone with the URL could call `/api/save-note`, `/api/delete-note`, etc.
- Acceptable for local dev, but risky if exposed

## Lower Priority

### 8. LLM Output Parsing
- LLM responses parsed with basic string manipulation / `JSON.parse()`
- No schema validation (no Zod, no JSON schema)
- Malformed LLM output can cause runtime errors
- No fallback or retry on parse failure

### 9. Performance — File System Walking
- `list-notes` walks the entire vault directory on every call
- No caching or indexing layer
- Tag collection reads frontmatter from every file
- Acceptable for small vaults, will degrade with scale

### 10. Frontend Performance
- Large single component re-renders on any state change
- No `useMemo`/`useCallback` optimization visible
- Multiple `useEffect` hooks with broad dependency arrays
- Markdown rendering on every keystroke (no debounce in some paths)

### 11. Python Backend Coupling
- Frontend assumes `CREWAI_URL` is always available
- No graceful degradation if Python backend is down
- Single-threaded CrewAI execution — one request at a time
- No queue or async task management

## Technical Debt Summary

| Area | Severity | Effort to Fix |
|------|----------|---------------|
| No tests | High | Large |
| Hardcoded paths | High | Small |
| Monolithic page.tsx | Medium | Large |
| App copies | Medium | Medium (delete old) |
| Untyped errors | Medium | Medium |
| No API auth | Medium | Medium |
| LLM parsing | Medium | Small |
| File walking perf | Low | Medium |
| Frontend perf | Low | Medium |
| Backend coupling | Low | Small |