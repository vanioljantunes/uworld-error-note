"""Custom CrewAI tools for interacting with an Obsidian vault on the local filesystem."""

import os
import re
import yaml
from typing import Any, Optional
from crewai.tools import tool


def _walk_md_files(vault_path: str) -> list[dict]:
    """Walk vault and return list of {title, relative_path} for all .md files."""
    results = []
    for root, dirs, files in os.walk(vault_path):
        # Skip hidden dirs like .obsidian
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for f in files:
            if f.endswith(".md"):
                full = os.path.join(root, f)
                rel = os.path.relpath(full, vault_path)
                results.append({"title": f.replace(".md", ""), "path": rel.replace("\\", "/")})
    return results


def _parse_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter from a markdown string."""
    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return {}
    try:
        return yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError:
        return {}


# ── Global vault path storage (set by the server before kickoff) ──────────
_vault_path: str = ""

def set_vault_path(path: str):
    global _vault_path
    _vault_path = path

def get_vault_path() -> str:
    return _vault_path


@tool("vault_list_files")
def vault_list_files(dummy: str = "") -> str:
    """List all markdown files in the Obsidian vault. Returns JSON-like list of {title, path} entries."""
    vp = get_vault_path()
    if not vp or not os.path.isdir(vp):
        return "Error: vault path not set or not found."
    files = _walk_md_files(vp)
    lines = [f"- {f['title']}  ({f['path']})" for f in files]
    return f"Found {len(files)} notes:\n" + "\n".join(lines) if lines else "Vault is empty."


@tool("vault_read_note")
def vault_read_note(relative_path: str) -> str:
    """Read the full content of a markdown note given its relative path inside the vault."""
    vp = get_vault_path()
    if not vp:
        return "Error: vault path not set."
    full = os.path.join(vp, relative_path.replace("/", os.sep))
    if not os.path.isfile(full):
        return f"File not found: {relative_path}"
    with open(full, "r", encoding="utf-8") as fh:
        return fh.read()


@tool("vault_search_tags")
def vault_search_tags(dummy: str = "") -> str:
    """Collect all unique tags from YAML frontmatter across every note in the vault. Returns a deduplicated list."""
    vp = get_vault_path()
    if not vp or not os.path.isdir(vp):
        return "Error: vault path not set or not found."
    all_tags: set[str] = set()
    for info in _walk_md_files(vp):
        full = os.path.join(vp, info["path"].replace("/", os.sep))
        try:
            with open(full, "r", encoding="utf-8") as fh:
                fm = _parse_frontmatter(fh.read())
                tags = fm.get("tags", [])
                if isinstance(tags, list):
                    all_tags.update(str(t) for t in tags)
        except Exception:
            continue
    sorted_tags = sorted(all_tags)
    return f"Found {len(sorted_tags)} unique tags:\n" + "\n".join(f"- {t}" for t in sorted_tags) if sorted_tags else "No tags found in vault."


@tool("vault_write_note")
def vault_write_note(file_path: str, content: str) -> str:
    """Create or overwrite a markdown file in the vault. file_path is relative to vault root (e.g. 'USMLE/Errors/my-note.md'). content is the full markdown including frontmatter."""
    vp = get_vault_path()
    if not vp:
        return "Error: vault path not set."
    full = os.path.join(vp, file_path.replace("/", os.sep))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(content)
    return f"Successfully wrote note to: {file_path}"


# ── AnkiConnect tools ─────────────────────────────────────────────────────

import itertools as _itertools
import json as _json
import urllib.request as _urllib_request


def _anki_request(action: str, **params) -> Any:
    """Call AnkiConnect (port 8765) and return the result field."""
    payload = _json.dumps({"action": action, "version": 6, "params": params}).encode()
    req = _urllib_request.Request(
        "http://localhost:8765",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with _urllib_request.urlopen(req, timeout=5) as resp:
        result = _json.loads(resp.read())
    if result.get("error"):
        raise ValueError(result["error"])
    return result["result"]


@tool("anki_search_notes")
def anki_search_notes(query: str) -> str:
    """Search Anki cards via AnkiConnect. Supports full Anki search syntax
    (e.g. 'tag:neurology', 'deck:USMLE', 'diabetes'). Returns up to 20
    matching cards as JSON with front, back, deck, tags, and note_id."""
    try:
        card_ids = _anki_request("findCards", query=query)
        if not card_ids:
            return _json.dumps({"cards": [], "total": 0})

        card_ids = list(_itertools.islice(card_ids, 20))
        cards_info = _anki_request("cardsInfo", cards=card_ids)

        # Fetch tags (stored on notes, not cards)
        note_ids = list({c["note"] for c in cards_info})
        notes_info = _anki_request("notesInfo", notes=note_ids)
        tags_by_note = {n["noteId"]: n.get("tags", []) for n in notes_info}

        cards = []
        for card in cards_info:
            fields = card.get("fields", {})
            front = fields.get("Front", {}).get("value", "")
            back = fields.get("Back", {}).get("value", "")
            cards.append({
                "note_id": card.get("note"),
                "front": front,
                "back": back,
                "deck": card.get("deckName", ""),
                "tags": tags_by_note.get(card.get("note", 0), []),
            })

        return _json.dumps({"cards": cards, "total": len(cards)})

    except OSError:
        return "Error: Cannot connect to AnkiConnect at http://localhost:8765. Make sure Anki is open with the AnkiConnect plugin installed."
    except ValueError as e:
        return f"AnkiConnect error: {str(e)}"
    except Exception as e:
        return f"Error: {str(e)}"


@tool("anki_get_decks")
def anki_get_decks(dummy: str = "") -> str:
    """List all deck names from Anki via AnkiConnect. Returns JSON with a 'decks' list."""
    try:
        decks = _anki_request("deckNames")
        return _json.dumps({"decks": decks})
    except OSError:
        return "Error: Cannot connect to AnkiConnect. Is Anki open?"
    except Exception as e:
        return f"Error: {str(e)}"
