"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "../page.module.css";
import TemplatesView, { Template } from "@/components/TemplatesView";
import FlowView from "@/components/FlowView";
import NoteGraph from "@/components/NoteGraph";
import {
  fetchAllUserData,
  saveUserData,
  saveUserDataDebounced,
  deleteUserData,
  getUserData,
  migrateLocalStorageToSupabase,
} from "@/lib/user-data";
import { TEMPLATE_DEFAULTS } from "@/lib/template-defaults";
import { renderMarkdown } from "@/lib/render-markdown";

type ViewMode = "flow" | "chat" | "editor" | "anki" | "templates";
type WorkflowStep = "idle" | "extracting" | "questioning" | "answering" | "generating" | "done";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isJson?: boolean;
}

interface Source {
  title: string;
  path: string;
  snippet: string;
}

interface Note {
  title: string;
  path: string;
  tags?: string[];
}

interface ChatResponse {
  answer: string;
  sources: Source[];
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

interface ErrorNoteResult {
  notes: NoteResultItem[];
  questions_recap: { question: string; answer: string }[];
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

interface ActivityItem {
  type: "note" | "card" | "open";
  questionId: string;
  title: string;
  notePath?: string;
  noteId?: number;
  savedAt: number;
}

interface ChatSessionWorkflow {
  workflowStep: WorkflowStep;
  extractedJson: any;
  currentQuestion: MCQuestionItem | null;
  questionCount: number;
  previousQuestions: string[];
  diagnosticQuestions: string[];
  questionAnswers: string[];
  showPostGenChoice: boolean;
  showCreateNoteChoice: boolean;
  showQuestionPrompt: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  workflow?: ChatSessionWorkflow;
}

interface SavedExtraction {
  id: string;
  questionId: string | null;
  title: string;
  extraction: any;
  savedAt: number;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ── Activity history logo icons ───────────────────────────────────────────

function ObsidianIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Obsidian note">
      {/* Main gem body */}
      <polygon points="7,0.5 13.5,5 7,13.5 0.5,5" fill="#7c3aed" />
      {/* Top facet highlight */}
      <polygon points="7,0.5 13.5,5 7,5.5 0.5,5" fill="#a855f7" />
      {/* Right facet shadow */}
      <polygon points="7,5.5 13.5,5 7,13.5" fill="#6d28d9" />
    </svg>
  );
}

function AnkiIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Anki card">
      {/* 4-pointed star approximating Anki's burst logo */}
      <path
        d="M7 0.5 L8.3 5.7 L13.5 7 L8.3 8.3 L7 13.5 L5.7 8.3 L0.5 7 L5.7 5.7 Z"
        fill="#06b6d4"
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const CREWAI_URL = "http://localhost:8000";

// ── AnkiConnect direct helper (browser → localhost) ───────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

const STATUS_MESSAGES = [
  "Searching through your notes",
  "Analyzing note connections",
  "Cross-referencing concepts",
  "Reading relevant notes",
  "Synthesizing information",
  "Building a thoughtful response",
  "Connecting the dots",
  "Reviewing medical concepts",
  "Processing your request",
  "Almost there",
];

const WORKFLOW_STATUS_MESSAGES: Record<string, string[]> = {
  extracting: ["Analyzing screenshots", "Extracting question data", "Reading the image", "Parsing UWorld content"],
  questioning: ["Identifying cognitive gaps", "Crafting diagnostic questions", "Analyzing your mistake pattern"],
  generating: ["Inferring error pattern", "Composing your note", "Saving your note", "Formatting with templates"],
};

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("flow");
  const [viewReady, setViewReady] = useState(false);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("activeFlowExtractionId");
    return null;
  });

  // Read ?view= param on mount to avoid SSR flash
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    if (v && ["flow", "editor", "anki", "templates"].includes(v)) {
      setViewMode(v as ViewMode);
    }
    // Clean URL so ?view= doesn't persist on refresh
    if (v) window.history.replaceState({}, "", "/");
    setViewReady(true);
  }, []);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  const [vaultPath] = useState("USMLE vault"); // for Obsidian URI fallback only
  const [repo, setRepo] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("github_repo") || "";
    return "";
  });
  const [ghAuth, setGhAuth] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("gh_authenticated") === "true";
    return false;
  });
  const [noteShas, setNoteShas] = useState<Record<string, string>>({});
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [vaultTags, setVaultTags] = useState<string[]>([]);

  // Error-Note workflow
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("idle");
  const [extractedJson, setExtractedJson] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState<MCQuestionItem | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<string[]>([]);
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<string[]>([]);
  const [mcFeedback, setMcFeedback] = useState<{ selected: number; correct: boolean } | null>(null);
  const [errorNoteResult, setErrorNoteResult] = useState<ErrorNoteResult | null>(null);
  const [showPostGenChoice, setShowPostGenChoice] = useState(false);
  const [showCreateNoteChoice, setShowCreateNoteChoice] = useState(false);
  const [showQuestionPrompt, setShowQuestionPrompt] = useState(false);

  // Editor mode
  const [noteSearch, setNoteSearch] = useState("");
  const [showGraphLabels, setShowGraphLabels] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState<string>("");
  const [loadingNote, setLoadingNote] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [templates, setTemplates] = useState<{ name: string; filename: string }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [formatInstructions, setFormatInstructions] = useState("");
  const [selectedFormatText, setSelectedFormatText] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [pendingFormatMode, setPendingFormatMode] = useState<string | null>(null);
  const [selectionConfirmText, setSelectionConfirmText] = useState("");
  const [noteHistory, setNoteHistory] = useState<string[]>([]);
  const [streamingChip, setStreamingChip] = useState<string | null>(null);
  const editorTextAreaRef = useRef<HTMLTextAreaElement>(null);

  // Editor: saving & keynote
  const [savingNote, setSavingNote] = useState(false);
  const [deletingNote, setDeletingNote] = useState(false);
  const [keyNoteLoading, setKeyNoteLoading] = useState(false);
  const [expandedNoteCards, setExpandedNoteCards] = useState<Set<number>>(new Set());

  // Anki search mode
  const [ankiQuery, setAnkiQuery] = useState("");
  const [ankiCards, setAnkiCards] = useState<AnkiCard[]>([]);
  const [ankiLoading, setAnkiLoading] = useState(false);
  const [ankiError, setAnkiError] = useState("");
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [ankiSaving, setAnkiSaving] = useState(false);
  const [ankiFormatting, setAnkiFormatting] = useState(false);
  const [ankiCardTemplates, setAnkiCardTemplates] = useState<{ name: string; filename: string }[]>([]);
  const [selectedCardTemplate, setSelectedCardTemplate] = useState("");
  const [ankiEditError, setAnkiEditError] = useState("");
  const [expandedTagCards, setExpandedTagCards] = useState<Set<number>>(new Set());
  const [activityHistory, setActivityHistory] = useState<ActivityItem[]>([]);
  const [noteCardCounts, setNoteCardCounts] = useState<Record<string, number | null>>({});

  // Chat history sessions
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  // null = loading, -1 = Anki unavailable, 0 = no cards, N = card count

  // Saved extractions
  const [savedExtractions, setSavedExtractions] = useState<SavedExtraction[]>([]);

  // User templates (from Supabase)
  const [userTemplates, setUserTemplates] = useState<Template[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  const ankiFrontRef = useRef<HTMLDivElement>(null);
  const ankiBackRef = useRef<HTMLDivElement>(null);

  // Anki create card
  const [ankiCreateNoteSearch, setAnkiCreateNoteSearch] = useState("");
  const [ankiCreateNote, setAnkiCreateNote] = useState("");
  const [ankiCreating, setAnkiCreating] = useState(false);
  const [ankiCreateFront, setAnkiCreateFront] = useState("");
  const [ankiCreateBack, setAnkiCreateBack] = useState("");
  const [ankiCreateDeck, setAnkiCreateDeck] = useState("");
  const [ankiDecks, setAnkiDecks] = useState<string[]>([]);
  const [ankiAddingNote, setAnkiAddingNote] = useState(false);
  const [ankiCreateError, setAnkiCreateError] = useState("");
  const [ankiCreateSuccess, setAnkiCreateSuccess] = useState("");
  const ankiCreateFrontRef = useRef<HTMLDivElement>(null);
  const ankiCreateBackRef = useRef<HTMLDivElement>(null);
  const [ankiCreateDropdownOpen, setAnkiCreateDropdownOpen] = useState(false);
  const [ankiCreateTagFilter, setAnkiCreateTagFilter] = useState("");
  const comboboxRef = useRef<HTMLDivElement>(null);

  // User info from middleware cookie
  const [gsUser, setGsUser] = useState<{ email: string; plan: string; status: string } | null>(null);

  // Progressive loading state
  const [statusMsg, setStatusMsg] = useState("");
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIndexRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages, statusMsg]);

  // ── Fetch user info from saas-shell ────────────────────────────────────
  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setGsUser(data); })
      .catch(() => {});
  }, []);

  // ── Check GitHub auth + load user data from Supabase ─────────────────────
  const [dataLoading, setDataLoading] = useState(true);
  useEffect(() => {
    const init = async () => {
      try {
        const authResp = await fetch("/api/auth/me");
        const authData = await authResp.json();
        if (authData.authenticated) {
          setGhAuth(true);
          localStorage.setItem("gh_authenticated", "true");
          if (authData.login) localStorage.setItem("gh_user", authData.login);
          if (authData.avatar_url) localStorage.setItem("gh_avatar", authData.avatar_url);
          const data = await fetchAllUserData();
          // First login migration: if Supabase is empty, push localStorage data
          if (Object.keys(data).length === 0) {
            await migrateLocalStorageToSupabase();
            await fetchAllUserData();
          }
          // Hydrate state from Supabase cache
          const sessions = getUserData<ChatSession[]>("chatSessions", []);
          if (sessions.length) setChatSessions(sessions);
          const extractions = getUserData<SavedExtraction[]>("savedExtractions", []);
          if (extractions.length) setSavedExtractions(extractions);
          const activity = getUserData<ActivityItem[]>("obsidianChatActivity", []);
          if (activity.length) {
            const seen = new Set<string>();
            const deduped = activity.filter((item) => {
              const k = `${item.type}:${item.notePath ?? item.noteId ?? item.questionId}`;
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });
            setActivityHistory(deduped);
          }
          const savedRepo = getUserData<string>("github_repo", "");
          if (savedRepo) setRepo(savedRepo);
        } else {
          // Not authenticated — load from localStorage
          try { const s = localStorage.getItem("chatSessions"); if (s) setChatSessions(JSON.parse(s)); } catch {}
          try { const s = localStorage.getItem("savedExtractions"); if (s) setSavedExtractions(JSON.parse(s)); } catch {}
          try {
            const s = localStorage.getItem("obsidianChatActivity");
            if (s) {
              const items: ActivityItem[] = JSON.parse(s);
              const seen = new Set<string>();
              const deduped = items.filter(item => {
                const k = `${item.type}:${item.notePath ?? item.noteId ?? item.questionId}`;
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
              });
              setActivityHistory(deduped);
            }
          } catch {}
          try { const r = localStorage.getItem("github_repo"); if (r) setRepo(r); } catch {}
        }
      } catch {
        // Full localStorage fallback
        try { const s = localStorage.getItem("chatSessions"); if (s) setChatSessions(JSON.parse(s)); } catch {}
        try { const s = localStorage.getItem("savedExtractions"); if (s) setSavedExtractions(JSON.parse(s)); } catch {}
        try { const s = localStorage.getItem("obsidianChatActivity"); if (s) setActivityHistory(JSON.parse(s)); } catch {}
        try { const r = localStorage.getItem("github_repo"); if (r) setRepo(r); } catch {}
      } finally {
        setDataLoading(false);
      }
    };
    init();
  }, []);

  // ── Listen for browser extension imports ─────────────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as SavedExtraction | undefined;
      if (!detail) return;
      setSavedExtractions((prev) => {
        const updated = [detail, ...prev];
        saveUserData("savedExtractions", updated);
        return updated;
      });
    };
    window.addEventListener("gapstrike-import", handler);
    return () => window.removeEventListener("gapstrike-import", handler);
  }, []);

  // ── Progressive loading effect ─────────────────────────────────────────
  useEffect(() => {
    // Clear any existing interval first (prevents duplicates)
    if (statusIntervalRef.current) {
      clearInterval(statusIntervalRef.current);
      statusIntervalRef.current = null;
    }

    const isActive = loading || formatting;
    if (!isActive) {
      setStatusMsg("");
      statusIndexRef.current = 0;
      return;
    }

    // Pick the right message pool
    const pool =
      workflowStep !== "idle" && workflowStep !== "answering" && workflowStep !== "done"
        ? WORKFLOW_STATUS_MESSAGES[workflowStep] || STATUS_MESSAGES
        : formatting
          ? ["Reformatting your note", "Applying template structure", "Improving readability", "Polishing layout"]
          : STATUS_MESSAGES;

    statusIndexRef.current = 0;
    setStatusMsg(pool[0]);

    statusIntervalRef.current = setInterval(() => {
      statusIndexRef.current = (statusIndexRef.current + 1) % pool.length;
      setStatusMsg(pool[statusIndexRef.current]);
    }, 1500);

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    };
  }, [loading, formatting, workflowStep]);

  // Load notes — also re-fetch when switching away from flow (note may have been saved)
  useEffect(() => {
    if (!ghAuth) return;
    const loadNotes = async () => {
      try {
        const response = await fetch("/api/list-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo }),
        });
        if (response.ok) {
          const data = await response.json();
          const notes = data.notes || [];
          setAllNotes(notes);
          const shas: Record<string, string> = {};
          for (const n of notes) { if (n.sha) shas[n.path] = n.sha; }
          setNoteShas(shas);
        }
      } catch (error) {
        console.error("Failed to load notes:", error);
      }
    };
    loadNotes();
  }, [ghAuth, repo, viewMode]);

  // (chatSessions + savedExtractions now loaded in the unified init effect above)

  // Auto-save messages + workflow to current session whenever they change
  useEffect(() => {
    if (messages.length === 0) return;
    if (!currentSessionIdRef.current) {
      currentSessionIdRef.current = Date.now().toString();
      setCurrentSessionId(currentSessionIdRef.current);
    }
    const sessionId = currentSessionIdRef.current;
    const firstUserMsg = messages.find((m) => m.role === "user");
    const raw = firstUserMsg?.content ?? "New chat";
    const title = raw.replace(/\s+/g, " ").slice(0, 50) + (raw.length > 50 ? "…" : "");
    setChatSessions((prev) => {
      const existing = prev.find((s) => s.id === sessionId);
      const updated: ChatSession = {
        id: sessionId,
        title,
        messages,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        workflow: {
          workflowStep,
          extractedJson,
          currentQuestion,
          questionCount,
          previousQuestions,
          diagnosticQuestions,
          questionAnswers,
          showPostGenChoice,
          showCreateNoteChoice,
          showQuestionPrompt,
        },
      };
      const newSessions = [updated, ...prev.filter((s) => s.id !== sessionId)];
      saveUserDataDebounced("chatSessions", newSessions);
      return newSessions;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, workflowStep, showPostGenChoice, showCreateNoteChoice, showQuestionPrompt, currentQuestion]);

  // (activity history now loaded in the unified init effect above)

  // Card-detection: query AnkiConnect for each numeric tag in the selected note
  useEffect(() => {
    if (!selectedNote || !noteContent) {
      setNoteCardCounts({});
      return;
    }
    const numericTags = (selectedNote.tags || []).filter((t) => /^\d+$/.test(t));
    if (numericTags.length === 0) {
      setNoteCardCounts({});
      return;
    }
    const initial: Record<string, number | null> = {};
    numericTags.forEach((t) => (initial[t] = null));
    setNoteCardCounts(initial);

    numericTags.forEach(async (qId) => {
      try {
        const cardIds = (await ankiConnect("findCards", { query: `tag:${qId}` })) as number[];
        setNoteCardCounts((p) => ({ ...p, [qId]: cardIds?.length ?? 0 }));
      } catch {
        setNoteCardCounts((p) => ({ ...p, [qId]: -1 }));
      }
    });
  }, [selectedNote]);

  // Load templates from Supabase via API, with localStorage fallback
  useEffect(() => {
    // Build client-side defaults (always available as baseline)
    const clientDefaults: Template[] = TEMPLATE_DEFAULTS.map((t, i) => ({
      id: String(i + 1),
      slug: t.slug,
      category: t.category,
      title: t.title,
      content: t.content,
      updated_at: new Date().toISOString(),
    }));

    const applyLocalEdits = (base: Template[]): Template[] => {
      try {
        const raw = localStorage.getItem("template_edits");
        if (raw) {
          const edits: Record<string, string> = JSON.parse(raw);
          return base.map((t) => edits[t.slug] ? { ...t, content: edits[t.slug] } : t);
        }
      } catch {}
      return base;
    };

    const loadUserTemplates = async () => {
      try {
        const resp = await fetch("/api/templates");
        if (resp.ok) {
          const data = await resp.json();
          const apiTemplates = (data.templates || []) as Template[];
          const source = data.source; // "supabase" or "defaults"
          if (data.dbError) console.warn("Templates DB error:", data.dbError);
          if (source === "supabase") {
            // DB is source of truth — clear any localStorage edits
            try { localStorage.removeItem("template_edits"); } catch {}
            setUserTemplates(apiTemplates);
          } else {
            // Defaults returned — overlay localStorage edits
            setUserTemplates(applyLocalEdits(apiTemplates));
          }
        } else {
          console.error("Templates fetch failed:", resp.status);
          // API failed — use client defaults + localStorage edits
          setUserTemplates(applyLocalEdits(clientDefaults));
        }
      } catch (error) {
        console.error("Failed to load user templates:", error);
        // Network error — use client defaults + localStorage edits
        setUserTemplates(applyLocalEdits(clientDefaults));
      }
      setTemplatesLoaded(true);
    };
    loadUserTemplates();
  }, []);

  const handleTemplateUpdate = async (slug: string, content: string) => {
    // Optimistic update
    setUserTemplates((prev) =>
      prev.map((t) => (t.slug === slug ? { ...t, content, updated_at: new Date().toISOString() } : t))
    );
    // Always persist to localStorage as reliable fallback
    try {
      const raw = localStorage.getItem("template_edits");
      const edits: Record<string, string> = raw ? JSON.parse(raw) : {};
      edits[slug] = content;
      localStorage.setItem("template_edits", JSON.stringify(edits));
    } catch {}
    // Also persist to Supabase
    const resp = await fetch("/api/templates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, content }),
    });
    if (resp.ok) {
      // Supabase saved successfully — clear localStorage for this slug
      try {
        const raw = localStorage.getItem("template_edits");
        const edits: Record<string, string> = raw ? JSON.parse(raw) : {};
        delete edits[slug];
        if (Object.keys(edits).length === 0) localStorage.removeItem("template_edits");
        else localStorage.setItem("template_edits", JSON.stringify(edits));
      } catch {}
    } else {
      console.error("Template save to Supabase failed:", resp.status, "— using localStorage fallback");
    }
  };

  const handleTemplateReset = async (slug: string) => {
    // Clear localStorage edit for this slug
    try {
      const raw = localStorage.getItem("template_edits");
      const edits: Record<string, string> = raw ? JSON.parse(raw) : {};
      delete edits[slug];
      if (Object.keys(edits).length === 0) localStorage.removeItem("template_edits");
      else localStorage.setItem("template_edits", JSON.stringify(edits));
    } catch {}
    const resp = await fetch("/api/templates/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    if (resp.ok) {
      const { template } = await resp.json();
      setUserTemplates((prev) =>
        prev.map((t) => (t.slug === slug ? { ...t, content: template.content, updated_at: template.updated_at } : t))
      );
    }
  };

  // Vault tags loading removed — only works with local CrewAI backend

  // Populate contentEditable fields when a card is opened or content is programmatically updated
  useEffect(() => {
    if (editingCard !== null) {
      if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = editFront;
      if (ankiBackRef.current) ankiBackRef.current.innerHTML = editBack;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCard]);

  useEffect(() => {
    if (viewMode !== "anki") return;
    // Card templates from Supabase (already loaded)
    const ankiTpls = userTemplates
      .filter((t) => t.category === "anki")
      .map((t) => ({ name: t.title, filename: t.slug }));
    setAnkiCardTemplates(ankiTpls);
    if (ankiTpls.length > 0 && !selectedCardTemplate) setSelectedCardTemplate(ankiTpls[0].filename);
    // Decks from AnkiConnect directly
    ankiConnect("deckNames")
      .then((decks) => {
        const d = decks as string[];
        if (d.length > 0) { setAnkiDecks(d); if (!ankiCreateDeck) setAnkiCreateDeck(d[0]); }
      })
      .catch(() => { });
  }, [viewMode, userTemplates]);

  // Sync create card contentEditable refs when content is set by LLM
  useEffect(() => {
    if (ankiCreateFrontRef.current) ankiCreateFrontRef.current.innerHTML = ankiCreateFront;
    if (ankiCreateBackRef.current) ankiCreateBackRef.current.innerHTML = ankiCreateBack;
  }, [ankiCreateFront, ankiCreateBack]);

  // Close note combobox on outside click
  useEffect(() => {
    if (!ankiCreateDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setAnkiCreateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ankiCreateDropdownOpen]);

  // ── Anki Create Card ───────────────────────────────────────────────────

  const handleCreateCard = async () => {
    if (!ankiCreateNote || ankiCreating) return;
    setAnkiCreating(true);
    setAnkiCreateError("");
    setAnkiCreateSuccess("");
    setAnkiCreateFront("");
    setAnkiCreateBack("");
    try {
      // Read note content first
      const noteResp = await fetch("/api/read-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notePath: ankiCreateNote, repo }),
      });
      if (!noteResp.ok) throw new Error("Failed to read note.");
      const noteData = await noteResp.json();
      const noteContent = noteData.content || "";
      // Get selected template content
      const tpl = userTemplates.find((t) => t.slug === selectedCardTemplate);
      // Generate card via LLM
      const resp = await fetch("/api/create-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_content: noteContent, template: tpl?.content || "" }),
      });
      const data = await resp.json();
      if (data.success) {
        setAnkiCreateFront(data.front);
        setAnkiCreateBack(data.back);
      } else {
        setAnkiCreateError(data.error || "Generation failed.");
      }
    } catch {
      setAnkiCreateError("Failed to generate card.");
    } finally {
      setAnkiCreating(false);
    }
  };

  const handleAddNote = async () => {
    if (!ankiCreateFront || ankiAddingNote) return;
    setAnkiAddingNote(true);
    setAnkiCreateError("");
    setAnkiCreateSuccess("");
    try {
      await ankiConnect("addNote", {
        note: {
          deckName: ankiCreateDeck || "Default",
          modelName: "Cloze",
          fields: { Text: ankiCreateFront, Extra: ankiCreateBack },
          tags: [],
          options: { allowDuplicate: false },
        },
      });
      setAnkiCreateSuccess("Card added to Anki successfully!");
      setAnkiCreateFront("");
      setAnkiCreateBack("");
      setAnkiCreateNote("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add card.";
      setAnkiCreateError(msg);
    } finally {
      setAnkiAddingNote(false);
    }
  };

  // Image handling
  const processImageFile = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    const newImages: string[] = [];
    for (const file of imageFiles) {
      newImages.push(await processImageFile(file));
    }
    setUploadedImages((prev) => [...prev, ...newImages]);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleImageUpload(e.dataTransfer.files);
  }, []);

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        handleImageUpload(imageFiles);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, []);

  // ── Unified Send ───────────────────────────────────────────────────────

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (workflowStep === "answering") { await handleSubmitAnswers(); return; }
    if (uploadedImages.length > 0) { await runFullWorkflow(); return; }
    if (!input.trim() || loading) return;

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, tag: tagFilter || undefined, repo }),
      });
      if (!response.ok) throw new Error(`API error: ${response.status}`);
      const data: ChatResponse = await response.json();
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: data.answer }]);
      setSources(data.sources);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "Error: Failed to get response." }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Error-Note Workflow ────────────────────────────────────────────────

  // ── Fetch one question on demand ───────────────────────────────────────

  const fetchNextQuestion = async (
    extraction: any,
    prevQuestions: string[],
    count: number
  ): Promise<MCQuestionItem | null> => {
    const difficulties = ["hard", "medium", "easy"];
    const difficulty = difficulties[count % 3];
    try {
      const resp = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extraction,
          previous_questions: prevQuestions,
          difficulty_target: difficulty,
        }),
      });
      if (!resp.ok) throw new Error(`Questions error: ${resp.status}`);
      const data = await resp.json();
      const q = (data.questions || [])[0];
      if (!q || !q.question || !Array.isArray(q.options) || q.options.length === 0) return null;
      return q as MCQuestionItem;
    } catch {
      return null;
    }
  };

  const handleFlowNewExtraction = (ext: SavedExtraction) => {
    setSavedExtractions((prev) => {
      const updated = [ext, ...prev];
      saveUserData("savedExtractions", updated);
      return updated;
    });
  };

  const runFullWorkflow = async () => {
    if (uploadedImages.length === 0 || loading) return;
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: `📸 Sent ${uploadedImages.length} screenshot${uploadedImages.length > 1 ? "s" : ""} for error note` }]);
    setLoading(true);
    setWorkflowStep("extracting");
    const imagesToSend = [...uploadedImages];
    setUploadedImages([]);

    try {
      const extractResp = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: imagesToSend }) });
      if (!extractResp.ok) throw new Error(`Extract error: ${extractResp.status}`);
      const extractData = await extractResp.json();
      if (extractData.error) throw new Error(extractData.error);
      const extracted = extractData.result;
      setExtractedJson(extracted);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: JSON.stringify(extracted, null, 2), isJson: true }]);

      // Save extraction to history
      const qId = extracted.question_id ?? null;
      const eduObj = extracted.educational_objective ?? extracted.question ?? "";
      const shortTitle = eduObj.length > 50 ? eduObj.slice(0, 50) + "…" : eduObj;
      const newExtraction: SavedExtraction = {
        id: Date.now().toString(),
        questionId: qId,
        title: shortTitle,
        extraction: extracted,
        savedAt: Date.now(),
      };
      setSavedExtractions(prev => {
        const updated = [newExtraction, ...prev];
        saveUserData("savedExtractions", updated);
        return updated;
      });

      setWorkflowStep("questioning");
      const firstQuestion = await fetchNextQuestion(extracted, [], 0);
      if (!firstQuestion) throw new Error("No valid MC question returned");

      setCurrentQuestion(firstQuestion);
      setQuestionCount(1);
      setPreviousQuestions([firstQuestion.question]);
      setQuestionAnswers([]);
      setDiagnosticQuestions([firstQuestion.question]);
      setMcFeedback(null);

      const optionsText = firstQuestion.options.map((o: string, i: number) => `  ${String.fromCharCode(65 + i)}) ${o}`).join("\n");
      setMessages((prev) => [...prev, { id: (Date.now() + 2).toString(), role: "assistant", content: `🧠 **Question 1** *(${firstQuestion.difficulty})*\n\n${firstQuestion.question}\n\n${optionsText}` }]);
      setWorkflowStep("answering");
    } catch (error) {
      console.error("Workflow error:", error);
      setMessages((prev) => [...prev, { id: (Date.now() + 3).toString(), role: "assistant", content: `Error: ${error instanceof Error ? error.message : "Workflow failed."}` }]);
      setWorkflowStep("idle");
    } finally {
      setLoading(false);
    }
  };

  const handleMCAnswer = (optionIdx: number) => {
    if (mcFeedback || loading || !currentQuestion) return;
    const q = currentQuestion;
    const isCorrect = optionIdx === q.correct;
    const chosenLetter = String.fromCharCode(65 + optionIdx);
    const correctLetter = String.fromCharCode(65 + q.correct);
    setMcFeedback({ selected: optionIdx, correct: isCorrect });

    const updatedAnswers = [...questionAnswers, `${chosenLetter}) ${q.options[optionIdx]} [${isCorrect ? "CORRECT" : "WRONG - correct: " + correctLetter + ") " + q.options[q.correct]}]`];
    setQuestionAnswers(updatedAnswers);

    setMessages((prev) => [...prev, {
      id: Date.now().toString(), role: "user",
      content: `${chosenLetter}) ${q.options[optionIdx]}`
    }]);

    setTimeout(() => {
      if (!isCorrect) {
        const msg = `❌ That was **${correctLetter}) ${q.options[q.correct]}**. Generating your note now...`;
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: msg }]);
        handleSubmitAnswers(updatedAnswers);
      } else {
        const msg = `✅ Correct! **${chosenLetter}) ${q.options[optionIdx]}**`;
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: msg }]);
        setShowCreateNoteChoice(true);
      }
    }, 1200);
  };

  const handleSubmitAnswers = async (answersOverride?: string[]) => {
    const answers = answersOverride || questionAnswers;
    if (loading) return;
    setLoading(true);
    setWorkflowStep("generating");

    try {
      const generateResp = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extraction: extractedJson, questions: diagnosticQuestions, answers: answers, template: userTemplates.find((t) => t.slug === "error_note_a")?.content || "" }) });
      if (!generateResp.ok) throw new Error(`Generate error: ${generateResp.status}`);
      const result = await generateResp.json();
      setErrorNoteResult(result);

      // Build a message that shows each note
      const notesArr: NoteResultItem[] = result.notes || [];
      const noteSummaries = notesArr.map((n: NoteResultItem, i: number) =>
        `### 📝 Note ${i + 1}: ${n.error_pattern}\n` +
        `📂 **Path:** ${n.file_path}\n` +
        `🏷️ **Tags:** ${(n.tags || []).join(", ")}\n` +
        `**Action:** ${n.action}\n\n---\n\n${n.note_content}`
      ).join("\n\n");

      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `✅ **${notesArr.length} note${notesArr.length > 1 ? "s" : ""} created!**\n\n${noteSummaries}`,
      }]);
      // Add generated notes to activity history
      notesArr.forEach((n: NoteResultItem) => {
        const qId = (n.tags || []).find((t) => /^\d+$/.test(t)) || "";
        addActivity({
          type: "note",
          questionId: qId,
          title: n.error_pattern || n.file_path.split("/").pop()?.replace(".md", "") || "Note",
          notePath: n.file_path,
        });
      });

      // Always offer more questions
      setShowPostGenChoice(true);
      setWorkflowStep("answering");

      // Refresh notes list
      try {
        const notesResp = await fetch("/api/list-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo }) });
        if (notesResp.ok) { const d = await notesResp.json(); setAllNotes(d.notes || []); }
      } catch { }
    } catch (error) {
      console.error("Generate error:", error);
      setMessages((prev) => [...prev, { id: (Date.now() + 2).toString(), role: "assistant", content: `Error: ${error instanceof Error ? error.message : "Note generation failed."}` }]);
      setWorkflowStep("idle");
    } finally {
      setLoading(false);
    }
  };

  const resetWorkflow = () => {
    setWorkflowStep("idle");
    setExtractedJson(null);
    setCurrentQuestion(null);
    setQuestionCount(0);
    setPreviousQuestions([]);
    setDiagnosticQuestions([]);
    setQuestionAnswers([]);
    setMcFeedback(null);
    setErrorNoteResult(null);
    setShowPostGenChoice(false);
    setShowCreateNoteChoice(false);
    setShowQuestionPrompt(false);
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    resetWorkflow();
  };

  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    currentSessionIdRef.current = session.id;
    // Restore workflow state if saved, otherwise reset
    const w = session.workflow;
    if (w) {
      setWorkflowStep(w.workflowStep);
      setExtractedJson(w.extractedJson);
      setCurrentQuestion(w.currentQuestion);
      setQuestionCount(w.questionCount);
      setPreviousQuestions(w.previousQuestions);
      setDiagnosticQuestions(w.diagnosticQuestions);
      setQuestionAnswers(w.questionAnswers);
      setShowPostGenChoice(w.showPostGenChoice);
      setShowCreateNoteChoice(w.showCreateNoteChoice);
      setShowQuestionPrompt(w.showQuestionPrompt);
      setMcFeedback(null);
      setErrorNoteResult(null);
    } else {
      resetWorkflow();
    }
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatSessions((prev) => {
      const newSessions = prev.filter((s) => s.id !== sessionId);
      saveUserData("chatSessions", newSessions);
      return newSessions;
    });
    if (currentSessionIdRef.current === sessionId) {
      setMessages([]);
      setCurrentSessionId(null);
      currentSessionIdRef.current = null;
      resetWorkflow();
    }
  };

  // ── Editor: read note ──────────────────────────────────────────────────

  const openNote = async (note: Note) => {
    setSelectedNote(note);
    setLoadingNote(true);
    try {
      const resp = await fetch("/api/read-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notePath: note.path, repo }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setNoteContent(data.content || "");
        if (data.sha) setNoteShas((prev) => ({ ...prev, [note.path]: data.sha }));
        // Track note open (dedup: skip if the most recent item is the same open)
        const qId = (note.tags || []).find((t) => /^\d+$/.test(t)) || "";
        addActivity({
          type: "open",
          questionId: qId,
          title: note.title,
          notePath: note.path,
        });
      } else {
        setNoteContent("Failed to load note.");
      }
    } catch {
      setNoteContent("Error reading note.");
    } finally {
      setLoadingNote(false);
    }
  };

  const openInObsidian = () => {
    if (!selectedNote) return;
    // Extract vault name from path
    const vaultName = vaultPath.split("\\").pop() || vaultPath.split("/").pop() || "vault";
    const filePath = selectedNote.path.replace(/\\/g, "/").replace(/\.md$/, "");
    const uri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
    window.open(uri);
  };

  const formatNote = async (mode: string, customSelected?: string) => {
    if (!selectedNote || formatting) return;
    setFormatting(true);
    setStreamingChip(mode);

    // Save history before formatting
    setNoteHistory((prev) => [...prev, noteContent].slice(-20));

    const textToFormat = customSelected || selectedFormatText || (() => {
      if (!editorTextAreaRef.current) return "";
      const { selectionStart: s, selectionEnd: e } = editorTextAreaRef.current;
      return (s !== e && s !== undefined && e !== undefined) ? noteContent.substring(s, e) : "";
    })();

    const originalContent = noteContent;
    let accumulated = "";

    try {
      const resp = await fetch(`${CREWAI_URL}/format/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault_path: vaultPath,
          note_path: selectedNote.path,
          selected_template: selectedTemplate,
          selected_text: textToFormat,
          format_mode: mode,
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Stream request failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          const payload = event.slice(6);
          if (payload === "[DONE]") break;
          if (payload.startsWith("[ERROR]")) {
            alert(`Format error: ${payload.slice(8)}`);
            break;
          }
          // Unescape newlines
          const chunk = payload.replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
          accumulated += chunk;

          // Progressively update the editor
          setNoteContent(
            textToFormat
              ? originalContent.replace(textToFormat, accumulated)
              : accumulated
          );
        }
      }

      setSelectedFormatText("");
    } catch (err) {
      console.error("Stream format error:", err);
      alert("Failed to stream format.");
      setNoteContent(originalContent); // restore on error
    } finally {
      setFormatting(false);
      setStreamingChip(null);
    }
  };

  const startSelectionFor = (mode: string) => {
    setPendingFormatMode(mode);
    setSelectionConfirmText("");
    setIsSelectionMode(true);
  };

  // ── Editor: delete note ─────────────────────────────────────────────────

  const deleteNote = async () => {
    if (!selectedNote || deletingNote) return;
    if (!window.confirm(`Permanently delete "${selectedNote.title}"?`)) return;
    setDeletingNote(true);
    try {
      const resp = await fetch("/api/delete-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notePath: selectedNote.path, sha: noteShas[selectedNote.path], repo }),
      });
      const data = await resp.json();
      if (!data.success) {
        alert(`Delete failed: ${data.error}`);
      } else {
        setSelectedNote(null);
        setNoteContent("");
        setAllNotes((prev) => prev.filter((n) => n.path !== selectedNote.path));
      }
    } catch (error) {
      alert("Failed to delete note.");
    } finally {
      setDeletingNote(false);
    }
  };

  // ── Editor: save note ──────────────────────────────────────────────────

  const saveNote = async () => {
    if (!selectedNote || savingNote) return;
    setSavingNote(true);
    try {
      const resp = await fetch("/api/save-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notePath: selectedNote.path,
          content: noteContent,
          sha: noteShas[selectedNote.path],
          repo,
        }),
      });
      const data = await resp.json();
      if (data.sha) setNoteShas((prev) => ({ ...prev, [selectedNote.path]: data.sha }));
      if (!data.success) {
        alert(`Save failed: ${data.error}`);
      } else {
        const qId = (selectedNote.tags || []).find((t) => /^\d+$/.test(t)) || "";
        addActivity({
          type: "note",
          questionId: qId,
          title: selectedNote.title,
          notePath: selectedNote.path,
        });
      }
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  };

  // ── Editor: Key Note ──────────────────────────────────────────────────

  const handleKeyNote = async () => {
    if (!selectedNote || keyNoteLoading) return;
    setKeyNoteLoading(true);
    try {
      const resp = await fetch(`${CREWAI_URL}/api/keynote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault_path: vaultPath,
          note_path: selectedNote.path,
        }),
      });
      const data = await resp.json();
      if (data.success && data.content) {
        // Add the new Key Note to the notes list
        const newNote: Note = {
          title: data.suggested_filename.replace(".md", ""),
          path: data.suggested_filename,
        };
        setAllNotes((prev) => [newNote, ...prev]);
        // Open the Key Note
        setSelectedNote(newNote);
        setNoteContent(data.content);
      } else {
        alert(`Key Note failed: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Key Note error:", error);
      alert("Failed to create Key Note.");
    } finally {
      setKeyNoteLoading(false);
    }
  };

  // ── Anki Live Search (Debounced) ───────────────────────────────────────

  useEffect(() => {
    // Only search if we are in Anki view
    if (viewMode !== "anki") return;

    // Debounce timer — direct AnkiConnect (no Python backend roundtrip)
    const timeoutId = setTimeout(async () => {
      setAnkiLoading(true);
      setAnkiError("");

      try {
        const q = ankiQuery.trim();
        const isEmpty = !q;
        let searchQuery = q;
        if (isEmpty) {
          searchQuery = "deck:*";
        } else if (!q.includes("::") && !["tag:", "deck:", "note:", "is:", "prop:"].some(p => q.startsWith(p))) {
          searchQuery = `tag::${q}`;
        }

        const limit = isEmpty ? 10 : 20;
        const allCardIds = (await ankiConnect("findCards", { query: searchQuery })) as number[];
        if (!allCardIds || allCardIds.length === 0) {
          setAnkiCards([]);
          return;
        }

        const cardIds = allCardIds.slice(-limit).reverse();
        const cardsInfo = (await ankiConnect("cardsInfo", { cards: cardIds })) as any[];
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

        setEditingCard(null);
        setExpandedTagCards(new Set());
        setAnkiCards(cards);
      } catch (err: any) {
        const msg = err?.message || "";
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("ERR_CONNECTION_REFUSED") || msg.includes("AnkiConnect HTTP 502") || msg.includes("unreachable")) {
          setAnkiError("Anki is not running. Open Anki with the AnkiConnect plugin installed.");
        } else {
          setAnkiError(msg || "AnkiConnect error.");
        }
      } finally {
        setAnkiLoading(false);
      }
    }, 150); // 150ms debounce — direct localhost call, no backend needed

    return () => clearTimeout(timeoutId);
  }, [ankiQuery, viewMode]);

  const handleSaveCard = async (card: AnkiCard) => {
    setAnkiSaving(true);
    setAnkiEditError("");
    try {
      const fields: Record<string, string> = {};
      if (card.field_names[0]) fields[card.field_names[0]] = editFront;
      if (card.field_names[1]) fields[card.field_names[1]] = editBack;
      await ankiConnect("updateNoteFields", { note: { id: card.note_id, fields } });
      setAnkiCards((prev) =>
        prev.map((c) =>
          c.note_id === card.note_id ? { ...c, front: editFront, back: editBack } : c
        )
      );
      setEditingCard(null);
      const qId = card.tags.find((t) => /^\d+$/.test(t)) || "";
      addActivity({
        type: "card",
        questionId: qId,
        title: stripHtml(editFront).slice(0, 50),
        noteId: card.note_id,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setAnkiEditError(msg);
    } finally {
      setAnkiSaving(false);
    }
  };

  const handleUnsuspend = async (card: AnkiCard) => {
    try {
      await ankiConnect("unsuspend", { cards: [card.card_id] });
      setAnkiCards((prev) =>
        prev.map((c) => c.note_id === card.note_id ? { ...c, suspended: false } : c)
      );
    } catch {
      setAnkiEditError("Unsuspend failed — is Anki open?");
    }
  };

  const handleFormatCard = async () => {
    setAnkiFormatting(true);
    setAnkiEditError("");
    try {
      const tpl = userTemplates.find((t) => t.slug === selectedCardTemplate);
      const resp = await fetch("/api/format-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: editFront,
          back: editBack,
          template: tpl?.content || "",
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setEditFront(data.front);
        setEditBack(data.back);
        if (ankiFrontRef.current) ankiFrontRef.current.innerHTML = data.front;
        if (ankiBackRef.current) ankiBackRef.current.innerHTML = data.back;
      } else {
        setAnkiEditError(data.error || "Format failed.");
      }
    } catch {
      setAnkiEditError("Failed to format card.");
    } finally {
      setAnkiFormatting(false);
    }
  };

  // Other handlers
  const handleReindex = async () => {
    setLoading(true);
    try {
      await fetch("/api/reindex", { method: "POST" });
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: "Re-index complete." }]);
    } catch (error) { console.error("Reindex error:", error); }
    finally { setLoading(false); }
  };

  const handleCopyJson = (text: string) => { navigator.clipboard.writeText(text); };

  // Workflow stepper data
  const workflowSteps = [
    { key: "extracting", label: "Extract" },
    { key: "questioning", label: "Questions" },
    { key: "answering", label: "Answers" },
    { key: "generating", label: "Generate" },
    { key: "done", label: "Done" },
  ];
  const stepOrder = ["idle", "extracting", "questioning", "answering", "generating", "done"];
  const currentStepIndex = stepOrder.indexOf(workflowStep);
  const isInWorkflow = workflowStep !== "idle";

  // Editor: filtered notes
  const filteredNotes = allNotes.filter((n) =>
    n.title.toLowerCase().includes(noteSearch.toLowerCase())
  );

  // Anki create: unique tags across all notes (for tag filter chips)
  const allNotesTags = Array.from(
    new Set(allNotes.flatMap((n) => n.tags || []))
  ).sort();

  // Anki create: notes filtered by search text and selected tag chip
  const filteredCreateNotes = allNotes.filter((n) => {
    const matchSearch = n.title.toLowerCase().includes(ankiCreateNoteSearch.toLowerCase());
    const matchTag = !ankiCreateTagFilter || (n.tags || []).includes(ankiCreateTagFilter);
    return matchSearch && matchTag;
  });

  // Strip HTML tags to get plain text (used to detect empty card fronts)
  const stripHtml = (html: string) =>
    html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();

  const isSameItem = (a: ActivityItem, b: Omit<ActivityItem, "savedAt">): boolean => {
    if (a.type !== b.type) return false;
    if (b.notePath) return a.notePath === b.notePath;
    if (b.noteId !== undefined) return a.noteId === b.noteId;
    if (b.questionId) return a.questionId === b.questionId;
    return false;
  };

  const addActivity = (item: Omit<ActivityItem, "savedAt">) => {
    setActivityHistory((prev) => {
      // Remove any existing entry for this item, then prepend (most-recently-used order)
      const deduped = prev.filter(existing => !isSameItem(existing, item));
      const next = [{ ...item, savedAt: Date.now() }, ...deduped].slice(0, 50);
      saveUserData("obsidianChatActivity", next);
      return next;
    });
  };

  // Simple markdown renderer for note viewer
  // renderMarkdown imported from @/lib/render-markdown

  // Extract tags from frontmatter via regex
  const getNoteTags = (content: string): string[] => {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return [];
    const lines = match[1].split("\n");
    const tags: string[] = [];
    let inTags = false;
    for (const line of lines) {
      if (line.trim() === "tags:") { inTags = true; continue; }
      if (inTags && line.trim().startsWith("- ")) {
        tags.push(line.trim().replace(/^- /, "").replace(/^['"]|['"]$/g, ""));
      } else if (inTags && !line.trim().startsWith("- ")) {
        inTags = false;
      }
    }
    return tags;
  };

  return (
    <div className={styles.appWrapper}>
      {/* Top Navbar */}
      <nav className={styles.navbar}>
        <a href="/" className={styles.navBrand}>
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#0d0618"/>
            <defs>
              <linearGradient id="hdrBolt" x1="0.4" y1="0" x2="0.6" y2="1">
                <stop offset="0%" stopColor="#d8b4fe"/>
                <stop offset="50%" stopColor="#a855f7"/>
                <stop offset="100%" stopColor="#6d28d9"/>
              </linearGradient>
            </defs>
            <line x1="2" y1="17" x2="6" y2="17" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round"/>
            <line x1="25" y1="17" x2="30" y2="17" stroke="#4c1d95" strokeWidth="2" strokeLinecap="round"/>
            <polygon points="18,2 7,17 14,17 12,30 23,17 16,17" fill="url(#hdrBolt)"/>
          </svg>
          <span className={styles.sidebarAppName}>GapStrike</span>
        </a>
        <div className={styles.navTabs}>
          <button
            className={`${styles.navTab} ${viewMode === "flow" ? styles.navTabActive : ""}`}
            onClick={() => setViewMode("flow")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Flow
          </button>
          <button
            className={`${styles.navTab} ${viewMode === "editor" ? styles.navTabActive : ""}`}
            onClick={() => setViewMode("editor")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z" /><path d="M9 4v16" /><path d="M4 9h5" /><path d="M4 14h5" /></svg>
            Obsidian
          </button>
          <button
            className={`${styles.navTab} ${viewMode === "anki" ? styles.navTabActive : ""}`}
            onClick={() => setViewMode("anki")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            Anki
          </button>
          <button
            className={`${styles.navTab} ${viewMode === "templates" ? styles.navTabActive : ""}`}
            onClick={() => setViewMode("templates")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            Templates
          </button>
          <a href="/integrations" className={styles.navTab}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            Integrations
          </a>
        </div>
        {gsUser && (
          <div className={styles.navRight}>
            <span className={`${styles.navPill} ${styles.navPillNeutral}`}>{gsUser.plan === 'free' ? 'Free' : gsUser.plan}</span>
            <span className={`${styles.navPill} ${styles.navPillGreen}`}>{gsUser.status}</span>
            <div className={styles.navDivider} />
            <span className={styles.navEmail}>{gsUser.email}</span>
            <a href="/api/logout" className={styles.navLogout}>Logout</a>
          </div>
        )}
      </nav>

      <div className={styles.container}>
      {!viewReady ? null : viewMode === "flow" ? (
        <FlowView
          savedExtractions={savedExtractions}
          userTemplates={userTemplates}
          repo={repo}
          vaultName={vaultPath}
          initialExtractionId={activeFlowId}
          onNewExtraction={handleFlowNewExtraction}
          onDeleteExtraction={(id) => {
            setSavedExtractions(prev => {
              const updated = prev.filter(x => x.id !== id);
              saveUserData("savedExtractions", updated);
              return updated;
            });
            if (activeFlowId === id) {
              setActiveFlowId(null);
              localStorage.setItem("activeFlowExtractionId", "");
            }
          }}
          onExtractionChange={(id) => {
            setActiveFlowId(id);
            localStorage.setItem("activeFlowExtractionId", id || "");
          }}
        />
      ) : (
        <>
      {/* Left Sidebar */}
      <div className={styles.sidebar}>
        {/* Connect prompt when no repo */}
        {!repo && (
          <div className={styles.pathSection}>
            <a href="/integrations" className={styles.settingsBtn} style={{ textDecoration: "none" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              Connect repository
            </a>
          </div>
        )}

        {/* Chat sidebar content */}
        {viewMode === "chat" && (
          <>
            {/* Saved extractions */}
            {savedExtractions.length > 0 && (
              <div className={styles.extractionSection}>
                <div className={styles.chatHistoryHeader}>
                  <span className={styles.chatHistoryTitle}>Extractions</span>
                </div>
                <div className={styles.extractionList}>
                  {savedExtractions.map((ext) => (
                    <div
                      key={ext.id}
                      className={styles.extractionItem}
                      onClick={() => {
                        setExtractedJson(ext.extraction);
                        setWorkflowStep("answering");
                        setCurrentQuestion(null);
                        setShowPostGenChoice(false);
                        setShowCreateNoteChoice(false);
                        setShowQuestionPrompt(true);
                        setQuestionCount(0);
                        setPreviousQuestions([]);
                        setQuestionAnswers([]);
                        setDiagnosticQuestions([]);
                        setMcFeedback(null);
                        const label = ext.questionId ? `QID ${ext.questionId}` : "extraction";
                        setMessages(prev => [...prev, {
                          id: Date.now().toString(),
                          role: "assistant",
                          content: `Loaded ${label}: **${ext.title}**`,
                          isJson: false,
                        }]);
                      }}
                      title={ext.title}
                    >
                      <span className={styles.extractionQid}>{ext.questionId ?? "—"}</span>
                      <span className={styles.extractionTitle}>{ext.title}</span>
                      <button
                        className={styles.chatHistoryDeleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSavedExtractions(prev => {
                            const updated = prev.filter(x => x.id !== ext.id);
                            saveUserData("savedExtractions", updated);
                            return updated;
                          });
                        }}
                        title="Delete"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat history */}
            <div className={styles.chatHistorySection}>
              <div className={styles.chatHistoryHeader}>
                <span className={styles.chatHistoryTitle}>Chats</span>
              </div>
              <button className={styles.newChatBtn} onClick={startNewChat}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New chat
              </button>
              <div className={styles.chatHistoryList}>
                {chatSessions.length === 0 && (
                  <div className={styles.chatHistoryEmpty}>No past chats yet</div>
                )}
                {chatSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`${styles.chatHistoryItem} ${currentSessionId === session.id ? styles.chatHistoryItemActive : ""}`}
                    onClick={() => loadSession(session)}
                  >
                    <div className={styles.chatHistoryItemTitle}>{session.title}</div>
                    <div className={styles.chatHistoryItemMeta}>{formatRelativeTime(session.updatedAt)}</div>
                    <button
                      className={styles.chatHistoryDeleteBtn}
                      onClick={(e) => deleteSession(session.id, e)}
                      title="Delete"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {isInWorkflow && (
              <button onClick={resetWorkflow} className={styles.resetBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", marginRight: "5px", verticalAlign: "middle" }}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                Start Over
              </button>
            )}
          </>
        )}

        {/* Editor sidebar: note list */}
        {viewMode === "editor" && (
          <div className={styles.editorNoteList}>
            <input
              type="text"
              placeholder="🔍 Search notes..."
              value={noteSearch}
              onChange={(e) => setNoteSearch(e.target.value)}
              className={styles.noteSearchInput}
            />
            <div className={styles.noteCount}>{filteredNotes.length} notes</div>
            <div className={styles.noteListScroll}>
              {filteredNotes.map((note, idx) => (
                <button
                  key={idx}
                  className={`${styles.noteListItem} ${selectedNote?.path === note.path ? styles.noteListItemActive : ""}`}
                  onClick={() => openNote(note)}
                >
                  <div className={styles.noteListTitle}>{note.title}</div>
                  <div className={styles.noteListPath}>{note.path}</div>
                </button>
              ))}
              {filteredNotes.length === 0 && (
                <div className={styles.noteListEmpty}>No notes found</div>
              )}
            </div>
          </div>
        )}

        {/* Anki sidebar: search form */}
        {viewMode === "anki" && (
          <div className={styles.editorNoteList}>
            <div className={styles.ankiSearchForm}>
              <input
                type="text"
                placeholder="e.g. 2513  →  tag::2513"
                value={ankiQuery}
                onChange={(e) => setAnkiQuery(e.target.value)}
                className={styles.noteSearchInput}
              />
            </div>
            <div className={styles.ankiSyntaxHints}>
              <div className={styles.ankiHint}>2513 → ::2513</div>
              <div className={styles.ankiHint}>uworld → ::uworld</div>
            </div>
            {ankiCards.length > 0 && (
              <div className={styles.noteCount}>{ankiCards.length} cards found</div>
            )}
          </div>
        )}
      </div>

      {/* Center */}
      {viewMode === "chat" ? (
        /* ── Chat View ──────────────────────────────────────────────── */
        <div className={styles.chatContainer} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
          {isDragging && (
            <div className={styles.dragOverlay}>
              <div className={styles.dragOverlayContent}>
                <svg className={styles.dragIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <span>Drop screenshots here</span>
              </div>
            </div>
          )}

          <div className={styles.messages}>
            {messages.length === 0 ? (
              <div className={styles.emptyState}>
                <h2>GapStrike</h2>
                <p>Type to chat • Paste screenshots to create error notes</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`${styles.message} ${styles[msg.role]}`}>
                  <div className={styles.messageContent}>
                    {msg.isJson ? (
                      <div className={styles.jsonWrapper}>
                        <div className={styles.jsonHeader}>
                          <span>Extracted JSON</span>
                          <button className={styles.copyBtn} onClick={() => handleCopyJson(msg.content)}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                            Copy
                          </button>
                        </div>
                        <pre className={styles.jsonOutput}>{msg.content}</pre>
                      </div>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>") }} />
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />

            {/* Progressive loading indicator */}
            {loading && (
              <div className={`${styles.message} ${styles.assistant}`}>
                <div className={`${styles.messageContent} ${styles.loadingBubble}`}>
                  <div className={styles.loadingInner}>
                    <div className={styles.spinner} />
                    <div className={styles.loadingText}>
                      <span className={styles.thinkingLabel}>Thinking<span className={styles.ellipsis} /></span>
                      <span className={styles.statusLine}>{statusMsg}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {workflowStep === "answering" && (showQuestionPrompt || showPostGenChoice || showCreateNoteChoice || currentQuestion !== null) && (
            showQuestionPrompt ? (
              /* ── Loaded extraction: generate question? ────────────── */
              <div className={styles.questionCards}>
                <div className={styles.questionCard}>
                  <div style={{ fontSize: "14px", color: "#dcddde", marginBottom: "16px" }}>
                    Would you like me to generate a question from this extraction?
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #22c55e", background: "rgba(34,197,94,0.15)", color: "#22c55e", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}
                      onClick={async () => {
                        setShowQuestionPrompt(false);
                        setLoading(true);
                        setWorkflowStep("questioning");
                        setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "Generating question..." }]);
                        const firstQ = await fetchNextQuestion(extractedJson, [], 0);
                        setLoading(false);
                        if (!firstQ) {
                          setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "Could not generate a question. Try again." }]);
                          setWorkflowStep("idle");
                          return;
                        }
                        setCurrentQuestion(firstQ);
                        setQuestionCount(1);
                        setPreviousQuestions([firstQ.question]);
                        setDiagnosticQuestions([firstQ.question]);
                        setMcFeedback(null);
                        const optionsText = firstQ.options.map((o: string, i: number) => `  ${String.fromCharCode(65 + i)}) ${o}`).join("\n");
                        setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: `**Question 1** *(${firstQ.difficulty})*\n\n${firstQ.question}\n\n${optionsText}` }]);
                        setWorkflowStep("answering");
                      }}
                    >
                      Yes, Ask Me
                    </button>
                    <button
                      style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #888", background: "#2a2a2a", color: "#dcddde", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}
                      onClick={() => {
                        setShowQuestionPrompt(false);
                        setWorkflowStep("idle");
                      }}
                    >
                      No Thanks
                    </button>
                  </div>
                </div>
              </div>
            ) : showPostGenChoice ? (
              /* ── Post-generation: want more questions? ──────────────── */
              <div className={styles.questionCards}>
                <div className={styles.questionCard}>
                  <div style={{ fontSize: "14px", color: "#dcddde", marginBottom: "16px" }}>
                    📝 Note created! Want to keep going with more questions?
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #22c55e", background: "rgba(34,197,94,0.15)", color: "#22c55e", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}
                      onClick={async () => {
                        setShowPostGenChoice(false);
                        setLoading(true);
                        const nextQ = await fetchNextQuestion(extractedJson, previousQuestions, questionCount);
                        setLoading(false);
                        if (!nextQ) {
                          setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: "No more unique questions could be generated. You're done!" }]);
                          setWorkflowStep("done");
                          return;
                        }
                        const newCount = questionCount + 1;
                        setCurrentQuestion(nextQ);
                        setQuestionCount(newCount);
                        setPreviousQuestions((prev) => [...prev, nextQ.question]);
                        setDiagnosticQuestions([nextQ.question]);
                        setMcFeedback(null);
                        setQuestionAnswers([]);
                        const optionsText = nextQ.options.map((o: string, i: number) => `  ${String.fromCharCode(65 + i)}) ${o}`).join("\n");
                        setMessages((prev) => [...prev, {
                          id: Date.now().toString(), role: "assistant",
                          content: `➡️ **Question ${newCount}** *(${nextQ.difficulty})*:\n\n${nextQ.question}\n\n${optionsText}`
                        }]);
                      }}
                    >
                      More Questions
                    </button>
                    <button
                      style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #888", background: "#2a2a2a", color: "#dcddde", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}
                      onClick={() => {
                        resetWorkflow();
                        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: "✅ Done! Paste more screenshots whenever you're ready." }]);
                      }}
                    >
                      I'm Done
                    </button>
                  </div>
                </div>
              </div>
            ) : showCreateNoteChoice ? (
              /* ── Correct answer: create note anyway? ────────────────── */
              <div className={styles.questionCards}>
                <div className={styles.questionCard}>
                  <div style={{ fontSize: "14px", color: "#dcddde", marginBottom: "16px" }}>
                    ✅ You got it right! Want to create a note for this question anyway?
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #22c55e", background: "rgba(34,197,94,0.15)", color: "#22c55e", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}
                      onClick={() => {
                        setShowCreateNoteChoice(false);
                        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: "📝 Generating your note..." }]);
                        handleSubmitAnswers(questionAnswers);
                      }}
                    >
                      Yes, Create Note
                    </button>
                    <button
                      style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #888", background: "#2a2a2a", color: "#dcddde", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}
                      onClick={() => {
                        setShowCreateNoteChoice(false);
                        setShowPostGenChoice(true);
                      }}
                    >
                      No, Skip
                    </button>
                  </div>
                </div>
              </div>
            ) : currentQuestion ? (
              <div className={styles.questionCards}>
                <div className={styles.questionCard}>
                  <label className={styles.questionLabel}>
                    <span className={styles.questionNumber}>{questionCount}</span>
                    <span>{currentQuestion.question}</span>
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                    {currentQuestion.options.map((opt: string, i: number) => {
                      let btnStyle: React.CSSProperties = {
                        padding: "12px 16px", border: "1px solid #444", borderRadius: "10px",
                        background: "#2a2a2a", color: "#dcddde", cursor: "pointer", textAlign: "left" as const,
                        fontSize: "13px", fontFamily: "inherit", transition: "all 0.2s",
                        display: "flex", alignItems: "center", gap: "10px",
                      };
                      if (mcFeedback) {
                        if (i === currentQuestion.correct) {
                          btnStyle = { ...btnStyle, border: "2px solid #22c55e", background: "rgba(34,197,94,0.15)", color: "#22c55e" };
                        } else if (i === mcFeedback.selected && !mcFeedback.correct) {
                          btnStyle = { ...btnStyle, border: "2px solid #ef4444", background: "rgba(239,68,68,0.15)", color: "#ef4444" };
                        } else {
                          btnStyle = { ...btnStyle, opacity: 0.4 };
                        }
                      }
                      return (
                        <button key={i} style={btnStyle} onClick={() => handleMCAnswer(i)} disabled={!!mcFeedback}>
                          <span style={{ fontWeight: 700, minWidth: "20px" }}>{String.fromCharCode(65 + i)})</span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "#666", textTransform: "uppercase" as const, letterSpacing: "1px" }}>
                    {currentQuestion?.difficulty} • Question {questionCount}
                  </div>
                </div>
              </div>
            ) : null
          )}

          {uploadedImages.length > 0 && (
            <div className={styles.thumbnailStrip}>
              {uploadedImages.map((img, idx) => (
                <div key={idx} className={styles.thumbnailContainer}>
                  <img src={img} alt={`Screenshot ${idx + 1}`} className={styles.thumbnail} />
                  <button className={styles.thumbnailRemove} onClick={() => removeImage(idx)}>✕</button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSend} className={styles.inputForm}>
            <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) handleImageUpload(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
            <button type="button" className={styles.uploadBtn} onClick={() => imageInputRef.current?.click()} title="Upload screenshot" aria-label="Upload screenshot">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            </button>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder={workflowStep === "answering" ? "Use the answer fields above..." : uploadedImages.length > 0 ? "Press Send to start error-note workflow..." : "Ask about your notes or paste screenshots..."} disabled={loading || workflowStep === "answering"} className={styles.messageInput} />
            <button type="submit" disabled={loading || workflowStep === "answering" || (!input.trim() && uploadedImages.length === 0)} className={styles.sendBtn}>
              {loading ? "..." : uploadedImages.length > 0 ? `Send (${uploadedImages.length})` : "Send"}
            </button>
          </form>
        </div>
      ) : viewMode === "editor" ? (
        /* ── Editor View ────────────────────────────────────────────── */
        <div className={styles.editorContainer}>
          {selectedNote ? (
            <>
              <div className={styles.editorHeader}>
                <button className={styles.backToGraphBtn} onClick={() => { setSelectedNote(null); setNoteContent(""); }} title="Back to graph">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <div className={styles.editorTitleSection}>
                  <h2 className={styles.editorTitle}>{selectedNote.title}</h2>
                  <span className={styles.editorPath}>{selectedNote.path}</span>
                </div>
                <div className={styles.editorActions}>
                  <select
                    className={styles.templateSelector}
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                  >
                    <option value="">All templates</option>
                    {templates.map((t, i) => (
                      <option key={i} value={t.filename}>{t.name}</option>
                    ))}
                  </select>
                  <button className={styles.formatNoteBtn} onClick={() => formatNote("sections")} disabled={formatting}>
                    {formatting ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinIcon} aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg>
                        Formatting...
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                        Format
                      </>
                    )}
                  </button>
                  <button className={styles.saveNoteBtn} onClick={saveNote} disabled={savingNote || formatting}>
                    {savingNote ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinIcon} aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                        Save
                      </>
                    )}
                  </button>
                  <button className={styles.deleteNoteBtn} onClick={deleteNote} disabled={deletingNote || savingNote || formatting}>
                    {deletingNote ? "Deleting…" : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                        Delete
                      </>
                    )}
                  </button>
                  <button className={styles.keyNoteBtn} onClick={handleKeyNote} disabled={keyNoteLoading || formatting}>
                    {keyNoteLoading ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinIcon} aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg>
                        Synthesizing...
                      </>
                    ) : (
                      <>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                        Key Note
                      </>
                    )}
                  </button>
                  <button className={styles.openObsidianBtn} onClick={openInObsidian}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                    Obsidian
                  </button>
                </div>
              </div>
              {noteContent && (
                <div className={styles.editorTagBar}>
                  {getNoteTags(noteContent).map((tag, i) => (
                    <span key={i} className={styles.editorTag}>{tag}</span>
                  ))}
                </div>
              )}
              {loadingNote ? (
                <div className={styles.editorLoading}>Loading note...</div>
              ) : (
                <div
                  className={`${styles.editorSplitView} ${formatting ? styles.editorStreaming : ""}`}
                  style={{ cursor: isSelectionMode ? "crosshair" : "auto" }}
                  onMouseUp={() => {
                    if (isSelectionMode) {
                      let text = window.getSelection()?.toString() || "";
                      if (!text.trim() && editorTextAreaRef.current) {
                        const start = editorTextAreaRef.current.selectionStart;
                        const end = editorTextAreaRef.current.selectionEnd;
                        if (start !== end && start !== undefined && end !== undefined) {
                          text = noteContent.substring(start, end);
                        }
                      }
                      if (text.trim()) {
                        setSelectionConfirmText(text.trim());
                      }
                    }
                  }}
                >
                  <textarea
                    ref={editorTextAreaRef}
                    className={styles.editorTextarea}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    spellCheck={false}
                  />
                  <div className={styles.editorPreview} dangerouslySetInnerHTML={{ __html: renderMarkdown(noteContent) }} />
                </div>
              )}
              {/* Selection guidance banner */}
              {pendingFormatMode && (
                <div className={styles.selectionBanner}>
                  {selectionConfirmText ? (
                    <>
                      <div className={styles.selectionBannerLabel}>
                        Is this the right selection for <strong>{pendingFormatMode}</strong>?
                      </div>
                      <div className={styles.selectionBannerPreview}>"{selectionConfirmText}"</div>
                      <div className={styles.selectionBannerActions}>
                        <button
                          className={styles.selectionConfirmBtn}
                          onClick={() => {
                            const mode = pendingFormatMode;
                            const text = selectionConfirmText;
                            setIsSelectionMode(false);
                            setSelectionConfirmText("");
                            setPendingFormatMode(null);
                            formatNote(mode, text);
                          }}
                        >
                          Yes, format
                        </button>
                        <button
                          className={styles.selectionRetryBtn}
                          onClick={() => setSelectionConfirmText("")}
                        >
                          Try again
                        </button>
                        <button
                          className={styles.selectionCancelBtn}
                          onClick={() => { setIsSelectionMode(false); setSelectionConfirmText(""); setPendingFormatMode(null); }}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={styles.selectionBannerLabel}>
                        Highlight the text to <strong>{pendingFormatMode}</strong>...
                      </div>
                      <button
                        className={styles.selectionCancelBtn}
                        onClick={() => { setIsSelectionMode(false); setPendingFormatMode(null); }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              )}
              {/* Format Chip Toolbar */}
              <div className={styles.formatBar}>
                {/* Feynman */}
                <button
                  type="button"
                  className={`${styles.formatChip} ${styles.formatChipFeynman} ${streamingChip === "feynman" ? styles.formatChipStreaming : ""}`}
                  onClick={() => startSelectionFor("feynman")}
                  disabled={formatting}
                  title="Rewrite selected text in plain student-friendly language"
                  aria-label="Feynman: rewrite as simple explanation"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 3-2 5.5-4 7l-1 3H10l-1-3C7 14.5 5 12 5 9a7 7 0 0 1 7-7z"/><line x1="10" y1="22" x2="14" y2="22"/></svg>
                  Feynman
                </button>

                {/* Flowchart */}
                <button
                  type="button"
                  className={`${styles.formatChip} ${styles.formatChipFlowchart} ${streamingChip === "flowchart" ? styles.formatChipStreaming : ""}`}
                  onClick={() => startSelectionFor("flowchart")}
                  disabled={formatting}
                  title="Append a flowchart to selected text"
                  aria-label="Flowchart: append HTML diagram"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="4" rx="1"/><rect x="15" y="3" width="6" height="4" rx="1"/><rect x="9" y="17" width="6" height="4" rx="1"/><line x1="6" y1="7" x2="6" y2="19"/><line x1="18" y1="7" x2="18" y2="12"/><line x1="6" y1="19" x2="9" y2="19"/><line x1="15" y1="19" x2="18" y2="19"/><line x1="18" y1="12" x2="15" y2="19"/></svg>
                  Flowchart
                </button>

                {/* Expand */}
                <button
                  type="button"
                  className={`${styles.formatChip} ${streamingChip === "expand" ? styles.formatChipStreaming : ""}`}
                  onClick={() => startSelectionFor("expand")}
                  disabled={formatting}
                  aria-label="Expand selected text with more detail"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                  Expand
                </button>

                {/* Concise */}
                <button
                  type="button"
                  className={`${styles.formatChip} ${streamingChip === "concise" ? styles.formatChipStreaming : ""}`}
                  onClick={() => startSelectionFor("concise")}
                  disabled={formatting}
                  aria-label="Condense selected text"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/></svg>
                  Concise
                </button>

                {/* List */}
                <button
                  type="button"
                  className={`${styles.formatChip} ${streamingChip === "list" ? styles.formatChipStreaming : ""}`}
                  onClick={() => formatNote("list")}
                  disabled={formatting}
                  aria-label="Convert to list"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>
                  List
                </button>

                {/* Table */}
                <button
                  type="button"
                  className={`${styles.formatChip} ${streamingChip === "table" ? styles.formatChipStreaming : ""}`}
                  onClick={() => formatNote("table")}
                  disabled={formatting}
                  aria-label="Convert to table"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/></svg>
                  Table
                </button>

                {/* Split */}
                <button
                  type="button"
                  className={`${styles.formatChip} ${streamingChip === "split" ? styles.formatChipStreaming : ""}`}
                  onClick={() => formatNote("split")}
                  disabled={formatting}
                  aria-label="Split into shorter ideas"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="3" x2="12" y2="21"/><path d="M3 8h9"/><path d="M3 16h9"/><path d="M15 8h6"/><path d="M15 16h6"/></svg>
                  Split
                </button>

                {/* Sections */}
                <button
                  type="button"
                  className={`${styles.formatChip} ${streamingChip === "sections" ? styles.formatChipStreaming : ""}`}
                  onClick={() => formatNote("sections")}
                  disabled={formatting}
                  aria-label="Divide into sections with subtitles"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
                  Sections
                </button>

                <div className={styles.formatBarSpacer} />

                {/* Undo */}
                <button
                  type="button"
                  className={styles.formatUndoBtn}
                  title="Undo last format"
                  aria-label="Undo last format"
                  disabled={noteHistory.length === 0 || formatting}
                  onClick={() => {
                    const newHistory = [...noteHistory];
                    const prev = newHistory.pop();
                    if (prev !== undefined) {
                      setNoteContent(prev);
                      setNoteHistory(newHistory);
                    }
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 2.2-5.8"/></svg>
                </button>
              </div>
            </>
          ) : (
            <div className={styles.graphView}>
              <div className={styles.graphTopBar}>
                <div className={styles.graphSearchWrap}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input
                    type="text"
                    placeholder="Search notes..."
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    className={styles.graphSearchInput}
                  />
                  {noteSearch && filteredNotes.length > 0 && (
                    <div className={styles.graphSearchResults}>
                      {filteredNotes.slice(0, 8).map((note, i) => (
                        <button key={i} className={styles.graphSearchItem} onClick={() => { openNote(note); setNoteSearch(""); }}>
                          <span className={styles.graphSearchItemTitle}>{note.title}</span>
                          {note.tags && note.tags.length > 0 && (
                            <span className={styles.graphSearchItemTags}>{note.tags.slice(0, 3).join(", ")}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  className={`${styles.graphLabelToggle} ${showGraphLabels ? styles.graphLabelToggleActive : ""}`}
                  onClick={() => setShowGraphLabels((v) => !v)}
                  title={showGraphLabels ? "Hide labels" : "Show labels"}
                  aria-label={showGraphLabels ? "Hide labels" : "Show labels"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></svg>
                  <span>Labels</span>
                </button>
                <span className={styles.graphNoteCount}>{allNotes.length} notes</span>
              </div>
              <NoteGraph notes={allNotes} onSelectNote={(note) => openNote(note)} showLabels={showGraphLabels} />
            </div>
          )}
        </div>
      ) : viewMode === "templates" ? (
        /* ── Templates View ────────────────────────────────────────── */
        <TemplatesView
          templates={userTemplates}
          onUpdate={handleTemplateUpdate}
          onReset={handleTemplateReset}
        />
      ) : (
        /* ── Anki View ──────────────────────────────────────────────── */
        <div className={styles.ankiContainer}>
          {/* Filter bar */}
          <div className={styles.ankiFilterBar}>
            <div className={styles.ankiFilterSearchWrap}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                type="text"
                placeholder="Search cards... e.g. 2513, deck:MyDeck"
                value={ankiQuery}
                onChange={(e) => setAnkiQuery(e.target.value)}
                className={styles.ankiFilterInput}
              />
              {ankiQuery && (
                <button className={styles.ankiFilterClear} onClick={() => setAnkiQuery("")} aria-label="Clear search">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
            <div className={styles.ankiFilterHints}>
              <span>2513 → tag::2513</span>
              <span>tag:neurology</span>
              <span>deck:MyDeck</span>
            </div>
            {allNotesTags.length > 0 && (
              <div className={styles.ankiFilterTags}>
                {allNotesTags.map((tag) => (
                  <button
                    key={tag}
                    className={`${styles.ankiFilterTag} ${ankiQuery === tag ? styles.ankiFilterTagActive : ""}`}
                    onClick={() => setAnkiQuery(ankiQuery === tag ? "" : tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
            {ankiCards.length > 0 && !ankiLoading && (
              <span className={styles.ankiFilterCount}>{ankiCards.length} cards</span>
            )}
          </div>

          {ankiError && (
            <div className={styles.ankiErrorBanner}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {ankiError}
            </div>
          )}

            <div className={styles.ankiCardList}>
              {ankiLoading ? (
                <div className={styles.ankiCenterMsg}>
                  <div className={styles.spinner} />
                  <span>Searching...</span>
                </div>
              ) : ankiCards.length === 0 ? (
                <div className={styles.ankiCenterMsg} style={{ color: "#888" }}>
                  No cards found.
                </div>
              ) : (
                ankiCards.map((card) => {
                  const frontText = stripHtml(card.front);
                  const displayTags = card.tags;
                  const isEditing = editingCard === card.note_id;
                  const tagsExpanded = expandedTagCards.has(card.note_id);
                  return (
                    <div
                      key={card.note_id}
                      className={`${styles.ankiCard} ${isEditing ? styles.ankiCardEditing : ""}`}
                      onClick={isEditing ? undefined : () => {
                        setEditingCard(card.note_id);
                        setEditFront(card.front);
                        setEditBack(card.back);
                        setAnkiEditError("");
                      }}
                    >
                      {/* Collapsed header — card title, hidden while editing */}
                      {!isEditing && (
                        <div className={styles.ankiCardHeader}>
                          <div className={styles.ankiCardFront}>
                            {frontText ? (
                              <span>{frontText}</span>
                            ) : (
                              <span className={styles.ankiCardFrontFallback}>{card.deck}</span>
                            )}
                          </div>
                          <div className={styles.ankiCardHeaderActions}>
                            {card.suspended && (
                              <span className={styles.suspendedBadge}>suspended</span>
                            )}
                            {card.suspended && (
                              <button
                                className={styles.unsuspendBtn}
                                onClick={(e) => { e.stopPropagation(); handleUnsuspend(card); }}
                              >
                                Unsuspend ↑
                              </button>
                            )}
                            <svg
                              className={styles.ankiChevron}
                              width="14" height="14" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2"
                              strokeLinecap="round" strokeLinejoin="round"
                              aria-hidden="true"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* Edit panel — shown immediately on click */}
                      {isEditing && (
                        <div className={styles.ankiEditPanel} onClick={(e) => e.stopPropagation()}>
                          <div className={styles.ankiEditPanelHeader}>
                            <div className={styles.ankiDeckBadge}>{card.deck}</div>
                            <button
                              className={styles.ankiCollapseBtn}
                              onClick={() => { setEditingCard(null); setAnkiEditError(""); }}
                              title="Collapse"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15" /></svg>
                            </button>
                          </div>
                          <div className={styles.ankiEditLabelRow}>
                            <label className={styles.ankiEditLabel}>Front</label>
                            {ankiCardTemplates.length > 0 && (
                              <select
                                className={styles.ankiTemplateSelect}
                                value={selectedCardTemplate}
                                onChange={(e) => setSelectedCardTemplate(e.target.value)}
                              >
                                {ankiCardTemplates.map((t) => (
                                  <option key={t.filename} value={t.filename}>{t.name}</option>
                                ))}
                              </select>
                            )}
                            <button
                              className={styles.ankiFormatBtn}
                              onClick={handleFormatCard}
                              disabled={ankiFormatting || ankiSaving}
                            >
                              {ankiFormatting ? "Formatting…" : "Format"}
                            </button>
                          </div>
                          <div
                            ref={ankiFrontRef}
                            className={styles.ankiEditRichText}
                            contentEditable
                            suppressContentEditableWarning
                            onInput={(e) => setEditFront(e.currentTarget.innerHTML)}
                            spellCheck={false}
                            style={{ minHeight: "80px" }}
                          />
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
                          {ankiEditError && (
                            <div className={styles.ankiEditError}>{ankiEditError}</div>
                          )}
                          <div className={styles.ankiEditButtons}>
                            <button
                              className={styles.ankiSaveBtn}
                              onClick={() => handleSaveCard(card)}
                              disabled={ankiSaving || ankiFormatting}
                            >
                              {ankiSaving ? "Saving…" : "Save"}
                            </button>
                            <button
                              className={styles.ankiCancelBtn}
                              onClick={() => { setEditingCard(null); setAnkiEditError(""); }}
                              disabled={ankiSaving || ankiFormatting}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tags at bottom — only visible in edit mode */}
                      {isEditing && displayTags.length > 0 && (
                        <div className={styles.ankiCardTagsFooter} onClick={(e) => e.stopPropagation()}>
                          <div className={`${styles.ankiCardTagsRow} ${displayTags.length > 4 && !tagsExpanded ? styles.ankiCardTagsCollapsed : ""}`}>
                            {displayTags.map((tag, i) => (
                              <span key={i} className={styles.resultTag}>{tag}</span>
                            ))}
                          </div>
                          {displayTags.length > 4 && (
                            <button
                              className={styles.ankiTagsToggleBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTagCards((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(card.note_id)) next.delete(card.note_id);
                                  else next.add(card.note_id);
                                  return next;
                                });
                              }}
                            >
                              {tagsExpanded ? "▲" : `+${displayTags.length - 4} ▼`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
        </div>
      )}

      {/* Right Sidebar — always Activity */}
      <div className={styles.sourcesPanel}>
        <h3>Activity</h3>

        {/* Workflow stepper — only during active workflow */}
        {isInWorkflow && (
          <div className={styles.workflowStepper}>
            {workflowSteps.map((step) => {
              const stepIdx = stepOrder.indexOf(step.key);
              return (
                <div key={step.key} className={`${styles.workflowStepItem} ${currentStepIndex > stepIdx ? styles.stepDone : ""} ${currentStepIndex === stepIdx ? styles.stepActive : ""}`}>
                  <div className={`${styles.stepIcon} ${currentStepIndex > stepIdx ? styles.stepIconDone : ""}`}>
                    {currentStepIndex > stepIdx ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : currentStepIndex === stepIdx ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinIcon} aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /></svg>
                    )}
                  </div>
                  <div className={styles.stepLabel}>{step.label}</div>
                </div>
              );
            })}
            {errorNoteResult && errorNoteResult.notes && (
              <div>
                {errorNoteResult.notes.map((note, i) => (
                  <div key={i} className={styles.resultCard}>
                    <div className={styles.resultHeader}>Note {i + 1}: {note.action === "created" ? "Created" : note.action === "error" ? "Error" : "Updated"}</div>
                    <div className={styles.resultItem}><strong>Path:</strong> {note.file_path}</div>
                    <div className={styles.resultItem}><strong>Pattern:</strong> {note.error_pattern}</div>
                    <div className={styles.resultTagList}>{(note.tags || []).map((tag, j) => (<span key={j} className={styles.resultTag}>{tag}</span>))}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Context zone — card detection for currently open note */}
        {viewMode === "editor" && selectedNote && Object.keys(noteCardCounts).length > 0 && (
          <div className={styles.activityContext}>
            <div className={styles.activityContextLabel}>Question IDs in this note</div>
            {Object.entries(noteCardCounts).map(([qId, count]) => (
              <div key={qId} className={styles.activityContextRow}>
                <span className={styles.activityQId}>{qId}</span>
                {count === null ? (
                  <span className={styles.activityStatus}>⏳</span>
                ) : count === -1 ? (
                  <span className={styles.activityStatus} style={{ color: "var(--text-muted)" }}>? unavailable</span>
                ) : count === 0 ? (
                  <button
                    className={styles.activityLink}
                    onClick={() => {
                      setViewMode("anki");
                      setAnkiCreateNote(selectedNote.path);
                      setAnkiCreateTagFilter(qId);
                    }}
                  >
                    ⬜ No cards → create
                  </button>
                ) : (
                  <button
                    className={styles.activityLink}
                    onClick={() => {
                      setViewMode("anki");
                      setAnkiQuery(qId);
                    }}
                  >
                    ✅ {count} card{count !== 1 ? "s" : ""} → view
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Activity history feed */}
        <div className={styles.activitySection}>
          <div className={styles.sourcesHeadingRow}>
            <div className={styles.sourcesHeading}>History</div>
            {activityHistory.length > 0 && (
              <button
                className={styles.clearHistoryBtn}
                onClick={() => {
                  setActivityHistory([]);
                  deleteUserData("obsidianChatActivity");
                }}
              >
                Clear
              </button>
            )}
          </div>
          {activityHistory.length === 0 ? (
            <div className={styles.activityEmpty}>No activity recorded yet</div>
          ) : (
            <div className={styles.activityList}>
              {activityHistory.map((item, i) => {
                const ago = (() => {
                  const diff = Date.now() - item.savedAt;
                  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
                  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
                  return new Date(item.savedAt).toLocaleDateString();
                })();
                return (
                  <button
                    key={i}
                    className={styles.activityItem}
                    onClick={() => {
                      if (item.type === "note" && item.notePath) {
                        setViewMode("editor");
                        const note = allNotes.find((n) => n.path === item.notePath);
                        if (note) openNote(note);
                      } else if (item.type === "card" && item.questionId) {
                        setViewMode("anki");
                        setAnkiQuery(item.questionId);
                      }
                    }}
                  >
                    <span className={styles.activityIcon}>
                      {item.type === "card" ? <AnkiIcon /> : <ObsidianIcon />}
                    </span>
                    <div className={styles.activityItemBody}>
                      <div className={styles.activityTitle}>{item.title}</div>
                      <div className={styles.activityMeta}>
                        {item.questionId && <span className={styles.activityQIdSmall}>{item.questionId}</span>}
                        <span>{ago}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
        </>
      )}
      </div>
    </div>
  );
}
