# Architecture

**Analysis Date:** 2026-03-06

## Pattern Overview

**Overall:** Multi-tier federated system with three independent Next.js frontends, one centralized FastAPI backend orchestrator, and a CrewAI agent framework layer.

**Key Characteristics:**
- Frontend-backend separation via REST APIs (Next.js server routes + FastAPI endpoints)
- LLM-driven agents (CrewAI crews) handle complex workflows
- Vault-based note storage (Obsidian/filesystem)
- Anki integration via AnkiConnect protocol
- Pluggable agents for questions, error analysis, formatting, Anki operations
- Stateless request-response model with optional streaming support

## Layers

**Presentation (Frontend):**
- Purpose: User interface for USMLE error analysis and Anki study
- Location: `obsidian-chat/src/app/`, `gapstrike/src/app/`, `saas-shell/`
- Contains: React components, page modules, API route handlers
- Depends on: Next.js 15, OpenAI SDK (client-side), Supabase (gapstrike only), local browser storage
- Used by: End users through browser

**API Integration (Next.js Server Routes):**
- Purpose: Bridge frontend to backend services; encapsulate API keys; handle image uploads
- Location: `obsidian-chat/src/app/api/*/route.ts`, `gapstrike/src/app/api/*/route.ts`
- Contains: POST handlers for extraction, questions, generation, Anki operations
- Depends on: OpenAI API (extract, generate, format), FastAPI backend (questions, generate via CrewAI), AnkiConnect (direct socket)
- Used by: Frontend React components via fetch()

**Backend Orchestrator (FastAPI):**
- Purpose: Centralized hub for CrewAI workflows, vault I/O, and AnkiConnect proxying
- Location: `usmle_error_note/server.py`
- Contains: 20+ endpoints for questions, note generation, formatting, Anki search/update/create, Key Notes
- Depends on: CrewAI framework, Pydantic models, filesystem (vault), AnkiConnect protocol
- Used by: Next.js API routes + standalone tools

**Agent Framework (CrewAI):**
- Purpose: Orchestrate multi-step workflows with LLM agents and tools
- Location: `usmle_error_note/crew.py`
- Contains: Agent/Task/Crew definitions; four crews: questions, error-note, format, Anki search
- Depends on: Anthropic/OpenAI LLMs, vault tools, Pydantic output models
- Used by: FastAPI endpoints; can be used standalone

**Tools Layer (Vault & Anki):**
- Purpose: Abstract vault filesystem operations and AnkiConnect calls
- Location: `usmle_error_note/tools.py`, FastAPI endpoints for AnkiConnect
- Contains: vault read/write/list/search, AnkiConnect HTTP wrapper
- Depends on: OS filesystem, AnkiConnect HTTP API
- Used by: CrewAI agents and FastAPI endpoints

**Data Models:**
- Purpose: Pydantic schemas for request/response validation
- Location: `usmle_error_note/models.py`, inline in Next.js routes
- Contains: ExtractionInput, QuestionsRequest/Response, GenerateRequest/Response, AnkiCard, KeyNoteRequest/Response
- Depends on: Pydantic framework
- Used by: All layers for serialization/validation

## Data Flow

**Extraction → Questions → Answers → Note Generation:**

1. User uploads screenshot(s) in frontend
2. Frontend calls `/api/extract` (Next.js route)
3. Next.js route calls OpenAI Vision API directly → returns structured JSON
4. Frontend stores extraction, initiates Phase 1
5. Frontend calls `/api/questions` (Next.js route)
6. Next.js route calls FastAPI `POST /questions`
7. FastAPI spawns questions_crew → returns 1 MC question at specified difficulty
8. Frontend presents question, collects answer
9. User answers diagnostic question(s) or skips
10. Frontend calls `/api/generate` (Next.js route)
11. Next.js route calls FastAPI `POST /generate`
12. FastAPI spawns error_note_crew (3 tasks: infer error, compose note, format note)
13. Crew infers 1 primary knowledge gap, writes Obsidian micro-note to vault
14. FastAPI returns NoteResult with file_path, tags, content
15. Frontend displays generated note, offers create-card or more-questions

**Anki Card Flow:**

1. User clicks "Create Card" on a note in obsidian-chat
2. Frontend calls `/api/anki/direct-search` (FastAPI) with tag/ID
3. FastAPI calls AnkiConnect `findCards` + `cardsInfo` + `notesInfo`
4. Returns AnkiCard list with front/back fields (generic field mapping)
5. User edits card in editor panel
6. Frontend calls `/api/anki/update` → FastAPI calls AnkiConnect `updateNoteFields`
7. Or: Frontend calls `/api/anki/add-note` → FastAPI calls AnkiConnect `addNote`

**Anki Card Formatting Flow:**

1. User clicks format icon in editor
2. Frontend calls `/api/anki/format-card` (FastAPI)
3. FastAPI spawns anki_format_crew with template content
4. Crew reformats front/back via LLM
5. FastAPI returns formatted AnkiCardFormatOutput
6. Frontend updates editor with formatted content

**Key Note Synthesis Flow:**

1. User clicks "Synthesize Key Note" on a note in gapstrike
2. Frontend calls `/api/keynote` (FastAPI)
3. FastAPI walks vault, finds all notes with wikilink to current note
4. Spawns keynote_crew with current note + referencing notes
5. Crew synthesizes a "Key Note" summarizing the concept across all references
6. FastAPI writes Key Note to vault
7. Returns suggested filename + content

## Key Abstractions

**Extraction (ExtractionInput):**
- Purpose: Standardizes USMLE question data from OCR/LLM parsing
- Examples: `question_id`, `choosed_alternative`, `wrong_alternative`, `full_explanation`
- Pattern: Immutable input to all downstream workflows; no modification after initial extraction

**ErrorPatternOutput / NoteResult:**
- Purpose: Represents a single knowledge gap and resulting micro-note
- Examples: tag list, file path, error pattern slug, markdown content
- Pattern: Strict 1:1 gap-to-note mapping; enforced by Pydantic min_length=1, max_length=1

**MCQuestion (QuestionsOutput):**
- Purpose: Diagnostic multiple-choice question for hypothesis testing
- Examples: question text, 3-4 options, correct index, difficulty level
- Pattern: Questions are stateless; difficulty cycles hard → medium → easy by count % 3

**AnkiCard:**
- Purpose: Represents a single Anki flashcard with generic field mapping
- Examples: note_id, card_id, front, back, deck, tags, field_names
- Pattern: Field names are discovered from AnkiConnect response; code maps first two fields generically

## Entry Points

**Frontend Apps:**

`obsidian-chat/src/app/page.tsx` (USMLE Error Agent):
- Triggers: User uploads screenshot or opens app
- Responsibilities: Display extraction, run diagnostic questions, generate notes, search/edit Anki cards
- State: `workflowStep`, `extractedJson`, `currentQuestion`, `previousQuestions`, `questionAnswers`, UI mode (flow/chat/editor/anki)

`gapstrike/src/app/page.tsx` (GapStrike main app):
- Triggers: User logs in (GitHub OAuth), selects vault, navigates app
- Responsibilities: All obsidian-chat features + templates management + Key Note synthesis
- State: Extends obsidian-chat with `templates`, `userVault`, `supabaseUser` (auth)

**API Entry Points:**

`obsidian-chat/src/app/api/extract/route.ts`:
- Accepts: POST with base64 images
- Returns: Structured extraction JSON
- Does: Calls OpenAI Vision gpt-4o with system prompt for USMLE parsing

`obsidian-chat/src/app/api/questions/route.ts` (Next.js wrapper):
- Accepts: POST with extraction, previous_questions, difficulty_target
- Returns: QuestionsResponse (array of MCQuestion)
- Does: Proxies to FastAPI `POST /questions`

`obsidian-chat/src/app/api/generate/route.ts` (Next.js wrapper):
- Accepts: POST with extraction, questions[], answers[], template
- Returns: ErrorNoteResult (notes array + questions_recap)
- Does: Proxies to FastAPI `POST /generate`

`usmle_error_note/server.py`:

**POST /questions:**
- Accepts: QuestionsRequest (extraction, previous_questions, difficulty_target, vault_path)
- Returns: QuestionsResponse (questions array)
- Does: Builds questions_crew, saves extraction to vault's question_index.json, returns 1 question

**POST /generate:**
- Accepts: GenerateRequest (extraction, questions[], answers[], vault_path)
- Returns: GenerateResponse (notes + questions_recap)
- Does: Builds error_note_crew (3 tasks), guarantees note written to vault, returns structured output

**POST /format:**
- Accepts: FormatRequest (vault_path, note_path, selected_template, custom_instructions)
- Returns: FormatResponse (formatted_content)
- Does: Reads note, builds format_crew, writes formatted content back

**POST /anki/direct-search:**
- Accepts: AnkiSearchRequest (query)
- Returns: AnkiSearchResponse (cards array)
- Does: Calls AnkiConnect findCards/cardsInfo/notesInfo, returns generic field mapping

**POST /anki/format-card:**
- Accepts: AnkiFormatCardRequest (front, back, template_filename)
- Returns: AnkiFormatCardResponse (front, back)
- Does: Loads template, builds anki_format_crew, returns LLM-formatted fields

**POST /anki/create-card:**
- Accepts: AnkiCreateCardRequest (vault_path, note_path, template_filename)
- Returns: AnkiCreateCardResponse (front, back)
- Does: Reads note from vault, builds anki_create_crew, generates card fields

**POST /anki/add-note:**
- Accepts: AnkiAddNoteRequest (deck, model, front, back, tags, field_names)
- Returns: AnkiAddNoteResponse (success, note_id)
- Does: Calls AnkiConnect addNote

## Error Handling

**Strategy:** Try-catch at API boundaries; return structured error responses with HTTP status codes

**Patterns:**
- Image extraction fails → NextResponse.json({ error: "..." }, { status: 400 })
- LLM returns non-JSON → Strip markdown code fences, try parse again; if still fails, return parseError: true
- Vault file missing → FastAPI returns 404 in response body
- AnkiConnect not reachable → HTTPException(status_code=503, detail="AnkiConnect not reachable")
- CrewAI task fails → Return fallback (parsed JSON, raw text, or default output)

## Cross-Cutting Concerns

**Logging:** Console.log in frontend; print() in FastAPI; verbose=True in CrewAI agents

**Validation:** Pydantic models enforce schema; OpenAI temperature tuning (0 for extract, 0.5 for generate, 0.7 for questions)

**Authentication:** GitHub OAuth in gapstrike; API keys loaded from .env (OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY)

**Vault Path Handling:** Set globally before crew kickoff via `set_vault_path(vault_path)`; passed explicitly in FastAPI request bodies

**Anki Integration:** Direct HTTP to AnkiConnect on localhost:8765; no auth required; error handling for unreachable condition

---

*Architecture analysis: 2026-03-06*
