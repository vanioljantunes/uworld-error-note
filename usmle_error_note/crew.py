"""CrewAI crew definitions for the UWorld Error-Note workflow.

Three crews:
1. QuestionsCrew   — Phase 1: generates diagnostic questions
2. ErrorNoteCrew   — Phases 2-4: infers error pattern, composes & writes note (+ format)
3. FormatCrew      — Standalone: reformats an existing note using templates
"""

import os
import glob
import yaml
from crewai import Agent, Crew, Process, Task
from tools import (
    vault_list_files,
    vault_read_note,
    vault_search_tags,
    vault_write_note,
    anki_search_notes,
    anki_get_decks,
)
from models import QuestionsOutput, ErrorPatternOutput, NoteResult, AnkiSearchResponse, AnkiCardFormatOutput


# ── Load configs ──────────────────────────────────────────────────────────

_CONFIG_DIR = os.path.join(os.path.dirname(__file__), "config")

# Default templates dir: top-level crewAI/templates/
_DEFAULT_TEMPLATES_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "templates")
)


def _load_yaml(filename: str) -> dict:
    with open(os.path.join(_CONFIG_DIR, filename), "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _load_template(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def list_templates(templates_dir: str | None = None) -> list[dict]:
    """Return [{name, filename, path}] for every .md in templates_dir."""
    tdir = templates_dir or _DEFAULT_TEMPLATES_DIR
    results = []
    for p in sorted(glob.glob(os.path.join(tdir, "*.md"))):
        fname = os.path.basename(p)
        name = os.path.splitext(fname)[0].replace("_", " ").title()
        results.append({"name": name, "filename": fname, "path": p})
    return results


def _load_selected_templates(
    templates_dir: str | None = None,
    selected: str | None = None,
) -> dict:
    """Load templates. If `selected` is given, load only that one.
    Otherwise load all and return them keyed as template_a, template_b, etc."""
    tdir = templates_dir or _DEFAULT_TEMPLATES_DIR
    all_templates = list_templates(tdir)

    if selected:
        # Find the selected template
        for t in all_templates:
            if t["filename"] == selected or t["name"] == selected:
                content = _load_template(t["path"])
                return {"template_a": content, "template_b": "", "template_c": ""}
        # Fallback: load all
        print(f"⚠️  Template '{selected}' not found, loading all.")

    result = {}
    for i, t in enumerate(all_templates[:3]):
        key = f"template_{'abc'[i]}"
        result[key] = _load_template(t["path"])
    # Pad missing keys
    for key in ("template_a", "template_b", "template_c"):
        if key not in result:
            result[key] = ""
    return result


# ── Agent factories ──────────────────────────────────────────────────────

def _make_agent(key: str, agents_cfg: dict, tools: list | None = None) -> Agent:
    cfg = agents_cfg[key]
    return Agent(
        role=cfg["role"].strip(),
        goal=cfg["goal"].strip(),
        backstory=cfg["backstory"].strip(),
        tools=tools or [],
        verbose=True,
    )


# ── Questions Crew (Phase 1) ─────────────────────────────────────────────

def build_questions_crew(inputs: dict) -> Crew:
    """Build a crew that generates 1-3 diagnostic questions from an extraction."""
    agents_cfg = _load_yaml("agents.yaml")
    tasks_cfg = _load_yaml("tasks.yaml")

    gap_agent = _make_agent("gap_identifier", agents_cfg)

    task_cfg = tasks_cfg["generate_questions"]
    description = task_cfg["description"].strip().format(**inputs)
    expected_output = task_cfg["expected_output"].strip()

    questions_task = Task(
        description=description,
        expected_output=expected_output,
        agent=gap_agent,
        output_pydantic=QuestionsOutput,
    )

    return Crew(
        agents=[gap_agent],
        tasks=[questions_task],
        process=Process.sequential,
        verbose=True,
    )


# ── Error Note Crew (Phases 2-4 + formatting) ────────────────────────────

def build_error_note_crew(inputs: dict, templates_dir: str | None = None) -> Crew:
    """Build a crew that infers error, composes the note, then formats it."""
    agents_cfg = _load_yaml("agents.yaml")
    tasks_cfg = _load_yaml("tasks.yaml")
    templates = _load_selected_templates(templates_dir)

    # Agents
    analyst = _make_agent(
        "error_pattern_analyst",
        agents_cfg,
        tools=[vault_list_files, vault_read_note, vault_search_tags],
    )
    composer = _make_agent(
        "note_composer",
        agents_cfg,
        tools=[vault_read_note, vault_search_tags, vault_write_note],
    )
    formatter = _make_agent("note_formatter", agents_cfg)

    # Task 1: infer error pattern
    t1_cfg = tasks_cfg["infer_error_pattern"]
    infer_task = Task(
        description=t1_cfg["description"].strip().format(**inputs),
        expected_output=t1_cfg["expected_output"].strip(),
        agent=analyst,
        output_pydantic=ErrorPatternOutput,
    )

    # Task 2: compose note (depends on task 1)
    t2_cfg = tasks_cfg["compose_note"]
    compose_task = Task(
        description=t2_cfg["description"].strip().format(**inputs),
        expected_output=t2_cfg["expected_output"].strip(),
        agent=composer,
        context=[infer_task],
        output_pydantic=NoteResult,
    )

    # Task 3: format note (depends on task 2)
    format_inputs = {
        "note_content": "The note content will come from the previous task output.",
        **templates,
    }
    t3_cfg = tasks_cfg["format_note"]
    format_task = Task(
        description=t3_cfg["description"].strip().format(**format_inputs),
        expected_output=t3_cfg["expected_output"].strip(),
        agent=formatter,
        context=[compose_task],
    )

    return Crew(
        agents=[analyst, composer, formatter],
        tasks=[infer_task, compose_task, format_task],
        process=Process.sequential,
        verbose=True,
    )


# ── Format-only Crew (for editor mode) ───────────────────────────────────

def build_format_crew(
    note_content: str,
    templates_dir: str | None = None,
    selected_template: str | None = None,
    custom_instructions: str = "",
) -> Crew:
    """Build a crew that ONLY formats an existing note using templates.
    
    Args:
        note_content: The markdown content to format
        templates_dir: Path to templates folder
        selected_template: Filename of a specific template to use
        custom_instructions: Additional user instructions for the formatter
    """
    agents_cfg = _load_yaml("agents.yaml")
    tasks_cfg = _load_yaml("tasks.yaml")
    templates = _load_selected_templates(templates_dir, selected_template)

    formatter = _make_agent("note_formatter", agents_cfg)

    format_inputs = {
        "note_content": note_content,
        **templates,
    }
    t_cfg = tasks_cfg["format_note"]
    description = t_cfg["description"].strip().format(**format_inputs)

    # Append custom instructions if provided
    if custom_instructions.strip():
        description += (
            f"\n\nADDITIONAL USER INSTRUCTIONS (follow these carefully):\n"
            f"{custom_instructions.strip()}"
        )

    format_task = Task(
        description=description,
        expected_output=t_cfg["expected_output"].strip(),
        agent=formatter,
    )

    return Crew(
        agents=[formatter],
        tasks=[format_task],
        process=Process.sequential,
        verbose=True,
    )


# ── Anki Search Crew ──────────────────────────────────────────────────────

def build_anki_crew(query: str) -> Crew:
    """Build a crew that searches Anki cards for a given query via AnkiConnect."""
    agents_cfg = _load_yaml("agents.yaml")
    tasks_cfg = _load_yaml("tasks.yaml")

    anki_agent = _make_agent(
        "anki_search_agent",
        agents_cfg,
        tools=[anki_search_notes, anki_get_decks],
    )

    task_cfg = tasks_cfg["search_anki_cards"]
    description = task_cfg["description"].strip().format(query=query)
    expected_output = task_cfg["expected_output"].strip()

    search_task = Task(
        description=description,
        expected_output=expected_output,
        agent=anki_agent,
        output_pydantic=AnkiSearchResponse,
    )

    return Crew(
        agents=[anki_agent],
        tasks=[search_task],
        process=Process.sequential,
        verbose=True,
    )


# ── Anki Card Format Crew ──────────────────────────────────────────────────

def build_anki_format_crew(front: str, back: str, template_content: str) -> Crew:
    """Build a crew that reformats an Anki card's front/back using a template."""
    agents_cfg = _load_yaml("agents.yaml")
    tasks_cfg = _load_yaml("tasks.yaml")

    formatter = _make_agent("anki_card_formatter", agents_cfg)

    task_inputs = {
        "front": front,
        "back": back,
        "template_content": template_content,
    }
    t_cfg = tasks_cfg["format_anki_card"]
    description = t_cfg["description"].strip().format(**task_inputs)

    format_task = Task(
        description=description,
        expected_output=t_cfg["expected_output"].strip(),
        agent=formatter,
        output_pydantic=AnkiCardFormatOutput,
    )

    return Crew(
        agents=[formatter],
        tasks=[format_task],
        process=Process.sequential,
        verbose=True,
    )
