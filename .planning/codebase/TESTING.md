# Testing

> Framework, structure, mocking, coverage

## Current State

**No testing infrastructure exists in this codebase.**

- No test files found (no `*.test.ts`, `*.spec.ts`, `*.test.tsx`)
- No test framework configured (no Jest, Vitest, Playwright, Cypress)
- No test scripts in any `package.json`
- No CI/CD pipeline with automated tests

## What Would Need Testing

### Frontend (`gapstrike/src/app/page.tsx`)
- View mode switching logic
- Combobox component behavior (search, filter, select)
- Question flow state machine (fetch → answer → generate → post-gen choice)
- Anki card creation/formatting pipeline
- Template CRUD operations

### API Routes (`gapstrike/src/app/api/`)
- Note CRUD operations (list, read, save, delete)
- LLM integration routes (extract, generate, format, rewrite, chat)
- AnkiConnect proxy
- Auth flow (GitHub OAuth)
- User data persistence

### Python Backend (`usmle_error_note/`)
- Question generation endpoint
- Note generation endpoint
- CrewAI agent/task configuration
- Template rendering

## Recommended Approach (if testing is added)

- **Unit tests**: Vitest (Next.js native support) for API routes and lib functions
- **Component tests**: React Testing Library for UI components
- **E2E tests**: Playwright for critical user flows
- **Backend tests**: pytest for FastAPI endpoints

## Verification

Currently, the codebase is verified through:
- Manual testing in development
- TypeScript compiler checks (`tsc`)
- ESLint (`next lint`)
- Vercel deployment previews