"""Pydantic models for structured I/O between frontend, FastAPI, and CrewAI."""

from pydantic import BaseModel, Field
from typing import List, Optional


# ── Input from the extractor ──────────────────────────────────────────────

class ExtractionInput(BaseModel):
    question_id: Optional[str] = None
    question: Optional[str] = None
    choosed_alternative: Optional[str] = None
    wrong_alternative: Optional[str] = None
    full_explanation: Optional[str] = None
    educational_objective: Optional[str] = None


# ── Phase 1 output ────────────────────────────────────────────────────────

class MCQuestion(BaseModel):
    question: str = Field(description="The question text")
    options: List[str] = Field(description="3-4 multiple-choice options", min_length=3, max_length=4)
    correct: int = Field(description="0-based index of the correct option")
    difficulty: str = Field(description="'hard', 'medium', or 'easy'")

class QuestionsOutput(BaseModel):
    questions: List[MCQuestion] = Field(
        description="1 to 3 MC questions ordered from hardest to easiest",
        min_length=1,
        max_length=3,
    )


# ── Phase 2 output ────────────────────────────────────────────────────────

class GapItem(BaseModel):
    slug: str = Field(description="Kebab-case ASCII error pattern slug")
    action: str = Field(description="'create' or 'update'")
    existing_file: Optional[str] = Field(default=None, description="Relative path if updating")
    system_tag: str = Field(description="One system tag")
    topic_tag: str = Field(description="Short kebab-case topic tag")
    concept_tags: List[str] = Field(description="2-6 kebab-case concept tags")

class ErrorPatternOutput(BaseModel):
    gaps: List[GapItem] = Field(description="1-3 distinct knowledge gaps identified", min_length=1, max_length=3)


# ── Phase 4 final result ──────────────────────────────────────────────────

class NoteResult(BaseModel):
    action: str = Field(description="'created' or 'updated'")
    file_path: str = Field(description="Relative path of the note in the vault")
    error_pattern: str = Field(description="The inferred error pattern slug")
    tags: List[str] = Field(description="Final list of all tags on the note")
    note_content: str = Field(description="The full markdown content of the note")

class MultiNoteResult(BaseModel):
    notes: List[NoteResult] = Field(description="List of micro-notes created or updated")


# ── API request/response models ──────────────────────────────────────────

class QuestionsRequest(BaseModel):
    extraction: ExtractionInput

class QuestionsResponse(BaseModel):
    questions: List[dict]  # [{question, options, correct, difficulty}]

class GenerateRequest(BaseModel):
    extraction: ExtractionInput
    questions: List[str]
    answers: List[str]
    vault_path: str

class GenerateResponse(BaseModel):
    notes: List[NoteResult]
    questions_recap: List[dict]


# ── Anki search models ────────────────────────────────────────────────────

class AnkiCard(BaseModel):
    note_id: int
    card_id: int = 0
    front: str
    back: str
    deck: str
    tags: List[str]
    field_names: List[str] = []
    suspended: bool = False

class AnkiSearchRequest(BaseModel):
    query: str

class AnkiSearchResponse(BaseModel):
    cards: List[AnkiCard]
    total: int
    error: Optional[str] = None


# ── Anki card editor models ───────────────────────────────────────────────

class AnkiUpdateRequest(BaseModel):
    note_id: int
    front: str
    back: str
    field_names: List[str] = ["Text", "Extra"]

class AnkiUpdateResponse(BaseModel):
    success: bool
    error: str = ""

class AnkiUnsuspendRequest(BaseModel):
    card_ids: List[int]

class AnkiFormatCardRequest(BaseModel):
    front: str
    back: str
    template_filename: str = ""

class AnkiFormatCardResponse(BaseModel):
    front: str
    back: str
    success: bool
    error: str = ""

class AnkiCardFormatOutput(BaseModel):
    front: str = Field(description="Formatted front field, cloze syntax preserved")
    back: str = Field(description="Formatted back field as HTML")


# ── Anki card creation models ────────────────────────────────────────────

class AnkiCreateCardRequest(BaseModel):
    vault_path: str
    note_path: str
    template_filename: str = ""

class AnkiCreateCardResponse(BaseModel):
    front: str = ""
    back: str = ""
    success: bool
    error: str = ""

class AnkiAddNoteRequest(BaseModel):
    deck: str
    model: str = "Cloze"
    front: str
    back: str
    tags: List[str] = []
    field_names: List[str] = ["Text", "Extra"]

class AnkiAddNoteResponse(BaseModel):
    success: bool
    note_id: Optional[int] = None
    error: str = ""


# ── Key Note models ──────────────────────────────────────────────────────

class KeyNoteRequest(BaseModel):
    vault_path: str
    note_path: str

class KeyNoteResponse(BaseModel):
    suggested_filename: str
    content: str
    source_notes: List[str]
    success: bool
    error: str = ""
