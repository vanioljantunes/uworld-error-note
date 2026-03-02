"""FastAPI server bridging the Next.js frontend to the CrewAI backend.

Endpoints:
  POST /questions  — Phase 1: generate diagnostic questions
  POST /generate   — Phases 2-4: infer error, compose & write note (+ format)
  POST /tags       — Return all tags from the vault
  POST /format     — Standalone: reformat an existing note using templates
"""

import itertools
import json
import os
import re
import traceback
import urllib.request
from contextlib import asynccontextmanager

import yaml
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

from models import (
    QuestionsRequest,
    QuestionsResponse,
    GenerateRequest,
    GenerateResponse,
    NoteResult,
    MultiNoteResult,
    AnkiSearchRequest,
    AnkiSearchResponse,
    AnkiCard,
    AnkiUpdateRequest,
    AnkiUpdateResponse,
    AnkiFormatCardRequest,
    AnkiFormatCardResponse,
    AnkiCardFormatOutput,
    AnkiCreateCardRequest,
    AnkiCreateCardResponse,
    AnkiAddNoteRequest,
    AnkiAddNoteResponse,
    KeyNoteRequest,
    KeyNoteResponse,
)
from crew import build_questions_crew, build_error_note_crew, build_format_crew, list_templates, build_anki_crew, build_anki_format_crew, build_keynote_crew, build_anki_create_crew
from tools import set_vault_path, get_vault_path



_ANKI_TEMPLATES_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "templates", "anki")
)

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 UWorld Error-Note CrewAI server starting...")
    yield
    print("👋 Server shutting down.")


app = FastAPI(
    title="UWorld Error-Note CrewAI",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helper: parse frontmatter tags ────────────────────────────────────────

def _collect_vault_tags(vault_path: str) -> list[str]:
    """Walk all .md files in the vault and collect unique tags from YAML frontmatter."""
    all_tags: set[str] = set()
    if not vault_path or not os.path.isdir(vault_path):
        return []
    for root, dirs, files in os.walk(vault_path):
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for f in files:
            if f.endswith(".md"):
                full = os.path.join(root, f)
                try:
                    with open(full, "r", encoding="utf-8") as fh:
                        content = fh.read()
                    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
                    if match:
                        fm = yaml.safe_load(match.group(1)) or {}
                        tags = fm.get("tags", [])
                        if isinstance(tags, list):
                            all_tags.update(str(t) for t in tags)
                except Exception:
                    continue
    return sorted(all_tags)


# ── Helper: strip markdown code fences ────────────────────────────────────

def _strip_code_fence(text: str) -> str:
    """Remove wrapping ```markdown ... ``` (or any language tag) from text."""
    text = text.strip()
    m = re.match(r'^```[a-zA-Z]*\s*\n([\s\S]*?)```\s*$', text)
    if m:
        return m.group(1).strip()
    return text


# ── Helper: guaranteed file write ─────────────────────────────────────────

def _ensure_note_written(vault_path: str, file_path: str, note_content: str) -> str:
    """Write the note to disk if it doesn't already exist. Returns the actual path."""
    if not vault_path or not file_path or file_path == "unknown":
        return file_path

    full = os.path.join(vault_path, file_path.replace("/", os.sep))

    # Check if the file already exists (agent may have written it)
    if os.path.isfile(full):
        print(f"✅ Note already exists at: {full}")
        return file_path

    # Write it ourselves
    try:
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as fh:
            fh.write(note_content)
        print(f"📝 Server wrote note to: {full}")
    except Exception as e:
        print(f"❌ Failed to write note: {e}")

    return file_path


# ── POST /tags — Return all vault tags ────────────────────────────────────

class TagsRequest(BaseModel):
    vault_path: str

class TagsResponse(BaseModel):
    tags: List[str]

@app.post("/tags", response_model=TagsResponse)
async def get_tags(req: TagsRequest):
    tags = _collect_vault_tags(req.vault_path)
    return TagsResponse(tags=tags)


# ── Phase 1: Generate diagnostic questions ────────────────────────────────

@app.post("/questions", response_model=QuestionsResponse)
async def generate_questions(req: QuestionsRequest):
    ext = req.extraction

    # Truncate explanation to ~300 chars for the prompt
    explanation_summary = (ext.full_explanation or "")[:300]
    if len(ext.full_explanation or "") > 300:
        explanation_summary += "..."

    inputs = {
        "question_id": ext.question_id or "unknown",
        "question": ext.question or "N/A",
        "choosed_alternative": ext.choosed_alternative or "N/A",
        "wrong_alternative": ext.wrong_alternative or "N/A",
        "educational_objective": ext.educational_objective or "N/A",
        "explanation_summary": explanation_summary,
    }

    try:
        crew = build_questions_crew(inputs)
        result = crew.kickoff()

        # Extract questions from pydantic output
        if hasattr(result, "pydantic") and result.pydantic:
            mc_questions = result.pydantic.questions
            questions = [q.model_dump() if hasattr(q, "model_dump") else {"question": str(q), "options": [], "correct": 0, "difficulty": "medium"} for q in mc_questions]
        else:
            # Fallback: parse from raw text
            raw = str(result)
            try:
                parsed = json.loads(raw)
                raw_qs = parsed.get("questions", [])
                questions = []
                for q in raw_qs:
                    if isinstance(q, dict):
                        questions.append(q)
                    else:
                        questions.append({"question": str(q), "options": [], "correct": 0, "difficulty": "medium"})
            except json.JSONDecodeError:
                questions = [{"question": raw, "options": [], "correct": 0, "difficulty": "medium"}]

        return QuestionsResponse(questions=questions)

    except Exception as e:
        traceback.print_exc()
        return QuestionsResponse(
            questions=[{"question": f"Error: {str(e)}", "options": [], "correct": 0, "difficulty": "medium"}]
        )


# ── Phases 2-4: Infer error, compose & write note (+ format) ─────────────

@app.post("/generate", response_model=GenerateResponse)
async def generate_note(req: GenerateRequest):
    ext = req.extraction

    # Set vault path for tools
    set_vault_path(req.vault_path)

    explanation_summary = (ext.full_explanation or "")[:300]
    if len(ext.full_explanation or "") > 300:
        explanation_summary += "..."

    questions_json = json.dumps(req.questions)
    answers_json = json.dumps(req.answers)

    inputs = {
        "question_id": ext.question_id or "unknown",
        "question": ext.question or "N/A",
        "choosed_alternative": ext.choosed_alternative or "N/A",
        "wrong_alternative": ext.wrong_alternative or "N/A",
        "educational_objective": ext.educational_objective or "N/A",
        "explanation_summary": explanation_summary,
        "questions_json": questions_json,
        "answers_json": answers_json,
        "error_pattern_json": "Will be determined by previous task in the crew.",
    }

    try:
        crew = build_error_note_crew(inputs)
        result = crew.kickoff()

        # The crew has 3 tasks: infer → compose → format
        # Task 2 (compose) outputs MultiNoteResult (list of notes)
        # Task 3 (format) returns formatted text for the notes

        notes: list[NoteResult] = []

        # Get structured notes from task 2 (compose_note)
        if hasattr(result, "tasks_output") and len(result.tasks_output) >= 2:
            compose_output = result.tasks_output[1]
            if hasattr(compose_output, "pydantic") and compose_output.pydantic:
                multi = compose_output.pydantic
                if isinstance(multi, MultiNoteResult):
                    notes = list(multi.notes)
                elif isinstance(multi, NoteResult):
                    # Backwards compat: single note
                    notes = [multi]

        # Get formatted content from task 3 (format_note) — may override note_content
        formatted_text = str(result).strip()
        if formatted_text and "---" in formatted_text and len(notes) == 1:
            notes[0] = NoteResult(
                action=notes[0].action,
                file_path=notes[0].file_path,
                error_pattern=notes[0].error_pattern,
                tags=notes[0].tags,
                note_content=formatted_text,
            )

        # Fallback: try to parse from raw if no structured output
        if not notes:
            try:
                parsed = json.loads(str(result))
                # Could be {"notes": [...]} or single note
                if "notes" in parsed and isinstance(parsed["notes"], list):
                    notes = [NoteResult(**n) for n in parsed["notes"]]
                else:
                    notes = [NoteResult(
                        action=parsed.get("action", "created"),
                        file_path=parsed.get("file_path", "unknown"),
                        error_pattern=parsed.get("error_pattern", "unknown"),
                        tags=parsed.get("tags", []),
                        note_content=parsed.get("note_content", str(result)),
                    )]
            except json.JSONDecodeError:
                notes = [NoteResult(
                    action="created",
                    file_path="unknown",
                    error_pattern="unknown",
                    tags=[],
                    note_content=str(result),
                )]

        # ── STRIP CODE FENCES from every note ──
        notes = [
            NoteResult(
                action=n.action,
                file_path=n.file_path,
                error_pattern=n.error_pattern,
                tags=n.tags,
                note_content=_strip_code_fence(n.note_content),
            )
            for n in notes
        ]

        # ── GUARANTEED FILE WRITE — for every note ──
        for note in notes:
            if note.note_content and note.file_path and note.file_path != "unknown":
                _ensure_note_written(req.vault_path, note.file_path, note.note_content)

        # Build Q&A recap
        questions_recap = []
        for i, q in enumerate(req.questions):
            a = req.answers[i] if i < len(req.answers) else "No answer"
            questions_recap.append({"question": q, "answer": a})

        return GenerateResponse(
            notes=notes,
            questions_recap=questions_recap,
        )

    except Exception as e:
        traceback.print_exc()
        return GenerateResponse(
            notes=[NoteResult(
                action="error",
                file_path="",
                error_pattern="",
                tags=[],
                note_content=f"Error: {str(e)}",
            )],
            questions_recap=[
                {"question": q, "answer": req.answers[i] if i < len(req.answers) else ""}
                for i, q in enumerate(req.questions)
            ],
        )


# ── GET /templates — List available formatting templates ──────────────────

@app.get("/templates")
async def get_templates():
    """Return list of available templates from the templates folder."""
    try:
        templates = list_templates()
        return {"templates": [{"name": t["name"], "filename": t["filename"]} for t in templates]}
    except Exception as e:
        traceback.print_exc()
        return {"templates": [], "error": str(e)}


# ── GET /anki/card-templates — List Anki card formatting templates ─────────

@app.get("/anki/card-templates")
async def get_anki_card_templates():
    """Return list of .md templates from the templates/anki/ folder."""
    try:
        import glob as _glob
        files = sorted(_glob.glob(os.path.join(_ANKI_TEMPLATES_DIR, "*.md")))
        templates = []
        for p in files:
            fname = os.path.basename(p)
            name = os.path.splitext(fname)[0].replace("_", " ").title()
            templates.append({"name": name, "filename": fname})
        return {"templates": templates}
    except Exception as e:
        return {"templates": [], "error": str(e)}


# ── POST /anki/format-card — LLM-format an Anki card using a template ─────

@app.post("/anki/format-card", response_model=AnkiFormatCardResponse)
async def anki_format_card(req: AnkiFormatCardRequest):
    """Run an Anki card's front/back through the LLM formatter using a template."""
    try:
        import glob as _glob
        templates = sorted(_glob.glob(os.path.join(_ANKI_TEMPLATES_DIR, "*.md")))
        template_path = None
        if req.template_filename:
            for p in templates:
                if os.path.basename(p) == req.template_filename:
                    template_path = p
                    break
        if not template_path and templates:
            template_path = templates[0]
        if not template_path:
            return AnkiFormatCardResponse(
                front=req.front, back=req.back, success=False,
                error="No templates found in templates/anki/"
            )

        with open(template_path, "r", encoding="utf-8") as fh:
            template_content = fh.read()

        crew = build_anki_format_crew(req.front, req.back, template_content)
        result = crew.kickoff()

        if hasattr(result, "pydantic") and result.pydantic:
            return AnkiFormatCardResponse(
                front=result.pydantic.front,
                back=result.pydantic.back,
                success=True,
            )
        # Fallback: parse raw JSON
        import json as _json
        try:
            parsed = _json.loads(str(result).strip())
            return AnkiFormatCardResponse(
                front=parsed.get("front", req.front),
                back=parsed.get("back", req.back),
                success=True,
            )
        except Exception:
            return AnkiFormatCardResponse(
                front=req.front, back=req.back, success=False,
                error="Formatter returned unrecognized output."
            )

    except Exception as e:
        traceback.print_exc()
        return AnkiFormatCardResponse(front=req.front, back=req.back, success=False, error=str(e))


# ── POST /format — Standalone note formatting (editor mode) ──────────────

class FormatRequest(BaseModel):
    vault_path: str
    note_path: str  # relative path inside vault
    selected_template: str = ""  # filename of template to use (empty = all)
    custom_instructions: str = ""  # free-text LLM instructions from the user

class FormatResponse(BaseModel):
    formatted_content: str
    success: bool
    error: str = ""

@app.post("/format", response_model=FormatResponse)
async def format_note(req: FormatRequest):
    """Read a note, run it through the formatting crew, write it back, return."""
    try:
        full = os.path.join(req.vault_path, req.note_path.replace("/", os.sep))
        if not os.path.isfile(full):
            return FormatResponse(formatted_content="", success=False, error="File not found.")

        with open(full, "r", encoding="utf-8") as fh:
            original_content = fh.read()

        crew = build_format_crew(
            note_content=original_content,
            selected_template=req.selected_template or None,
            custom_instructions=req.custom_instructions,
        )
        result = crew.kickoff()
        formatted = str(result).strip()

        # If the formatter returned valid markdown, write it back
        if formatted and "---" in formatted:
            with open(full, "w", encoding="utf-8") as fh:
                fh.write(formatted)
            print(f"📝 Formatted and saved: {full}")
            return FormatResponse(formatted_content=formatted, success=True)
        else:
            return FormatResponse(
                formatted_content=original_content,
                success=False,
                error="Formatter did not return valid markdown.",
            )

    except Exception as e:
        traceback.print_exc()
        return FormatResponse(formatted_content="", success=False, error=str(e))


# ── POST /api/save-note — Write note content to vault ─────────────────────

class SaveNoteRequest(BaseModel):
    vault_path: str
    file_path: str  # relative path inside vault
    content: str

class SaveNoteResponse(BaseModel):
    success: bool
    error: str = ""

@app.post("/api/save-note", response_model=SaveNoteResponse)
async def save_note(req: SaveNoteRequest):
    """Write (or overwrite) a note in the vault."""
    try:
        full = os.path.join(req.vault_path, req.file_path.replace("/", os.sep))
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as fh:
            fh.write(req.content)
        print(f"💾 Saved note: {full}")
        return SaveNoteResponse(success=True)
    except Exception as e:
        traceback.print_exc()
        return SaveNoteResponse(success=False, error=str(e))


# ── POST /api/keynote — Synthesize a Key Note ─────────────────────────────

@app.post("/api/keynote", response_model=KeyNoteResponse)
async def synthesize_keynote(req: KeyNoteRequest):
    """Read a note, find all notes that wikilink to it, and synthesize a Key Note."""
    try:
        set_vault_path(req.vault_path)

        # Read the current note
        note_full = os.path.join(req.vault_path, req.note_path.replace("/", os.sep))
        if not os.path.isfile(note_full):
            return KeyNoteResponse(
                suggested_filename="", content="", source_notes=[],
                success=False, error="Note not found.",
            )
        with open(note_full, "r", encoding="utf-8") as fh:
            current_note = fh.read()

        # Find notes that contain a wikilink to this note
        note_title = os.path.splitext(os.path.basename(req.note_path))[0]
        referencing_contents: list[str] = []
        source_note_paths: list[str] = []

        for root, dirs, files in os.walk(req.vault_path):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for f in files:
                if not f.endswith(".md"):
                    continue
                full = os.path.join(root, f)
                rel = os.path.relpath(full, req.vault_path).replace("\\", "/")
                if rel == req.note_path.replace("\\", "/"):
                    continue  # skip self
                try:
                    with open(full, "r", encoding="utf-8") as fh:
                        content = fh.read()
                    if f"[[{note_title}]]" in content:
                        referencing_contents.append(f"--- {rel} ---\n{content}")
                        source_note_paths.append(rel)
                except Exception:
                    continue

        referencing_notes = "\n\n".join(referencing_contents) if referencing_contents else "No notes reference this note."

        crew = build_keynote_crew(
            current_note=current_note,
            referencing_notes=referencing_notes,
        )
        result = crew.kickoff()

        # Extract structured output
        if hasattr(result, "pydantic") and result.pydantic:
            kn = result.pydantic
            # Write the Key Note to vault
            if kn.suggested_filename and kn.content:
                _ensure_note_written(req.vault_path, kn.suggested_filename, kn.content)
            return KeyNoteResponse(
                suggested_filename=kn.suggested_filename,
                content=kn.content,
                source_notes=source_note_paths,
                success=True,
            )

        # Fallback: parse raw JSON
        try:
            parsed = json.loads(str(result).strip())
            filename = parsed.get("suggested_filename", "key-note.md")
            content = parsed.get("content", str(result))
            if filename and content:
                _ensure_note_written(req.vault_path, filename, content)
            return KeyNoteResponse(
                suggested_filename=filename,
                content=content,
                source_notes=source_note_paths,
                success=True,
            )
        except json.JSONDecodeError:
            return KeyNoteResponse(
                suggested_filename="",
                content=str(result),
                source_notes=source_note_paths,
                success=False,
                error="Failed to parse Key Note output.",
            )

    except Exception as e:
        traceback.print_exc()
        return KeyNoteResponse(
            suggested_filename="", content="", source_notes=[],
            success=False, error=str(e),
        )


# ── POST /anki/search — Search Anki cards via AnkiConnect ─────────────────

@app.post("/anki/search", response_model=AnkiSearchResponse)
async def anki_search(req: AnkiSearchRequest):
    """Search Anki cards using the anki_search_agent CrewAI crew."""
    try:
        crew = build_anki_crew(req.query)
        result = crew.kickoff(inputs={"query": req.query})

        # Prefer structured pydantic output from the task
        if hasattr(result, "pydantic") and result.pydantic:
            return result.pydantic

        # Fallback: parse raw JSON text from the agent
        raw = str(result).strip()
        try:
            parsed = json.loads(raw)
            cards = [AnkiCard(**c) for c in parsed.get("cards", [])]
            error_msg = parsed.get("error")
            return AnkiSearchResponse(cards=cards, total=len(cards), error=error_msg)
        except (json.JSONDecodeError, ValueError):
            # If the agent returned an error string from the tool
            if raw.startswith("Error:") or "Cannot connect" in raw:
                raise HTTPException(status_code=503, detail=raw)
            return AnkiSearchResponse(cards=[], total=0)

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        msg = str(e)
        if "Cannot connect to AnkiConnect" in msg or "Connection refused" in msg:
            raise HTTPException(
                status_code=503,
                detail="AnkiConnect not reachable. Open Anki with the AnkiConnect plugin installed.",
            )
        raise HTTPException(status_code=500, detail=msg)


# ── POST /anki/direct-search — Fast tag-suffix search (no CrewAI) ─────────

def _direct_anki(action: str, **params):
    """Synchronous AnkiConnect call used by the direct-search endpoint."""
    payload = json.dumps({"action": action, "version": 6, "params": params}).encode()
    req_obj = urllib.request.Request(
        "http://localhost:8765",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req_obj, timeout=5) as resp:
        result = json.loads(resp.read())
    if result.get("error"):
        raise ValueError(result["error"])
    return result["result"]


@app.post("/anki/direct-search", response_model=AnkiSearchResponse)
def anki_direct_search(req: AnkiSearchRequest):
    """Fast AnkiConnect search that bypasses CrewAI (runs in thread pool).
    A bare word or number is automatically formatted as tag:*::<input>.
    e.g. '2513' → finds all cards that have a tag ending with ::2513.
    Uses first two fields of each note regardless of field name (works with
    any deck template including AnKing Text/Extra, Basic Front/Back, etc.)."""
    try:
        q = req.query.strip()
        # Auto-format: bare text/number → tag suffix search
        if q and "::" not in q and not any(q.startswith(p) for p in ("tag:", "deck:", "note:", "is:", "prop:")):
            q = f"tag:*::{q}"

        card_ids = _direct_anki("findCards", query=q)
        if not card_ids:
            return AnkiSearchResponse(cards=[], total=0)

        card_ids = list(itertools.islice(card_ids, 20))
        cards_info = _direct_anki("cardsInfo", cards=card_ids)

        note_ids = list({c["note"] for c in cards_info})
        notes_info = _direct_anki("notesInfo", notes=note_ids)
        tags_by_note = {n["noteId"]: n.get("tags", []) for n in notes_info}

        cards = []
        for card in cards_info:
            fields_dict = card.get("fields", {})
            field_keys = list(fields_dict.keys())
            field_values = list(fields_dict.values())
            front = field_values[0]["value"] if len(field_values) > 0 else ""
            back = field_values[1]["value"] if len(field_values) > 1 else ""
            cards.append(AnkiCard(
                note_id=card["note"],
                card_id=card["cardId"],
                front=front,
                back=back,
                deck=card.get("deckName", ""),
                tags=tags_by_note.get(card["note"], []),
                field_names=field_keys[:2],
                suspended=card.get("queue", 0) == -1,
            ))

        return AnkiSearchResponse(cards=cards, total=len(cards))

    except OSError:
        raise HTTPException(
            status_code=503,
            detail="AnkiConnect not reachable. Open Anki with the AnkiConnect plugin installed.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ── POST /anki/update — Update an Anki note's fields ──────────────────────

@app.post("/anki/update", response_model=AnkiUpdateResponse)
def anki_update(req: AnkiUpdateRequest):
    """Update the front/back fields of an Anki note via AnkiConnect."""
    try:
        field_name_front = req.field_names[0] if len(req.field_names) > 0 else "Text"
        field_name_back = req.field_names[1] if len(req.field_names) > 1 else "Extra"
        _direct_anki("updateNoteFields", note={
            "id": req.note_id,
            "fields": {
                field_name_front: req.front,
                field_name_back: req.back,
            },
        })
        return AnkiUpdateResponse(success=True)
    except OSError:
        raise HTTPException(
            status_code=503,
            detail="AnkiConnect not reachable. Open Anki with the AnkiConnect plugin installed.",
        )
    except ValueError as e:
        return AnkiUpdateResponse(success=False, error=str(e))
    except Exception as e:
        traceback.print_exc()
        return AnkiUpdateResponse(success=False, error=str(e))


# ── GET /anki/decks — List Anki deck names ────────────────────────────────

@app.get("/anki/decks")
def anki_get_decks_list():
    """Return list of deck names from AnkiConnect."""
    try:
        decks = _direct_anki("deckNames")
        return {"decks": sorted(decks)}
    except OSError:
        return {"decks": [], "error": "AnkiConnect not reachable."}
    except Exception as e:
        return {"decks": [], "error": str(e)}


# ── POST /anki/create-card — Generate card front/back from Obsidian note ──

@app.post("/anki/create-card", response_model=AnkiCreateCardResponse)
async def anki_create_card(req: AnkiCreateCardRequest):
    """Generate a new Anki card's front/back from an Obsidian note using LLM."""
    try:
        full = os.path.join(req.vault_path, req.note_path.replace("/", os.sep))
        if not os.path.isfile(full):
            return AnkiCreateCardResponse(success=False, error="Note not found.")

        with open(full, "r", encoding="utf-8") as fh:
            note_content = fh.read()

        import glob as _glob
        templates = sorted(_glob.glob(os.path.join(_ANKI_TEMPLATES_DIR, "*.md")))
        template_path = None
        if req.template_filename:
            for p in templates:
                if os.path.basename(p) == req.template_filename:
                    template_path = p
                    break
        if not template_path and templates:
            template_path = templates[0]

        template_content = ""
        if template_path:
            with open(template_path, "r", encoding="utf-8") as fh:
                template_content = fh.read()

        crew = build_anki_create_crew(note_content, template_content)
        result = crew.kickoff()

        if hasattr(result, "pydantic") and result.pydantic:
            return AnkiCreateCardResponse(
                front=result.pydantic.front,
                back=result.pydantic.back,
                success=True,
            )
        try:
            parsed = json.loads(str(result).strip())
            return AnkiCreateCardResponse(
                front=parsed.get("front", ""),
                back=parsed.get("back", ""),
                success=True,
            )
        except Exception:
            return AnkiCreateCardResponse(
                success=False, error="LLM returned unrecognized output."
            )

    except Exception as e:
        traceback.print_exc()
        return AnkiCreateCardResponse(success=False, error=str(e))


# ── POST /anki/add-note — Add a new note to Anki ─────────────────────────

@app.post("/anki/add-note", response_model=AnkiAddNoteResponse)
def anki_add_note(req: AnkiAddNoteRequest):
    """Add a new note to Anki via AnkiConnect."""
    try:
        field_front = req.field_names[0] if len(req.field_names) > 0 else "Text"
        field_back = req.field_names[1] if len(req.field_names) > 1 else "Extra"
        note_id = _direct_anki("addNote", note={
            "deckName": req.deck,
            "modelName": req.model,
            "fields": {
                field_front: req.front,
                field_back: req.back,
            },
            "tags": req.tags,
        })
        return AnkiAddNoteResponse(success=True, note_id=note_id)
    except OSError:
        raise HTTPException(
            status_code=503,
            detail="AnkiConnect not reachable. Open Anki with the AnkiConnect plugin installed.",
        )
    except ValueError as e:
        return AnkiAddNoteResponse(success=False, error=str(e))
    except Exception as e:
        traceback.print_exc()
        return AnkiAddNoteResponse(success=False, error=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)

