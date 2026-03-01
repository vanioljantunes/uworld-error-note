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

class DiagnosticQuestion(BaseModel):
    question: str = Field(description="A short diagnostic question to ask the user")

class QuestionsOutput(BaseModel):
    questions: List[str] = Field(
        description="1 to 3 short diagnostic questions to identify the user's cognitive gap",
        min_length=1,
        max_length=3,
    )


# ── Phase 2 output ────────────────────────────────────────────────────────

class ErrorPatternOutput(BaseModel):
    error_slug: str = Field(description="Kebab-case ASCII error pattern slug, e.g. afferent-vs-efferent-confusion")
    action: str = Field(description="'create' or 'update'")
    existing_file: Optional[str] = Field(default=None, description="Relative path of existing note if updating")
    system_tag: str = Field(description="One system tag from: renal, cardio, pulm, neuro, endo, heme-onc, repro, gi, msk, derm, psych, biostats, ethics, micro, pharm, immuno, genetics")
    topic_tag: str = Field(description="Short kebab-case topic tag")
    concept_tags: List[str] = Field(description="2–6 kebab-case concept tags")


# ── Phase 4 final result ──────────────────────────────────────────────────

class NoteResult(BaseModel):
    action: str = Field(description="'created' or 'updated'")
    file_path: str = Field(description="Relative path of the note in the vault")
    error_pattern: str = Field(description="The inferred error pattern slug")
    tags: List[str] = Field(description="Final list of all tags on the note")
    note_content: str = Field(description="The full markdown content of the note")


# ── API request/response models ──────────────────────────────────────────

class QuestionsRequest(BaseModel):
    extraction: ExtractionInput

class QuestionsResponse(BaseModel):
    questions: List[str]

class GenerateRequest(BaseModel):
    extraction: ExtractionInput
    questions: List[str]
    answers: List[str]
    vault_path: str

class GenerateResponse(BaseModel):
    action: str
    file_path: str
    error_pattern: str
    tags: List[str]
    note_content: str
    questions_recap: List[dict]


# ── Anki search models ────────────────────────────────────────────────────

class AnkiCard(BaseModel):
    note_id: int
    front: str
    back: str
    deck: str
    tags: List[str]
    field_names: List[str] = []

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
