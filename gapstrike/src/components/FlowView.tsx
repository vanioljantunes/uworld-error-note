"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "../app/page.module.css";
import { saveUserData, getUserData } from "@/lib/user-data";
import { renderMarkdown } from "@/lib/render-markdown";
import TurndownService from "turndown";
import MermaidStructEditor, { MermaidGridPreview } from "./MermaidStructEditor";
import QuestionEditor from "./QuestionEditor";
import TableEditor from "./TableEditor";

// ── HTML → Markdown converter (singleton) ───────────────────────────────────
const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});
// Preserve wikilinks
turndown.addRule("wikilinks", {
  filter: (node) => node.nodeName === "SPAN" && node.classList.contains("wikilink"),
  replacement: (_content, node) => {
    const text = (node as HTMLElement).textContent || "";
    const inner = text.replace(/\[\[\s*/, "").replace(/\s*\]\]/, "").trim();
    return `[[${inner}]]`;
  },
});
// Preserve fenced code blocks with lang
turndown.addRule("fencedCodeBlock", {
  filter: (node) => node.nodeName === "PRE" && !!node.querySelector("code"),
  replacement: (_content, node) => {
    const pre = node as HTMLElement;
    const lang = pre.getAttribute("data-lang") || "";
    const code = pre.querySelector("code")?.textContent || "";
    return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
  },
});

type EditorMode = "cloze" | "question" | "table" | "mermaid";
type NoteFormatMode = "original" | "error_note" | "comparison" | "mechanism";

// ── Types ─────────────────────────────────────────────────────────────────

interface SavedExtraction {
  id: string;
  questionId: string | null;
  title: string;
  extraction: any;
  savedAt: number;
}

interface AnkiCard {
  note_id: number;
  card_id: number;
  front: string;
  back: string;
  deck: string;
  tags: string[];
  field_names: string[];
  suspended: boolean;
}

interface Template {
  id: string;
  slug: string;
  category: string;
  title: string;
  content: string;
  updated_at: string;
}

interface NoteResultItem {
  action: string;
  file_path: string;
  error_pattern: string;
  tags: string[];
  note_content: string;
}

interface MCQuestionItem {
  question: string;
  options: string[];
  correct: number;
  difficulty: string;
}

// ── AnkiConnect ───────────────────────────────────────────────────────────

const ANKI_CONNECT_URL = "http://localhost:8765";

async function ankiConnect(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const resp = await fetch(ANKI_CONNECT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, version: 6, params }),
  });
  if (!resp.ok) throw new Error(`AnkiConnect HTTP ${resp.status}`);
  const data = await resp.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}


function stripHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || "";
}

/** Render mermaid code blocks in a card front to inline SVG for Anki.
 *  Cloze markers ({{c1::text}}) conflict with mermaid's {{ hexagon syntax,
 *  so we strip them before rendering and re-inject into SVG text nodes after. */
async function renderMermaidToSvg(html: string): Promise<string> {
  const codeBlockRe = /```mermaid\s*\n?([\s\S]*?)```/g;
  const mermaidDivRe = /<div class="mermaid">\s*([\s\S]*?)\s*<\/div>/gi;

  // Normalize code blocks to div wrappers
  let normalized = html.replace(codeBlockRe, (_m, code: string) =>
    `<div class="mermaid">${code.trim()}</div>`
  );

  const matches = [...normalized.matchAll(mermaidDivRe)];
  if (matches.length === 0) return html;

  try {
    const mermaid = (await import("mermaid")).default;
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      themeVariables: {
        primaryColor: "#7c3aed",
        primaryTextColor: "#fff",
        lineColor: "#a89cdc",
        secondaryColor: "#2d1b69",
        background: "#1a1a2e",
        mainBkg: "#2d1b69",
        nodeBorder: "#7c3aed",
      },
    });

    for (let i = 0; i < matches.length; i++) {
      const fullMatch = matches[i][0];
      const code = matches[i][1].trim();
      if (!code) continue;

      // Collect cloze markers and replace with placeholder text for mermaid
      const clozeMap: { placeholder: string; clozeNum: string; text: string }[] = [];
      let cleanCode = code.replace(/\{\{c(\d+)::([\s\S]*?)\}\}/g, (_m, num: string, text: string) => {
        const placeholder = `CLOZE${num}X${clozeMap.length}`;
        clozeMap.push({ placeholder, clozeNum: num, text });
        return text; // render with plain text
      });

      // Fix common mermaid syntax issues
      cleanCode = cleanCode.replace(/→/g, "-->").replace(/←/g, "<--");
      // Ensure flowchart declaration is on its own line
      cleanCode = cleanCode.replace(/((?:flowchart|graph)\s+(?:TD|TB|BT|RL|LR))\s+([A-Za-z])/i, "$1\n    $2");
      // Ensure each node connection is on its own line
      cleanCode = cleanCode.replace(/\]\s+([A-Za-z]\w*)\s*(-->|---)/g, "]\n    $1 $2");
      cleanCode = cleanCode.replace(/\]\s+([A-Za-z]\w*)\[/g, "]\n    $1[");
      // Fix label pipes that might have been mangled
      cleanCode = cleanCode.replace(/\}\s+([A-Za-z]\w*)\s*(-->|---)/g, "}\n    $1 $2");

      try {
        const { svg } = await mermaid.render(`anki-mermaid-${Date.now()}-${i}`, cleanCode);

        // Re-inject cloze syntax: find the plain text in SVG and wrap with cloze markers
        let fixedSvg = svg;
        for (const { clozeNum, text } of clozeMap) {
          // The text appears in SVG <text>/<tspan> elements — replace the plain text with clozed version
          // Use a function to only replace the first occurrence
          const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const re = new RegExp(`(>)([^<]*?)(${escaped})([^<]*?<)`, "");
          if (re.test(fixedSvg)) {
            fixedSvg = fixedSvg.replace(re, `$1$2{{c${clozeNum}::${text}}}$4`);
          }
        }

        normalized = normalized.replace(fullMatch, fixedSvg);
      } catch (err) {
        console.warn("[MakeCard] Mermaid render failed, keeping raw code.", err);
        console.warn("[MakeCard] Attempted to render:\n", cleanCode);
      }
    }
  } catch {
    console.warn("[MakeCard] Mermaid import failed");
  }

  return normalized;
}

// ── Props ─────────────────────────────────────────────────────────────────

interface FlowViewProps {
  savedExtractions: SavedExtraction[];
  userTemplates: Template[];
  repo: string;
  vaultName: string;
  initialExtractionId?: string | null;
  onNewExtraction: (ext: SavedExtraction) => void;
  onDeleteExtraction: (id: string) => void;
  onExtractionChange?: (id: string | null) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function FlowView({ savedExtractions, userTemplates, repo, vaultName, initialExtractionId, onNewExtraction, onDeleteExtraction, onExtractionChange }: FlowViewProps) {
  // ID selection
  const [activeExtraction, setActiveExtraction] = useState<SavedExtraction | null>(null);
  const restoredRef = useRef(false);
  const [shortTitle, setShortTitle] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Panel focus
  const [focusedPanel, setFocusedPanel] = useState<"questions" | "editor" | "anki" | null>(null);

  // Question flow
  const [currentQuestion, setCurrentQuestion] = useState<MCQuestionItem | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<MCQuestionItem[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<number[]>([]);
  const [fetchingQuestion, setFetchingQuestion] = useState(false);
  const [mcFeedback, setMcFeedback] = useState<{ selected: number; correct: number } | null>(null);

  // Note generation
  const [generating, setGenerating] = useState(false);
  const [noteResult, setNoteResult] = useState<NoteResultItem | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [notePath, setNotePath] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Matching notes
  const [matchingNotes, setMatchingNotes] = useState<{ title: string; path: string }[]>([]);

  // Anki
  const [ankiCards, setAnkiCards] = useState<AnkiCard[]>([]);
  const [ankiLoading, setAnkiLoading] = useState(false);
  const [ankiError, setAnkiError] = useState("");
  const [makingCard, setMakingCard] = useState(false);
  const [makeCardMsg, setMakeCardMsg] = useState("");
  const [editingFlowCard, setEditingFlowCard] = useState<number | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [ankiSaving, setAnkiSaving] = useState(false);
  const [ankiEditError, setAnkiEditError] = useState("");
  const [selectedAnkiTemplate, setSelectedAnkiTemplate] = useState("");
  const [availableDecks, setAvailableDecks] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState("");
  const [clozeModels, setClozeModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [ankiPreview, setAnkiPreview] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("cloze");
  const [selectingForCard, setSelectingForCard] = useState(false);
  const [cardSelectionReady, setCardSelectionReady] = useState(false);
  const cardSelectionRef = useRef("");
  // Note format mode
  const [noteFormatMode, setNoteFormatMode] = useState<NoteFormatMode>("original");
  const [noteFormatting, setNoteFormatting] = useState(false);
  const noteFormatCacheRef = useRef<Record<string, string>>({});

  // Rewrite selection state
  const [rewriteMode, setRewriteMode] = useState<"expand" | "condense" | null>(null);
  const [rewriteSelectionReady, setRewriteSelectionReady] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewritePending, setRewritePending] = useState(false); // true after rewrite, waiting confirm/undo
  const [rewriteHighlight, setRewriteHighlight] = useState(""); // text to highlight — state so changes trigger re-render
  const rewriteSelectionRef = useRef("");
  const rewriteUndoRef = useRef<{ original: string; replacement: string } | null>(null);
  const notePreviewRef = useRef<HTMLDivElement>(null);
  const ankiFrontRef = useRef<HTMLDivElement>(null);
  const ankiBackRef = useRef<HTMLDivElement>(null);
  const ankiPreviewRef = useRef<HTMLDivElement>(null);

  // Default anki template
  useEffect(() => {
    if (!selectedAnkiTemplate) setSelectedAnkiTemplate("anki_cloze");
  }, [selectedAnkiTemplate]);

  // Fetch available decks and cloze-compatible models from AnkiConnect
  useEffect(() => {
    const fetchDecks = async () => {
      try {
        const decks = (await ankiConnect("deckNames")) as string[];
        setAvailableDecks(decks);
        const anking = decks.find((d) => d.toLowerCase().startsWith("anking"));
        setSelectedDeck(anking || decks[0] || "Default");
      } catch {}
    };
    const fetchModels = async () => {
      try {
        const modelNames = (await ankiConnect("modelNames")) as string[];
        // Check each model's templates to find actual cloze-type models
        const validCloze: string[] = [];
        for (const name of modelNames) {
          try {
            const templates = (await ankiConnect("modelTemplates", { modelName: name })) as Record<string, { Front: string; Back: string }>;
            const hasCloze = Object.values(templates).some(
              (t) => t.Front.includes("{{cloze:") || t.Back.includes("{{cloze:")
            );
            if (hasCloze) validCloze.push(name);
          } catch {}
        }
        console.log("[Anki] Cloze-compatible models:", validCloze);
        setClozeModels(validCloze);
        // Auto-select: prefer "Cloze", then first available
        const preferred = validCloze.find((m) => m === "Cloze")
          || validCloze.find((m) => m.toLowerCase().includes("cloze"))
          || validCloze[0] || "";
        setSelectedModel(preferred);
      } catch {}
    };
    fetchDecks();
    fetchModels();
  }, []);

  // Pre-process field content for preview: convert ```mermaid blocks and <div class="mermaid"> to renderable divs, strip cloze
  const preparePreviewHtml = useCallback((fieldContent: string): string => {
    let html = fieldContent;
    // Strip cloze markers for display
    html = html.replace(/\{\{c\d+::(.*?)\}\}/g, "$1");
    // Convert ```mermaid code blocks to <div class="mermaid">
    html = html.replace(/```mermaid\s*([\s\S]*?)```/g, (_m, code: string) => {
      let c = code;
      c = c.replace(/→/g, "-->").replace(/←/g, "<--");
      c = c.replace(/((?:flowchart|graph|sequenceDiagram)(?:\s+(?:TD|TB|BT|RL|LR))?)\s+([A-Za-z])/i, "$1\n    $2");
      c = c.replace(/\]\s+([A-Za-z]\w*)\s*(-->|---)/g, "]\n    $1 $2");
      c = c.replace(/\]\s+([A-Za-z]\w*)\[/g, "]\n    $1[");
      c = c.replace(/\}\s+([A-Za-z]\w*)\s*(-->|---)/g, "}\n    $1 $2");
      return `<div class="mermaid">${c.trim()}</div>`;
    });
    // Also fix arrows inside existing <div class="mermaid"> blocks
    html = html.replace(
      /(<div class="mermaid">)([\s\S]*?)(<\/div>)/gi,
      (_m, open: string, content: string, close: string) => {
        let f = content;
        f = f.replace(/→/g, "-->").replace(/←/g, "<--");
        f = f.replace(/((?:flowchart|graph|sequenceDiagram)(?:\s+(?:TD|TB|BT|RL|LR))?)\s+([A-Za-z])/i, "$1\n    $2");
        f = f.replace(/\]\s+([A-Za-z]\w*)\s*(-->|---)/g, "]\n    $1 $2");
        f = f.replace(/\]\s+([A-Za-z]\w*)\[/g, "]\n    $1[");
        f = f.replace(/\}\s+([A-Za-z]\w*)\s*(-->|---)/g, "}\n    $1 $2");
        return open + f + close;
      }
    );
    // Convert newlines to <br> OUTSIDE of mermaid divs only
    const parts = html.split(/(<div class="mermaid">[\s\S]*?<\/div>)/gi);
    html = parts.map((part) => {
      if (/^<div class="mermaid">/i.test(part)) return part; // keep mermaid newlines intact
      return part.replace(/\n/g, "<br/>");
    }).join("");
    return html;
  }, []);

  // Render .mermaid divs in the preview container
  const renderMermaidInPreview = useCallback(async () => {
    if (!ankiPreviewRef.current) return;
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: "dark", themeVariables: { primaryColor: "#7c3aed", primaryTextColor: "#fff", lineColor: "#a89cdc", secondaryColor: "#2d1b69" } });

      const mermaidDivs = ankiPreviewRef.current.querySelectorAll(".mermaid:not(.mermaid-rendered)");
      for (let i = 0; i < mermaidDivs.length; i++) {
        const el = mermaidDivs[i] as HTMLElement;
        // Get text, undo any <br/> that we added during preparePreviewHtml
        const code = (el.textContent || "").trim();
        if (!code) continue;
        try {
          const { svg } = await mermaid.render(`mermaid-${Date.now()}-${i}`, code);
          el.innerHTML = svg;
          el.classList.add("mermaid-rendered");
        } catch (err) {
          console.warn("[Mermaid] render error:", err, "\nCode:", code);
          el.innerHTML = `<pre style="color:#f87171;font-size:11px;white-space:pre-wrap">${code}\n\n[Mermaid syntax error]</pre>`;
          el.classList.add("mermaid-rendered");
        }
      }
    } catch { /* mermaid not available */ }
  }, []);

  // Render mermaid in preview mode
  useEffect(() => {
    if (ankiPreview) {
      const t = setTimeout(renderMermaidInPreview, 80);
      return () => clearTimeout(t);
    }
  }, [ankiPreview, editFront, editBack, renderMermaidInPreview]);

  // Note editor — noteRawMode toggles raw markdown textarea (escape hatch)
  const [noteRawMode, setNoteRawMode] = useState(false);
  const noteEditorRef = useRef<HTMLTextAreaElement>(null);

  // Upload
  const uploadRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractStatus, setExtractStatus] = useState("");

  // Active extraction tab
  type ExtTab = "question" | "chosen" | "correct" | "educational" | "explanation";
  const [activeExtTab, setActiveExtTab] = useState<ExtTab>("question");

  // ── Persist question history ─────────────────────────────────────────────

  useEffect(() => {
    if (!activeExtraction) return;
    if (diagnosticQuestions.length === 0 && questionCount === 0) return;
    const key = `qhist_${activeExtraction.id}`;
    saveUserData(key, {
      diagnosticQuestions,
      questionAnswers,
      previousQuestions,
      questionCount,
    });
  }, [activeExtraction, diagnosticQuestions, questionAnswers, previousQuestions, questionCount]);

  // ── Restore last active extraction on mount ─────────────────────────────

  useEffect(() => {
    if (restoredRef.current || !initialExtractionId || savedExtractions.length === 0) return;
    const ext = savedExtractions.find(e => e.id === initialExtractionId);
    if (ext) {
      selectExtraction(ext);
      restoredRef.current = true;
    }
  }, [savedExtractions, initialExtractionId]);

  // ── Close dropdown on outside click ─────────────────────────────────────

  useEffect(() => {
    if (!dropdownOpen) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [dropdownOpen]);

  // ── Generate short title when extraction changes ────────────────────────

  useEffect(() => {
    if (!activeExtraction) { setShortTitle(""); return; }

    // Check cache first — avoid regenerating on every reload
    const cacheKey = `title_${activeExtraction.id}`;
    const cached = getUserData<string | null>(cacheKey, null);
    if (cached) { setShortTitle(cached); return; }

    const eduObj = activeExtraction.extraction?.educational_objective;
    if (!eduObj) { setShortTitle(activeExtraction.title); return; }

    // Show fallback title while LLM generates the short one
    setShortTitle(activeExtraction.title);

    (async () => {
      try {
        const resp = await fetch("/api/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: eduObj }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const title = data.title || activeExtraction.title;
          setShortTitle(title);
          saveUserData(cacheKey, title);
        }
      } catch {
        setShortTitle(activeExtraction.title);
      }
    })();
  }, [activeExtraction]);

  // ── Fetch Anki cards when extraction changes ────────────────────────────

  useEffect(() => {
    if (!activeExtraction) { setAnkiCards([]); setAnkiError(""); return; }
    const qId = activeExtraction.questionId || activeExtraction.extraction?.question_id;
    if (!qId) { setAnkiCards([]); return; }

    setAnkiLoading(true);
    setAnkiError("");
    (async () => {
      try {
        const cardIds = (await ankiConnect("findCards", { query: `tag:*UWorld::${qId} OR tag:${qId}` })) as number[];
        if (!cardIds || cardIds.length === 0) { setAnkiCards([]); return; }
        const cardsInfo = (await ankiConnect("cardsInfo", { cards: cardIds.slice(-20).reverse() })) as any[];
        const noteIds = [...new Set(cardsInfo.map((c: any) => c.note as number))];
        const notesInfo = (await ankiConnect("notesInfo", { notes: noteIds })) as any[];
        const tagsByNote: Record<number, string[]> = {};
        for (const n of notesInfo) tagsByNote[n.noteId] = n.tags || [];

        const seen = new Set<number>();
        const cards: AnkiCard[] = [];
        for (const card of cardsInfo) {
          if (seen.has(card.note)) continue;
          seen.add(card.note);
          const fieldKeys = Object.keys(card.fields || {});
          const fieldVals = Object.values(card.fields || {}) as any[];
          cards.push({
            note_id: card.note,
            card_id: card.cardId,
            front: fieldVals[0]?.value ?? "",
            back: fieldVals[1]?.value ?? "",
            deck: card.deckName ?? "",
            tags: tagsByNote[card.note] ?? [],
            field_names: fieldKeys.slice(0, 2),
            suspended: card.queue === -1,
          });
        }
        setAnkiCards(cards);
      } catch (err: any) {
        const msg = err?.message || "";
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("unreachable")) {
          setAnkiError("Anki is not running.");
        } else {
          setAnkiError(msg || "AnkiConnect error.");
        }
      } finally {
        setAnkiLoading(false);
      }
    })();
  }, [activeExtraction]);

  // Find matching notes from GitHub (if auth available)
  useEffect(() => {
    if (!activeExtraction) { setMatchingNotes([]); return; }
    const qId = activeExtraction.questionId || activeExtraction.extraction?.question_id;
    if (!qId) { setMatchingNotes([]); return; }

    (async () => {
      try {
        const resp = await fetch("/api/list-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo }),
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const notes = data.notes || [];
        const matches = notes.filter((n: any) => (n.tags || []).includes(qId));
        setMatchingNotes(matches.map((n: any) => ({ title: n.title, path: n.path })));
        // Only load from GitHub if we don't already have cached content
        if (matches.length > 0 && !noteContent) loadNote(matches[0].path);
      } catch { /* ignore */ }
    })();
  }, [activeExtraction, repo]);

  // Sync contentEditable refs when editing card changes, switching from preview, or switching editor mode
  useEffect(() => {
    if (editingFlowCard !== null && !ankiPreview) {
      requestAnimationFrame(() => {
        if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = editFront;
        if (ankiBackRef.current) ankiBackRef.current.innerHTML = editBack;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingFlowCard, ankiPreview, editorMode]);

  // Render note preview HTML and apply highlight via DOM tree-walk
  // Uses ref-based rendering to avoid dangerouslySetInnerHTML wiping marks on re-render
  const applyNotePreview = useCallback(() => {
    const el = notePreviewRef.current;
    if (!el) return;
    // Only update base HTML if content changed (tracked by data attr)
    const currentHash = noteContent.length + "_" + noteContent.slice(0, 50);
    const hashChanged = el.getAttribute("data-hash") !== currentHash;
    if (hashChanged) {
      el.innerHTML = renderMarkdown(noteContent);
      el.setAttribute("data-hash", currentHash);
    }
    // Determine which text to highlight: card selection OR rewrite highlight
    const highlightTarget = rewriteHighlight
      || (cardSelectionReady && cardSelectionRef.current ? cardSelectionRef.current : "");
    // No highlight target → remove existing marks and return
    if (!highlightTarget) {
      if (!hashChanged) {
        el.querySelectorAll("mark.cardSelMark").forEach((m) => {
          const parent = m.parentNode;
          if (parent) { parent.replaceChild(document.createTextNode(m.textContent || ""), m); parent.normalize(); }
        });
      }
      return;
    }
    // If marks already exist and HTML wasn't reset, keep them (avoids fragile remove+reapply)
    if (!hashChanged && el.querySelector("mark.cardSelMark")) return;
    // Strip markdown formatting so selection text matches rendered HTML text nodes
    // Note: do NOT strip [[ ]] wikilinks — they render as literal text in the preview
    const stripMd = (s: string) => s
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^[-*+]\s+/gm, "")
      .replace(/^\d+\.\s+/gm, "");
    const target = stripMd(highlightTarget);
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let accumulated = "";
    const textNodes: { node: Text; start: number }[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const text = node.textContent || "";
      // Add virtual space between text nodes from different elements (e.g. table cells)
      // so the accumulated text matches what the browser returns from Selection.toString()
      if (accumulated.length > 0 && text.length > 0
        && !/\s/.test(accumulated[accumulated.length - 1])
        && !/\s/.test(text[0])) {
        accumulated += " ";
      }
      textNodes.push({ node, start: accumulated.length });
      accumulated += text;
    }
    const normalize = (s: string) => s.replace(/\s+/g, " ");
    const normalizedFull = normalize(accumulated);
    const normalizedTarget = normalize(target);
    const matchIdx = normalizedFull.indexOf(normalizedTarget);
    if (matchIdx === -1) {
      console.warn("[Highlight] Text match failed. Target:", normalizedTarget.slice(0, 80), "Full:", normalizedFull.slice(0, 200));
      return;
    }
    // Map normalized index → real index
    let ni = 0, ri = 0;
    while (ni < matchIdx && ri < accumulated.length) {
      if (/\s/.test(accumulated[ri])) { while (ri < accumulated.length && /\s/.test(accumulated[ri])) ri++; ni++; }
      else { ri++; ni++; }
    }
    const realStart = ri;
    ni = 0; ri = realStart;
    while (ni < normalizedTarget.length && ri < accumulated.length) {
      if (/\s/.test(accumulated[ri])) { while (ri < accumulated.length && /\s/.test(accumulated[ri])) ri++; ni++; }
      else { ri++; ni++; }
    }
    const realEnd = ri;
    // Wrap matching range in <mark> across text nodes
    const toWrap: { node: Text; markStart: number; markEnd: number }[] = [];
    for (const { node, start } of textNodes) {
      const len = node.textContent?.length || 0;
      const end = start + len;
      if (end <= realStart || start >= realEnd) continue;
      toWrap.push({ node, markStart: Math.max(0, realStart - start), markEnd: Math.min(len, realEnd - start) });
    }
    for (const { node, markStart, markEnd } of toWrap) {
      if (markStart >= markEnd) continue;
      try {
        const range = document.createRange();
        range.setStart(node, markStart);
        range.setEnd(node, markEnd);
        const mark = document.createElement("mark");
        mark.className = "cardSelMark";
        mark.style.background = "rgba(94, 106, 210, 0.25)";
        mark.style.borderBottom = "2px solid rgba(124, 58, 237, 0.5)";
        mark.style.borderRadius = "2px";
        mark.style.padding = "1px 0";
        range.surroundContents(mark);
      } catch { /* skip cross-element ranges */ }
    }
  }, [noteContent, cardSelectionReady, rewriteHighlight]);

  useEffect(() => { applyNotePreview(); }, [applyNotePreview, makingCard, noteRawMode]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const selectExtraction = (ext: SavedExtraction) => {
    setActiveExtraction(ext);
    onExtractionChange?.(ext.id);
    setDropdownOpen(false);
    setSaveMsg("");
    setMakeCardMsg("");
    setMatchingNotes([]);
    setCurrentQuestion(null);
    setMcFeedback(null);
    setActiveExtTab("question");

    // Reset note format cache
    noteFormatCacheRef.current = {};
    setNoteFormatMode("original");

    // Restore cached note
    const noteKey = `note_${ext.id}`;
    const cachedNote = getUserData<{ noteContent: string; notePath: string; noteResult: any } | null>(noteKey, null);
    if (cachedNote) {
      setNoteContent(cachedNote.noteContent || "");
      setNotePath(cachedNote.notePath || "");
      setNoteResult(cachedNote.noteResult || null);
      noteFormatCacheRef.current = { original: cachedNote.noteContent || "" };
    } else {
      setNoteResult(null);
      setNoteContent("");
      setNotePath("");
    }

    // Restore question history
    const qKey = `qhist_${ext.id}`;
    const savedHist = getUserData<{ diagnosticQuestions: any[]; questionAnswers: number[]; previousQuestions: string[]; questionCount: number } | null>(qKey, null);
    if (savedHist) {
      setDiagnosticQuestions(savedHist.diagnosticQuestions || []);
      setQuestionAnswers(savedHist.questionAnswers || []);
      setPreviousQuestions(savedHist.previousQuestions || []);
      setQuestionCount(savedHist.questionCount || 0);
    } else {
      setDiagnosticQuestions([]);
      setQuestionAnswers([]);
      setPreviousQuestions([]);
      setQuestionCount(0);
    }
  };

  const loadNote = async (path: string) => {
    try {
      const readResp = await fetch("/api/read-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notePath: path, repo }),
      });
      if (readResp.ok) {
        const readData = await readResp.json();
        setNoteContent(readData.content || "");
        setNotePath(path);
        noteFormatCacheRef.current = { original: readData.content || "" };
        setNoteFormatMode("original");
      }
    } catch { /* ignore */ }
  };

  // Split image into 4 quadrants using canvas
  const splitImageQuadrants = (file: File): Promise<string[]> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const hw = Math.ceil(img.width / 2);
        const hh = Math.ceil(img.height / 2);
        const quadrants: string[] = [];
        // A=top-left, B=top-right, C=bottom-left, D=bottom-right
        const regions = [
          { x: 0, y: 0 },
          { x: hw, y: 0 },
          { x: 0, y: hh },
          { x: hw, y: hh },
        ];
        for (const r of regions) {
          const c = document.createElement("canvas");
          c.width = hw;
          c.height = hh;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(img, r.x, r.y, hw, hh, 0, 0, hw, hh);
          quadrants.push(c.toDataURL("image/jpeg", 0.85));
        }
        resolve(quadrants);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setExtracting(true);
    try {
      // Step 1: OCR + split into quadrants
      setExtractStatus("Reading image…");
      const Tesseract = await import("tesseract.js");
      const textParts: string[] = [];
      const allQuadrants: string[][] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        if (imageFiles.length > 1) setExtractStatus(`Reading image ${i + 1}/${imageFiles.length}…`);
        const [ocrResult, quadrants] = await Promise.all([
          Tesseract.recognize(imageFiles[i], "eng"),
          splitImageQuadrants(imageFiles[i]),
        ]);
        textParts.push(ocrResult.data.text);
        allQuadrants.push(quadrants);
      }
      const ocrText = textParts.join("\n\n---\n\n");

      // Step 2: Send OCR text + quadrant images
      setExtractStatus("Analyzing…");
      const resp = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ocrText, quadrants: allQuadrants }),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => null);
        throw new Error(errData?.error || `Extraction failed (${resp.status})`);
      }
      const data = await resp.json();
      const extracted = data.result || data;
      const newExt: SavedExtraction = {
        id: Date.now().toString(),
        questionId: extracted.question_id || null,
        title: extracted.educational_objective || extracted.question?.slice(0, 60) || "New Extraction",
        extraction: extracted,
        savedAt: Date.now(),
      };
      onNewExtraction(newExt);
      selectExtraction(newExt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Extraction failed";
      alert(msg);
    } finally {
      setExtracting(false);
      setExtractStatus("");
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const fetchNextQuestion = async () => {
    if (!activeExtraction || fetchingQuestion) return;
    setFetchingQuestion(true);
    setMcFeedback(null);
    try {
      const difficulties = ["hard", "medium", "easy"];
      const difficulty = difficulties[questionCount % 3];
      const resp = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraction: activeExtraction.extraction,
          previous_questions: previousQuestions,
          difficulty_target: difficulty,
        }),
      });
      if (!resp.ok) throw new Error(`Questions error: ${resp.status}`);
      const data = await resp.json();
      const q = (data.questions || [])[0] as MCQuestionItem | undefined;
      if (q && q.question && Array.isArray(q.options) && q.options.length > 0) {
        setCurrentQuestion(q);
        setQuestionCount((c) => c + 1);
        setPreviousQuestions((prev) => [...prev, q.question]);
        setFocusedPanel("questions");
      }
    } catch { /* ignore */ }
    finally { setFetchingQuestion(false); }
  };

  const handleAnswer = (selectedIdx: number) => {
    if (!currentQuestion || mcFeedback) return;
    setMcFeedback({ selected: selectedIdx, correct: currentQuestion.correct });
    setDiagnosticQuestions((prev) => [...prev, currentQuestion]);
    setQuestionAnswers((prev) => [...prev, selectedIdx]);
  };

  const dismissFeedback = () => {
    setMcFeedback(null);
    setCurrentQuestion(null);
  };

  const handleGenerateNote = async (fromQuestionIndex?: number) => {
    if (!activeExtraction || generating) return;
    setGenerating(true);
    setSaveMsg("");
    setMakeCardMsg("");
    try {
      const template = userTemplates.find((t) => t.slug === "error_note_a")?.content || "";
      // If regenerating from a specific question, use only that question
      const questions = fromQuestionIndex !== undefined
        ? [diagnosticQuestions[fromQuestionIndex]]
        : diagnosticQuestions;
      const answers = fromQuestionIndex !== undefined
        ? [questionAnswers[fromQuestionIndex]]
        : questionAnswers;
      const questionsPayload = questions.map((q) => ({
        question: q.question,
        options: q.options,
        correct: q.correct,
        difficulty: q.difficulty,
      }));
      const answersPayload = answers.map((idx, i) =>
        questions[i] ? questions[i].options[idx] : ""
      );
      const resp = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraction: activeExtraction.extraction,
          questions: questionsPayload,
          answers: answersPayload,
          template,
        }),
      });
      if (!resp.ok) throw new Error("Generation failed");
      const result = await resp.json();
      const note = result.notes?.[0];
      if (note) {
        setNoteResult(note);
        setNoteContent(note.note_content || "");
        setNotePath(note.file_path || "");
        setFocusedPanel("editor");
        noteFormatCacheRef.current = { original: note.note_content || "" };
        setNoteFormatMode("original");
        // Cache so it survives reload
        saveUserData(`note_${activeExtraction.id}`, {
          noteContent: note.note_content || "",
          notePath: note.file_path || "",
          noteResult: note,
        });
        try {
          const saveResp = await fetch("/api/save-note", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notePath: note.file_path, content: note.note_content, repo }),
          });
          if (saveResp.ok) { setSaveMsg("Saved"); }
          else {
            saveViaObsidian(note.file_path, note.note_content);
            setSaveMsg("Saved via Obsidian");
          }
        } catch {
          try { saveViaObsidian(note.file_path, note.note_content); setSaveMsg("Saved via Obsidian"); }
          catch { /* silent */ }
        }
        setTimeout(() => setSaveMsg(""), 4000);
      }
    } catch { /* ignore */ }
    finally { setGenerating(false); }
  };

  const saveViaObsidian = (filePath: string, content: string) => {
    const uri = `obsidian://new?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath.replace(/\.md$/, ""))}&content=${encodeURIComponent(content)}&overwrite=true`;
    const a = document.createElement("a");
    a.href = uri;
    a.click();
  };

  const handleSaveNote = async () => {
    if (!notePath || savingNote) return;
    setSavingNote(true);
    setSaveMsg("");
    try {
      const resp = await fetch("/api/save-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notePath, content: noteContent, repo }),
      });
      if (resp.ok) { setSaveMsg("Saved"); }
      else {
        saveViaObsidian(notePath, noteContent);
        setSaveMsg("Saved via Obsidian");
      }
    } catch {
      try {
        saveViaObsidian(notePath, noteContent);
        setSaveMsg("Saved via Obsidian");
      } catch { setSaveMsg("Save failed"); }
    }
    finally {
      // Update cache with edited content
      if (activeExtraction) {
        saveUserData(`note_${activeExtraction.id}`, {
          noteContent, notePath, noteResult,
        });
      }
      setSavingNote(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  const startRewrite = (mode: "expand" | "condense") => {
    // Cancel any card selection in progress
    setSelectingForCard(false);
    setCardSelectionReady(false);
    cardSelectionRef.current = "";
    // Clear any pending rewrite
    setRewritePending(false);
    setRewriteHighlight("");
    rewriteUndoRef.current = null;
    // Enter rewrite selection mode
    setRewriteMode(mode);
    setRewriteSelectionReady(false);
    rewriteSelectionRef.current = "";
    // Ensure we're in visual mode (not raw) so user can select rendered text
    setNoteRawMode(false);
  };

  const cancelRewrite = () => {
    setRewriteMode(null);
    setRewriteSelectionReady(false);
    setRewritePending(false);
    rewriteSelectionRef.current = "";
    setRewriteHighlight("");
    rewriteUndoRef.current = null;
  };

  const confirmRewrite = () => {
    setRewriteHighlight("");
    rewriteUndoRef.current = null;
    setRewritePending(false);
    setRewriteMode(null);
    setRewriteSelectionReady(false);
    rewriteSelectionRef.current = "";
  };

  const undoRewrite = () => {
    if (rewriteUndoRef.current) {
      const { original, replacement } = rewriteUndoRef.current;
      const idx = noteContent.indexOf(replacement);
      if (idx !== -1) {
        setNoteContent(noteContent.substring(0, idx) + original + noteContent.substring(idx + replacement.length));
      }
    }
    setRewriteHighlight("");
    rewriteUndoRef.current = null;
    setRewritePending(false);
    setRewriteMode(null);
    setRewriteSelectionReady(false);
    rewriteSelectionRef.current = "";
  };

  const executeRewrite = async () => {
    if (!rewriteSelectionRef.current || !rewriteMode || rewriting) return;
    // Highlight the selected text during API call
    setRewriteHighlight(rewriteSelectionRef.current);
    setRewriting(true);
    try {
      const resp = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selected_text: rewriteSelectionRef.current,
          full_note: noteContent,
          mode: rewriteMode,
        }),
      });
      const data = await resp.json();
      if (data.success && data.rewritten) {
        const original = rewriteSelectionRef.current;
        const idx = noteContent.indexOf(original);
        if (idx !== -1) {
          const before = noteContent.substring(0, idx);
          const after = noteContent.substring(idx + original.length);
          setNoteContent(before + data.rewritten + after);
          // Highlight the NEW text and store undo info
          setRewriteHighlight(data.rewritten);
          rewriteUndoRef.current = { original, replacement: data.rewritten };
          setRewritePending(true);
          setRewriteSelectionReady(false);
        }
      }
    } catch (err) {
      console.error("[Rewrite] Error:", err);
      cancelRewrite();
    } finally {
      setRewriting(false);
    }
  };

  const handleMakeCard = async (templateSlug?: string, sourceText?: string) => {
    const content = sourceText || noteContent;
    if (!content || makingCard) return;
    // Keep selection for redo — don't clear cardSelectionRef
    setSelectingForCard(false);
    const slug = templateSlug || selectedAnkiTemplate;
    if (templateSlug) setSelectedAnkiTemplate(templateSlug);
    setMakingCard(true);
    setMakeCardMsg("");
    try {
      const deck = selectedDeck || "Default";
      const model = selectedModel || "Cloze";
      const tpl = userTemplates.find((t) => t.slug === slug)?.content
        || userTemplates.find((t) => t.category === "anki")?.content || "";
      console.log("[MakeCard] Using deck:", deck, "model:", model);

      const resp = await fetch("/api/create-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_content: content, template: tpl }),
      });
      const data = await resp.json();
      console.log("[MakeCard] LLM response:", data);
      console.log("[MakeCard] Front content:", data.front);

      if (!data.success || !data.front) {
        setMakeCardMsg(data.error || "LLM failed to generate card");
        return;
      }

      // Ensure front has cloze syntax — Anki rejects cloze notes without {{c1::}}
      let front: string = data.front;
      // Decode HTML entities that might hide cloze syntax
      const decoded = front.replace(/&lbrace;/g, "{").replace(/&rbrace;/g, "}").replace(/&#123;/g, "{").replace(/&#125;/g, "}");
      if (decoded !== front) {
        front = decoded;
        console.log("[MakeCard] Decoded HTML entities in front");
      }
      if (!/\{\{c\d+::/i.test(front)) {
        console.warn("[MakeCard] Front has no cloze deletions, auto-wrapping first sentence");
        // Strip HTML for clean text to wrap
        const textOnly = front.replace(/<[^>]*>/g, "").trim();
        const match = textOnly.match(/^(.{10,80}?[.?!])\s/);
        if (match) {
          front = `{{c1::${match[1]}}} ${textOnly.substring(match[0].length)}`;
        } else {
          front = `{{c1::${textOnly}}}`;
        }
        console.log("[MakeCard] Fixed front:", front);
      }

      // Render mermaid to inline SVG for Anki (Anki can't run mermaid.js)
      if (/mermaid|flowchart\s+TD/i.test(front)) {
        console.log("[MakeCard] Rendering mermaid to SVG for Anki...");
        front = await renderMermaidToSvg(front);
      }

      // Try adding with selected model, then fallback to other cloze models
      const modelsToTry = [model, ...clozeModels.filter((m) => m !== model)];
      let noteId: unknown = null;
      let usedModel = model;
      const backStr = String(data.back || "");
      // Strip cloze syntax from back — only the cloze-template field should have {{cN::}}
      const cleanBack = backStr.replace(/\{\{c\d+::([\s\S]*?)\}\}/g, "$1");
      console.log("[MakeCard] Back content:", backStr.substring(0, 200));

      for (const tryModel of modelsToTry) {
        try {
          const modelFields = (await ankiConnect("modelFieldNames", { modelName: tryModel })) as string[];
          console.log("[MakeCard] Trying model:", tryModel, "fields:", modelFields);

          // Find the actual cloze field from the model template ({{cloze:FieldName}})
          let clozeFieldName = modelFields[0];
          try {
            const templates = (await ankiConnect("modelTemplates", { modelName: tryModel })) as Record<string, { Front: string; Back: string }>;
            for (const tmpl of Object.values(templates)) {
              const clozeMatch = (tmpl.Front + " " + tmpl.Back).match(/\{\{cloze:([^}]+)\}\}/);
              if (clozeMatch) {
                clozeFieldName = clozeMatch[1].trim();
                break;
              }
            }
          } catch {}

          // Build fields: cloze field gets front, first other field gets clean back
          const fields: Record<string, string> = {};
          fields[clozeFieldName] = front;
          const backField = modelFields.find((f) => f !== clozeFieldName);
          if (backField) fields[backField] = cleanBack;
          console.log("[MakeCard] Cloze field:", clozeFieldName, "payload:", JSON.stringify(fields).substring(0, 500));

          noteId = await ankiConnect("addNote", {
            note: {
              deckName: deck,
              modelName: tryModel,
              fields,
              tags: activeExtraction?.questionId ? [String(activeExtraction.questionId)] : [],
              options: { allowDuplicate: true, duplicateScope: "deck" },
            },
          });
          if (noteId) {
            usedModel = tryModel;
            console.log("[MakeCard] Success with model:", tryModel, "noteId:", noteId);
            break;
          }
        } catch (e: any) {
          console.warn("[MakeCard] Model", tryModel, "failed:", e?.message);
          // Continue to next model
        }
      }

      if (noteId) {
        setMakeCardMsg(`Card added (${usedModel})`);
        if (usedModel !== model) {
          setSelectedModel(usedModel);
        }
      } else {
        // Fallback: open card in Anki's Add Cards dialog
        try {
          await ankiConnect("guiAddCards", {
            note: {
              deckName: deck,
              modelName: model,
              fields: { Text: front },
              tags: [],
            },
          });
          setMakeCardMsg("Opened in Anki — click Add to save.");
        } catch {
          setMakeCardMsg("All models failed — try updating AnkiConnect add-on.");
        }
      }
      // Re-fetch anki cards for this extraction
      setActiveExtraction((prev) => prev ? { ...prev } : null);
    } catch (err: any) {
      const msg = err?.message || "";
      console.error("[MakeCard] Error:", msg, err);
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setMakeCardMsg("Anki not running — open Anki desktop first");
      } else {
        setMakeCardMsg(msg || "Failed to create card");
      }
    } finally {
      setMakingCard(false);
      setTimeout(() => setMakeCardMsg(""), 10000);
    }
  };

  const handleSaveAnkiCard = async (card: AnkiCard) => {
    setAnkiSaving(true);
    setAnkiEditError("");
    try {
      const fields: Record<string, string> = {};
      if (card.field_names[0]) fields[card.field_names[0]] = editFront;
      if (card.field_names[1]) fields[card.field_names[1]] = editBack;
      await ankiConnect("updateNoteFields", { note: { id: card.note_id, fields } });
      // Move to new deck if changed
      if (selectedDeck && selectedDeck !== card.deck) {
        await ankiConnect("changeDeck", { cards: [card.card_id], deck: selectedDeck });
      }
      setAnkiCards((prev) =>
        prev.map((c) => c.note_id === card.note_id ? { ...c, front: editFront, back: editBack, deck: selectedDeck || c.deck } : c)
      );
      setEditingFlowCard(null);
    } catch (err: unknown) {
      setAnkiEditError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setAnkiSaving(false);
    }
  };

  const handleToggleSuspend = async (card: AnkiCard) => {
    try {
      if (card.suspended) {
        await ankiConnect("unsuspend", { cards: [card.card_id] });
      } else {
        await ankiConnect("suspend", { cards: [card.card_id] });
      }
      setAnkiCards((prev) =>
        prev.map((c) => c.note_id === card.note_id ? { ...c, suspended: !c.suspended } : c)
      );
    } catch {
      setAnkiEditError(`${card.suspended ? "Unsuspend" : "Suspend"} failed — is Anki open?`);
    }
  };

  const handleDeleteAnkiCard = async (card: AnkiCard) => {
    try {
      await ankiConnect("deleteNotes", { notes: [card.note_id] });
      setAnkiCards((prev) => prev.filter((c) => c.note_id !== card.note_id));
      setEditingFlowCard(null);
    } catch (err: unknown) {
      setAnkiEditError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  const [ankiFormatting, setAnkiFormatting] = useState(false);
  // Store each mode's content independently so switching preserves all versions
  const modeContentRef = useRef<Record<string, string>>({});

  // Keep cache in sync whenever editFront changes within a mode
  useEffect(() => {
    modeContentRef.current[editorMode] = editFront;
  }, [editFront, editorMode]);

  /** Unified handler: switch editor mode. Question/Table/Mermaid format via API, Cloze restores original. */
  const handleSwitchEditor = async (mode: EditorMode) => {
    // Save current mode's content before switching (belt-and-suspenders with the effect above)
    modeContentRef.current[editorMode] = editFront;

    const targetMode = (editorMode === mode) ? "cloze" : mode;

    if (targetMode === "cloze") {
      // Always restore the exact cached cloze content
      const clozeContent = modeContentRef.current["cloze"] || editFront;
      setEditFront(clozeContent);
      if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = clozeContent;
      setEditorMode("cloze");
      return;
    }
    // If we already have cached content for this mode, restore it without re-formatting
    if (modeContentRef.current[targetMode]) {
      setEditFront(modeContentRef.current[targetMode]);
      if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = modeContentRef.current[targetMode];
      setEditorMode(targetMode);
      return;
    }
    // Mermaid: if cloze content already has mermaid block, use it directly
    if (targetMode === "mermaid" && /```mermaid/i.test(modeContentRef.current["cloze"] || editFront)) {
      const content = modeContentRef.current["cloze"] || editFront;
      modeContentRef.current["mermaid"] = content;
      setEditFront(content);
      setEditorMode("mermaid");
      return;
    }
    // Question / Table / Mermaid: format via API using the CLOZE content as source (never current editFront)
    setAnkiFormatting(true);
    setAnkiEditError("");
    try {
      const sourceContent = modeContentRef.current["cloze"] || editFront;
      const slug = targetMode === "question" ? "anki_cloze" : targetMode === "table" ? "anki_table" : "anki_mermaid";
      const tpl = userTemplates.find((t) => t.slug === slug)?.content || "";
      const resp = await fetch("/api/format-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: sourceContent, template: tpl }),
      });
      const data = await resp.json();
      if (data.success) {
        modeContentRef.current[targetMode] = data.front;
        setEditFront(data.front);
        if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = data.front;
        setEditorMode(targetMode);
      } else {
        setAnkiEditError(data.error || "Format failed");
      }
    } catch {
      setAnkiEditError("Format request failed");
    } finally {
      setAnkiFormatting(false);
    }
  };

  /** Re-generate the current format from cloze source (clears cache, re-calls API). */
  const handleRegenerate = async () => {
    if (editorMode === "cloze") return;
    const mode = editorMode;
    // Clear cached content so handleSwitchEditor forces a fresh API call
    modeContentRef.current[mode] = "";
    // Briefly go to cloze so handleSwitchEditor doesn't toggle off
    setEditorMode("cloze");
    await new Promise((r) => setTimeout(r, 0));
    await handleSwitchEditor(mode);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const ext = activeExtraction?.extraction;
  const qId = activeExtraction?.questionId || ext?.question_id || null;
  const hasAnswered = questionAnswers.length > 0;
  const displayTitle = shortTitle || activeExtraction?.title || "";

  // ── Auto-focus textarea when entering edit mode ────────────────────────

  useEffect(() => {
    if (noteRawMode && noteEditorRef.current) {
      noteEditorRef.current.focus();
    }
  }, [noteRawMode]);

  // ── WYSIWYG toolbar helpers (execCommand on preview div) ──────────────

  /** Sync preview div HTML → markdown in noteContent */
  const syncPreviewToMarkdown = useCallback(() => {
    const el = notePreviewRef.current;
    if (!el) return;
    const md = turndown.turndown(el.innerHTML);
    setNoteContent(md);
    noteFormatCacheRef.current[noteFormatMode] = md;
    // Update hash so applyNotePreview doesn't overwrite DOM
    el.setAttribute("data-hash", md.length + "_" + md.slice(0, 50));
  }, [noteFormatMode]);

  // ── Note format switching ──────────────────────────────────────────────
  const NOTE_FORMAT_SLUGS: Record<string, string> = {
    error_note: "error_note_a",
    comparison: "error_note_comparison",
    mechanism: "error_note_mechanism",
  };

  const handleSwitchNoteFormat = async (mode: NoteFormatMode) => {
    if (mode === "original" || noteFormatting) return;

    // Cache current content
    noteFormatCacheRef.current[noteFormatMode] = noteContent;

    // Toggle off if clicking active button
    if (mode === noteFormatMode) {
      const orig = noteFormatCacheRef.current["original"] || noteContent;
      setNoteContent(orig);
      setNoteFormatMode("original");
      return;
    }

    // Cache hit — restore without API call
    if (noteFormatCacheRef.current[mode]) {
      setNoteContent(noteFormatCacheRef.current[mode]);
      setNoteFormatMode(mode);
      return;
    }

    // Cache miss — call API
    setNoteFormatting(true);
    setNoteFormatMode(mode);
    try {
      const slug = NOTE_FORMAT_SLUGS[mode];
      const tpl = userTemplates.find((t) => t.slug === slug);
      if (!tpl) throw new Error(`Template ${slug} not found`);

      const resp = await fetch("/api/format-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_content: noteFormatCacheRef.current["original"] || noteContent,
          extraction: activeExtraction?.extraction || {},
          template: tpl.content,
        }),
      });
      if (!resp.ok) throw new Error("Format failed");
      const data = await resp.json();
      if (!data.success) throw new Error(data.error || "Format failed");

      noteFormatCacheRef.current[mode] = data.content;
      setNoteContent(data.content);
    } catch {
      // Revert on failure
      setNoteFormatMode(noteFormatMode === mode ? "original" : noteFormatMode);
    } finally {
      setNoteFormatting(false);
    }
  };

  const execFormat = (cmd: string, value?: string) => {
    notePreviewRef.current?.focus();
    document.execCommand(cmd, false, value);
    syncPreviewToMarkdown();
  };

  const execHeading = (tag: string) => {
    notePreviewRef.current?.focus();
    document.execCommand("formatBlock", false, tag);
    syncPreviewToMarkdown();
  };

  const insertHtmlBlock = (html: string) => {
    notePreviewRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    syncPreviewToMarkdown();
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={styles.flowContainer}>
      {/* Sidebar toggle */}
      <button className={styles.flowSidebarToggle} onClick={() => setSidebarOpen(true)} title="Extractions">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>

      {/* Sidebar backdrop */}
      {sidebarOpen && <div className={styles.flowSidebarBackdrop} onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <div className={`${styles.flowSidebar} ${sidebarOpen ? styles.flowSidebarOpen : ""}`}>
        <div className={styles.flowSidebarHeader}>
          <span>Extractions</span>
          <button className={styles.flowSidebarClose} onClick={() => setSidebarOpen(false)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className={styles.flowSidebarList}>
          {savedExtractions.length === 0 ? (
            <div className={styles.flowSidebarEmpty}>No extractions yet</div>
          ) : (
            savedExtractions.map((e) => (
              <div
                key={e.id}
                className={`${styles.flowSidebarItem} ${activeExtraction?.id === e.id ? styles.flowSidebarItemActive : ""}`}
                onClick={() => { selectExtraction(e); setSidebarOpen(false); }}
              >
                <div className={styles.flowSidebarItemContent}>
                  <span className={styles.flowSidebarItemQid}>{e.questionId || "?"}</span>
                  <span className={styles.flowSidebarItemTitle}>{e.title?.slice(0, 45)}</span>
                </div>
                <button
                  className={styles.flowSidebarItemDelete}
                  onClick={(ev) => { ev.stopPropagation(); onDeleteExtraction(e.id); if (activeExtraction?.id === e.id) setActiveExtraction(null); }}
                  title="Delete"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Top controls */}
      <div className={styles.flowTopSection}>
        <button className={styles.flowIdBtn} onClick={() => uploadRef.current?.click()} disabled={extracting}>
          {extracting ? (extractStatus || "Extracting…") : "Upload Screenshot"}
        </button>
        <input ref={uploadRef} type="file" accept="image/*" multiple className={styles.flowUploadInput} onChange={(e) => handleUpload(e.target.files)} />
        <div className={styles.flowIdDropdown} ref={dropdownRef}>
          <button
            className={`${styles.flowSelectorBtn} ${activeExtraction ? "" : styles.flowSelectorBtnEmpty}`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <span className={styles.flowSelectorArrow}>▼</span>
            {activeExtraction
              ? <>{qId || "?"} — {displayTitle}</>
              : "No extraction selected"
            }
          </button>
          {dropdownOpen && (
            <div className={styles.flowIdDropdownMenu}>
              {savedExtractions.length === 0 ? (
                <div className={styles.flowIdDropdownItem} style={{ cursor: "default", color: "var(--text-muted)" }}>
                  No extractions yet
                </div>
              ) : (
                savedExtractions.map((e) => (
                  <button key={e.id} className={styles.flowIdDropdownItem} onClick={() => selectExtraction(e)}>
                    <div className={styles.flowIdDropdownTitle}>
                      {e.questionId || "?"} — {e.title?.slice(0, 50)}
                    </div>
                    <div className={styles.flowIdDropdownMeta}>
                      {new Date(e.savedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Three panels */}
      <div className={styles.flowPanels}>
        {/* ── Questions Panel ── */}
        <div
          className={`${styles.flowPanel} ${focusedPanel === "questions" ? styles.flowPanelFocused : focusedPanel ? styles.flowPanelShrunk : ""}`}
          onClick={() => setFocusedPanel(focusedPanel === "questions" ? null : "questions")}
        >
          <div className={styles.flowPanelHeader}>Questions</div>
          <div className={styles.flowPanelBody}>
            {!activeExtraction ? (
              <div className={styles.flowEmpty}>Select an extraction or upload a screenshot to begin</div>
            ) : currentQuestion ? (
              /* ── Active MC question ── */
              <div className={styles.flowExtSummary} onClick={(e) => e.stopPropagation()}>
                <div className={styles.flowExtField}>
                  <div className={styles.flowExtFieldLabel}>
                    Question {questionCount} · {currentQuestion.difficulty}
                  </div>
                  <div className={styles.flowExtFieldValue}>{currentQuestion.question}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {currentQuestion.options.map((opt, i) => {
                    let optStyle: React.CSSProperties = {
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                      background: "var(--bg-elevated)",
                      color: "var(--text)",
                      fontSize: 13,
                      fontFamily: "inherit",
                      cursor: mcFeedback ? "default" : "pointer",
                      textAlign: "left" as const,
                      transition: "all 150ms",
                    };
                    if (mcFeedback) {
                      if (i === mcFeedback.correct) {
                        optStyle = { ...optStyle, borderColor: "var(--green)", background: "rgba(34,197,94,0.12)", color: "var(--green)" };
                      } else if (i === mcFeedback.selected && mcFeedback.selected !== mcFeedback.correct) {
                        optStyle = { ...optStyle, borderColor: "var(--red)", background: "rgba(239,68,68,0.12)", color: "var(--red)" };
                      }
                    }
                    return (
                      <button key={i} style={optStyle} onClick={() => handleAnswer(i)}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {mcFeedback && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className={styles.flowGenerateBtn} onClick={() => {
                      const wasCorrect = mcFeedback.selected === mcFeedback.correct;
                      dismissFeedback();
                      if (wasCorrect) fetchNextQuestion();
                      else handleGenerateNote();
                    }} style={{ flex: 1, marginTop: 0 }}>
                      {mcFeedback.selected === mcFeedback.correct ? "Next Question" : "Generate Note"}
                    </button>
                    {mcFeedback.selected === mcFeedback.correct && (
                      <button
                        className={styles.flowGenerateBtn}
                        onClick={() => { dismissFeedback(); handleGenerateNote(); }}
                        style={{ flex: 1, marginTop: 0, background: "var(--bg-elevated)", border: "1px solid var(--accent)" }}
                      >
                        Skip to Note
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* ── Summary view with generate button on top ── */
              <div className={styles.flowExtSummary} onClick={(e) => e.stopPropagation()}>
                {/* Generate Question button — FIRST */}
                <button
                  className={styles.flowGenerateBtn}
                  onClick={fetchNextQuestion}
                  disabled={fetchingQuestion}
                  style={{ marginTop: 0, marginBottom: 12 }}
                >
                  {fetchingQuestion ? "Generating…" : questionCount > 0 ? "More Questions" : "Generate Question"}
                </button>

                {hasAnswered && (
                  <button
                    className={styles.flowGenerateBtn}
                    onClick={() => handleGenerateNote()}
                    disabled={generating}
                    style={{ marginTop: 0, marginBottom: 12, background: "var(--bg-elevated)", border: "1px solid var(--accent)" }}
                  >
                    {generating ? "Generating Note…" : "Generate Note"}
                  </button>
                )}

                {/* Extraction tab navbar */}
                <div className={styles.flowExtTabs}>
                  <button className={`${styles.flowExtTab} ${activeExtTab === "question" ? styles.flowExtTabActive : ""}`} onClick={() => setActiveExtTab("question")}>Question</button>
                  <button className={`${styles.flowExtTab} ${activeExtTab === "chosen" ? styles.flowExtTabActive : ""}`} onClick={() => setActiveExtTab("chosen")}>Chosen</button>
                  <button className={`${styles.flowExtTab} ${activeExtTab === "correct" ? styles.flowExtTabActive : ""}`} onClick={() => setActiveExtTab("correct")}>Correct</button>
                  <button className={`${styles.flowExtTab} ${activeExtTab === "educational" ? styles.flowExtTabActive : ""}`} onClick={() => setActiveExtTab("educational")}>Educational</button>
                  <button className={`${styles.flowExtTab} ${activeExtTab === "explanation" ? styles.flowExtTabActive : ""}`} onClick={() => setActiveExtTab("explanation")}>Explanation</button>
                </div>

                {/* Tab content — scrollable */}
                <div className={styles.flowExtTabContent}>
                  {activeExtTab === "question" && (ext?.question || <span className={styles.flowExtTabEmpty}>No question extracted</span>)}
                  {activeExtTab === "chosen" && (ext?.choosed_alternative || <span className={styles.flowExtTabEmpty}>No chosen alternative extracted</span>)}
                  {activeExtTab === "correct" && (ext?.wrong_alternative || <span className={styles.flowExtTabEmpty}>No correct alternative extracted</span>)}
                  {activeExtTab === "educational" && (ext?.educational_objective || <span className={styles.flowExtTabEmpty}>No educational objective extracted</span>)}
                  {activeExtTab === "explanation" && (ext?.full_explanation || <span className={styles.flowExtTabEmpty}>No explanation extracted</span>)}
                </div>

                {/* Past questions list — always visible */}
                <div className={styles.flowPastHeader}>Past Questions ({diagnosticQuestions.length})</div>
                {diagnosticQuestions.length === 0 ? (
                  <div className={styles.flowPriorEmpty}>No questions generated yet</div>
                ) : (
                  diagnosticQuestions.map((dq, i) => {
                    const answerIdx = questionAnswers[i];
                    const wasCorrect = answerIdx === dq.correct;
                    return (
                      <div key={i} className={styles.flowPriorQuestion}>
                        <div className={styles.flowPriorQuestionHeader}>
                          <div className={`${styles.flowPriorQuestionDiff} ${wasCorrect ? styles.flowPriorCorrect : styles.flowPriorWrong}`}>
                            {dq.difficulty} · {wasCorrect ? "Correct" : "Wrong"}
                          </div>
                          <button
                            className={styles.flowRemakeBtn}
                            onClick={(e) => { e.stopPropagation(); handleGenerateNote(i); }}
                            disabled={generating}
                            title="Regenerate note from this question"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                            Remake
                          </button>
                        </div>
                        <div>{dq.question.slice(0, 100)}{dq.question.length > 100 ? "…" : ""}</div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Note Editor Panel ── */}
        <div
          className={`${styles.flowPanel} ${focusedPanel === "editor" ? styles.flowPanelFocused : focusedPanel ? styles.flowPanelShrunk : ""}`}
          onClick={() => { if (!selectingForCard) setFocusedPanel(focusedPanel === "editor" ? null : "editor"); }}
        >
          <div className={styles.flowPanelHeader}>
            Note Editor
            {noteContent && (
              <button
                className={styles.flowEditorToggle}
                onClick={(e) => { e.stopPropagation(); setNoteRawMode(!noteRawMode); }}
                title={noteRawMode ? "Visual editor" : "Raw markdown"}
              >
                {noteRawMode ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                )}
              </button>
            )}
          </div>
          {noteContent ? (
            <>
              <div className={styles.flowToolbar} onClick={(e) => e.stopPropagation()}>
                {matchingNotes.length > 0 && (
                  <select
                    className={styles.flowToolbarSelect}
                    value={notePath}
                    onChange={(e) => { e.stopPropagation(); loadNote(e.target.value); setNoteRawMode(false); }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {matchingNotes.map((n) => (
                      <option key={n.path} value={n.path}>{n.title}</option>
                    ))}
                  </select>
                )}
                <div className={styles.flowToolbarDivider} />
                <button className={styles.flowToolbarBtn} onClick={() => execHeading("h2")} disabled={noteRawMode} title="Heading"><strong style={{ fontSize: 12 }}>H</strong></button>
                <button className={styles.flowToolbarBtn} onClick={() => execFormat("bold")} disabled={noteRawMode} title="Bold"><strong>B</strong></button>
                <button className={styles.flowToolbarBtn} onClick={() => execFormat("italic")} disabled={noteRawMode} title="Italic"><em style={{ fontFamily: "Georgia, serif" }}>I</em></button>
                <button className={styles.flowToolbarBtn} onClick={() => execFormat("insertUnorderedList")} disabled={noteRawMode} title="Bullet list">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </button>
                <button className={styles.flowToolbarBtn} onClick={() => { notePreviewRef.current?.focus(); const sel = window.getSelection(); if (sel && sel.rangeCount) { const range = sel.getRangeAt(0); const code = document.createElement("code"); range.surroundContents(code); syncPreviewToMarkdown(); } }} disabled={noteRawMode} title="Inline code" style={{ fontFamily: "monospace", fontSize: 11 }}>&lt;/&gt;</button>
                <div className={styles.flowToolbarDivider} />
                <button
                  className={`${styles.flowToolbarBtn} ${styles.noteFormatBtn} ${noteFormatMode === "error_note" ? styles.noteFormatBtnActive : ""}`}
                  onClick={() => handleSwitchNoteFormat("error_note")}
                  disabled={noteFormatting || noteRawMode}
                  title="Error Note format"
                >Error</button>
                <button
                  className={`${styles.flowToolbarBtn} ${styles.noteFormatBtn} ${noteFormatMode === "comparison" ? styles.noteFormatBtnActive : ""}`}
                  onClick={() => handleSwitchNoteFormat("comparison")}
                  disabled={noteFormatting || noteRawMode}
                  title="Comparison format"
                >Compare</button>
                <button
                  className={`${styles.flowToolbarBtn} ${styles.noteFormatBtn} ${noteFormatMode === "mechanism" ? styles.noteFormatBtnActive : ""}`}
                  onClick={() => handleSwitchNoteFormat("mechanism")}
                  disabled={noteFormatting || noteRawMode}
                  title="Mechanism Map format"
                >Mechanism</button>
                <div className={styles.flowToolbarDivider} />
                <button
                  className={`${styles.flowToolbarBtn} ${styles.flowRewriteBtn} ${rewriteMode === "expand" ? styles.flowRewriteBtnActive : ""}`}
                  onClick={() => rewriteMode === "expand" ? cancelRewrite() : startRewrite("expand")}
                  disabled={rewriting}
                  title="Expand — select text to add more detail"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                </button>
                <button
                  className={`${styles.flowToolbarBtn} ${styles.flowRewriteBtn} ${rewriteMode === "condense" ? styles.flowRewriteBtnActive : ""}`}
                  onClick={() => rewriteMode === "condense" ? cancelRewrite() : startRewrite("condense")}
                  disabled={rewriting}
                  title="Condense — select text to make it more concise"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                </button>
                <div style={{ flex: 1 }} />
                {saveMsg && <span className={styles.flowToolbarSaveMsg}>{saveMsg}</span>}
                <button
                  className={styles.flowToolbarSaveBtn}
                  onClick={(e) => { e.stopPropagation(); handleSaveNote(); }}
                  disabled={savingNote}
                >
                  {savingNote ? "Saving…" : "Save"}
                </button>
              </div>
              <div className={styles.flowPanelBody} onClick={(e) => e.stopPropagation()}>
                {selectingForCard && !cardSelectionReady && (
                  <div className={styles.flowSelectionBanner}>
                    Select text from the note to create a card
                  </div>
                )}
                {rewriteMode && (
                  <div className={styles.flowSelectionBanner}>
                    {rewritePending
                      ? `${rewriteMode === "expand" ? "Expanded" : "Condensed"} — confirm or undo?`
                      : rewriting
                        ? `${rewriteMode === "expand" ? "Expanding" : "Condensing"}…`
                        : rewriteSelectionReady
                          ? `"${rewriteSelectionRef.current.length > 50 ? rewriteSelectionRef.current.slice(0, 50) + "…" : rewriteSelectionRef.current}"`
                          : `Select text to ${rewriteMode}`}
                  </div>
                )}
                {rewriteMode && !rewriting && rewriteSelectionReady && !rewritePending && (
                  <div className={styles.flowRewriteActions}>
                    <button className={styles.flowRewriteConfirmBtn} onClick={executeRewrite}>
                      {rewriteMode === "expand" ? "Expand Selection" : "Condense Selection"}
                    </button>
                    <button className={styles.flowRewriteCancelBtn} onClick={cancelRewrite}>Cancel</button>
                  </div>
                )}
                {rewritePending && (
                  <div className={styles.flowRewriteActions}>
                    <button className={styles.flowRewriteConfirmBtn} onClick={confirmRewrite}>Confirm</button>
                    <button className={styles.flowRewriteCancelBtn} onClick={undoRewrite}>Undo</button>
                  </div>
                )}
                {noteRawMode && !selectingForCard && !rewriteMode ? (
                  <textarea
                    ref={noteEditorRef}
                    className={styles.flowNoteEditor}
                    value={noteContent}
                    onChange={(e) => { setNoteContent(e.target.value); noteFormatCacheRef.current[noteFormatMode] = e.target.value; }}
                    spellCheck={false}
                    onKeyDown={(e) => { if (e.key === "Escape") setNoteRawMode(false); }}
                  />
                ) : (
                  <div
                    ref={notePreviewRef}
                    className={`${styles.flowNotePreview} ${selectingForCard || cardSelectionReady || rewriteMode ? styles.flowNotePreviewSelecting : ""}`}
                    contentEditable={!selectingForCard && !cardSelectionReady && !rewriteMode}
                    suppressContentEditableWarning
                    onInput={() => { if (!selectingForCard && !rewriteMode) syncPreviewToMarkdown(); }}
                    onMouseUp={() => {
                      if (!selectingForCard && !rewriteMode) return;
                      setTimeout(() => {
                        const sel = window.getSelection();
                        const text = sel?.toString().trim() || "";
                        if (!text || !sel || sel.rangeCount === 0) return;
                        if (rewriteMode) {
                          rewriteSelectionRef.current = text;
                          setRewriteHighlight(text);
                          setRewriteSelectionReady(true);
                        } else {
                          // Remove any existing card selection marks first
                          const el = notePreviewRef.current;
                          if (el) {
                            el.querySelectorAll("mark.cardSelMark").forEach((m) => {
                              const p = m.parentNode;
                              if (p) { p.replaceChild(document.createTextNode(m.textContent || ""), m); p.normalize(); }
                            });
                          }
                          // Apply marks directly from browser selection range
                          const range = sel.getRangeAt(0);
                          if (el && el.contains(range.commonAncestorContainer)) {
                            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                            const nodesToMark: { node: Text; start: number; end: number }[] = [];
                            while (walker.nextNode()) {
                              const node = walker.currentNode as Text;
                              if (!range.intersectsNode(node)) continue;
                              let s = 0, e = (node.textContent || "").length;
                              if (node === range.startContainer) s = range.startOffset;
                              if (node === range.endContainer) e = range.endOffset;
                              if (s < e) nodesToMark.push({ node, start: s, end: e });
                            }
                            for (const { node, start, end } of nodesToMark.reverse()) {
                              try {
                                const r = document.createRange();
                                r.setStart(node, start);
                                r.setEnd(node, end);
                                const mark = document.createElement("mark");
                                mark.className = "cardSelMark";
                                mark.style.background = "rgba(94, 106, 210, 0.25)";
                                mark.style.borderBottom = "2px solid rgba(124, 58, 237, 0.5)";
                                mark.style.borderRadius = "2px";
                                mark.style.padding = "1px 0";
                                r.surroundContents(mark);
                              } catch { /* skip cross-element edge cases */ }
                            }
                          }
                          sel.removeAllRanges();
                          cardSelectionRef.current = text;
                          setCardSelectionReady(true);
                        }
                      }, 0);
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className={styles.flowPanelBody}>
              <div className={styles.flowEmpty}>
                {activeExtraction ? "Answer a question, then generate a note" : "Select an extraction to get started"}
              </div>
            </div>
          )}
        </div>

        {/* ── Anki Panel ── */}
        <div
          className={`${styles.flowPanel} ${focusedPanel === "anki" ? styles.flowPanelFocused : focusedPanel ? styles.flowPanelShrunk : ""}`}
          onClick={() => setFocusedPanel(focusedPanel === "anki" ? null : "anki")}
        >
          <div className={styles.flowPanelHeader}>Anki</div>
          <div className={styles.flowPanelBody}>
            {!activeExtraction ? (
              <div className={styles.flowEmpty}>Select an extraction to see matching cards</div>
            ) : (
              <>
                <button
                  className={styles.flowMakeCardBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectingForCard) {
                      setSelectingForCard(false);
                      setCardSelectionReady(false);
                      cardSelectionRef.current = "";
                    } else {
                      setSelectingForCard(true);
                      setCardSelectionReady(false);
                      cardSelectionRef.current = "";
                      setNoteRawMode(false);
                      setFocusedPanel("editor");
                    }
                  }}
                  disabled={makingCard || !noteContent}
                >
                  {makingCard ? "Creating…" : selectingForCard ? "Cancel Selection" : "+ Make Card"}
                </button>
                <div className={styles.flowAnkiSelectors}>
                  <select
                    className={styles.flowAnkiSelect}
                    value={selectedDeck}
                    onChange={(e) => { e.stopPropagation(); setSelectedDeck(e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {availableDecks.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <select
                    className={styles.flowAnkiSelect}
                    value={selectedModel}
                    onChange={(e) => { e.stopPropagation(); setSelectedModel(e.target.value); }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {clozeModels.length > 0 ? (
                      clozeModels.map((m) => <option key={m} value={m}>{m}</option>)
                    ) : (
                      <option value="Cloze">Cloze</option>
                    )}
                  </select>
                </div>
                {selectingForCard && cardSelectionReady && (
                  <button
                    className={styles.flowMakeCardConfirmBtn}
                    onClick={(e) => { e.stopPropagation(); handleMakeCard(undefined, cardSelectionRef.current); }}
                  >
                    Create Card from Selection
                  </button>
                )}
                {makeCardMsg && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textAlign: "center" }}>
                    {makeCardMsg}
                  </div>
                )}
                {!selectingForCard && cardSelectionReady && !makingCard && (
                  <div className={styles.flowCardSelActions}>
                    <button
                      className={styles.flowCardRedoBtn}
                      onClick={(e) => { e.stopPropagation(); handleMakeCard(undefined, cardSelectionRef.current); }}
                    >
                      Redo with Same Selection
                    </button>
                    <button
                      className={styles.flowCardClearBtn}
                      onClick={(e) => { e.stopPropagation(); setCardSelectionReady(false); cardSelectionRef.current = ""; }}
                    >
                      Clear Selection
                    </button>
                  </div>
                )}

                {ankiLoading ? (
                  <div className={styles.flowEmpty}>Searching Anki…</div>
                ) : ankiError ? (
                  <div className={styles.flowEmpty}>{ankiError}</div>
                ) : ankiCards.length === 0 ? (
                  <div className={styles.flowEmpty}>No cards found for {qId}</div>
                ) : (
                  <>
                    {ankiCards.map((card) => {
                      const isEditing = editingFlowCard === card.note_id;
                      const frontText = stripHtml(card.front);
                      return (
                        <div
                          key={card.card_id}
                          className={`${styles.ankiCard} ${isEditing ? styles.ankiCardEditing : ""}`}
                          onClick={isEditing ? undefined : (e) => {
                            e.stopPropagation();
                            setEditingFlowCard(card.note_id);
                            setEditFront(card.front);
                            setEditBack(card.back);
                            setAnkiEditError("");
                            // Reset mode cache — start fresh for this card
                            modeContentRef.current = { cloze: card.front };
                            // Auto-detect editor mode
                            if (/```mermaid/i.test(card.front)) { modeContentRef.current["mermaid"] = card.front; setEditorMode("mermaid"); }
                            else if (/<table/i.test(card.front)) { modeContentRef.current["table"] = card.front; setEditorMode("table"); }
                            else if (/Answer:<\/b>|Key clues:<\/b>/i.test(card.front)) { modeContentRef.current["question"] = card.front; setEditorMode("question"); }
                            else setEditorMode("cloze");
                          }}
                        >
                          {!isEditing && (
                            <div className={styles.ankiCardHeader}>
                              <div className={styles.ankiCardFront}>
                                {frontText ? <span>{frontText}</span> : <span className={styles.ankiCardFrontFallback}>{card.deck}</span>}
                              </div>
                              <div className={styles.ankiCardHeaderActions}>
                                {card.suspended && <span className={styles.suspendedBadge}>suspended</span>}
                                <button className={card.suspended ? styles.unsuspendBtn : styles.suspendBtn} onClick={(e) => { e.stopPropagation(); handleToggleSuspend(card); }}>
                                  {card.suspended ? "Unsuspend ↑" : "Suspend ↓"}
                                </button>
                                <svg className={styles.ankiChevron} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="6 9 12 15 18 9" />
                                </svg>
                              </div>
                            </div>
                          )}

                          {isEditing && (
                            <div className={styles.ankiEditPanel} onClick={(e) => e.stopPropagation()}>
                              <div className={styles.ankiEditPanelHeader}>
                                <select
                                  className={styles.ankiDeckSelect}
                                  value={selectedDeck}
                                  onChange={(e) => setSelectedDeck(e.target.value)}
                                >
                                  {availableDecks.length > 0 ? (
                                    availableDecks.map((d) => <option key={d} value={d}>{d}</option>)
                                  ) : (
                                    <option value={card.deck}>{card.deck}</option>
                                  )}
                                </select>
                                <button className={styles.ankiCollapseBtn} onClick={() => { setEditingFlowCard(null); setAnkiEditError(""); }} title="Collapse">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                                </button>
                              </div>
                              <div className={styles.ankiEditLabelRow}>
                                <label className={styles.ankiEditLabel}>Front</label>
                                <div className={styles.ankiFormatRow}>
                                  <button className={`${styles.ankiFormatBtn} ${editorMode === "cloze" ? styles.ankiFormatBtnActive : ""}`} onClick={() => handleSwitchEditor("cloze")} disabled={ankiFormatting}>
                                    Cloze
                                  </button>
                                  <button className={`${styles.ankiFormatBtn} ${editorMode === "question" ? styles.ankiFormatBtnActive : ""}`} onClick={() => handleSwitchEditor("question")} disabled={ankiFormatting}>
                                    {ankiFormatting && editorMode !== "question" ? "…" : "Q&A"}
                                  </button>
                                  <button className={`${styles.ankiFormatBtn} ${editorMode === "table" ? styles.ankiFormatBtnActive : ""}`} onClick={() => handleSwitchEditor("table")} disabled={ankiFormatting}>
                                    {ankiFormatting && editorMode !== "table" ? "…" : "Table"}
                                  </button>
                                  <button className={`${styles.ankiFormatBtn} ${styles.ankiFormatBtnMermaid} ${editorMode === "mermaid" ? styles.ankiFormatBtnActive : ""}`} onClick={() => handleSwitchEditor("mermaid")} disabled={ankiFormatting}>
                                    Mermaid
                                  </button>
                                  <button
                                    className={`${styles.ankiPreviewBtn} ${ankiPreview ? styles.ankiPreviewBtnActive : ""}`}
                                    onClick={() => setAnkiPreview((p) => !p)}
                                    title={ankiPreview ? "Hide preview" : "Show preview"}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                  </button>
                                  {editorMode !== "cloze" && (
                                    <button
                                      className={styles.ankiRegenBtn}
                                      onClick={handleRegenerate}
                                      disabled={ankiFormatting}
                                      title="Regenerate — re-format from original content"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                                    </button>
                                  )}
                                </div>
                              </div>
                              {ankiPreview ? (
                                <div ref={ankiPreviewRef} className={styles.ankiPreviewContent}>
                                  <div className={styles.ankiPreviewSection}>
                                    <div className={styles.ankiPreviewSectionLabel}>Front</div>
                                    {editorMode === "mermaid" ? (
                                      <MermaidGridPreview value={editFront} />
                                    ) : (
                                      <div dangerouslySetInnerHTML={{ __html: preparePreviewHtml(editFront) }} />
                                    )}
                                  </div>
                                  <hr className={styles.ankiPreviewDivider} />
                                  <div className={styles.ankiPreviewSection}>
                                    <div className={styles.ankiPreviewSectionLabel}>Back</div>
                                    <div dangerouslySetInnerHTML={{ __html: preparePreviewHtml(editBack) }} />
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {editorMode === "mermaid" && (
                                    <MermaidStructEditor
                                      value={editFront}
                                      onChange={(val) => {
                                        setEditFront(val);
                                        if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = val;
                                      }}
                                    />
                                  )}
                                  {editorMode === "question" && (
                                    <QuestionEditor
                                      value={editFront}
                                      onChange={(val) => {
                                        setEditFront(val);
                                        if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = val;
                                      }}
                                    />
                                  )}
                                  {editorMode === "table" && (
                                    <TableEditor
                                      value={editFront}
                                      onChange={(val) => {
                                        setEditFront(val);
                                        if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = val;
                                      }}
                                    />
                                  )}
                                  {editorMode === "cloze" && (
                                    <div
                                      ref={ankiFrontRef}
                                      className={styles.ankiEditRichText}
                                      contentEditable
                                      suppressContentEditableWarning
                                      onInput={(e) => setEditFront(e.currentTarget.innerHTML)}
                                      spellCheck={false}
                                      style={{ minHeight: "80px" }}
                                    />
                                  )}
                                  <label className={styles.ankiEditLabel}>Back</label>
                                  <div
                                    ref={ankiBackRef}
                                    className={styles.ankiEditRichText}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onInput={(e) => setEditBack(e.currentTarget.innerHTML)}
                                    spellCheck={false}
                                    style={{ minHeight: "120px" }}
                                  />
                                </>
                              )}
                              {ankiEditError && <div className={styles.ankiEditError}>{ankiEditError}</div>}
                              <div className={styles.ankiEditButtons}>
                                <button className={styles.ankiSaveBtn} onClick={() => handleSaveAnkiCard(card)} disabled={ankiSaving}>
                                  {ankiSaving ? "Saving…" : "Save"}
                                </button>
                                <button className={styles.ankiCancelBtn} onClick={() => { setEditingFlowCard(null); setAnkiEditError(""); }} disabled={ankiSaving}>
                                  Cancel
                                </button>
                                <button className={styles.ankiDeleteBtn} onClick={() => handleDeleteAnkiCard(card)} disabled={ankiSaving} title="Delete this card from Anki">
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                              </div>
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
