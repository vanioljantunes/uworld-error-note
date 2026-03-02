"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./page.module.css";

type ViewMode = "chat" | "editor" | "anki";
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
  type: "note" | "card";
  questionId: string;
  title: string;
  notePath?: string;
  noteId?: number;
  savedAt: number;
}

const CREWAI_URL = "http://localhost:8000";

const STATUS_MESSAGES = [
  "Searching through your vault",
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
  generating: ["Inferring error pattern", "Composing your note", "Writing to vault", "Formatting with templates"],
};

export default function Home() {
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  const [vaultPath, setVaultPath] = useState(
    "C:\\Users\\vanio\\OneDrive\\Área de Trabalho\\teste_crew\\teste"
  );
  const [showPathSettings, setShowPathSettings] = useState(false);
  const [tempPath, setTempPath] = useState(vaultPath);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [vaultTags, setVaultTags] = useState<string[]>([]);

  // Error-Note workflow
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>("idle");
  const [extractedJson, setExtractedJson] = useState<any>(null);
  const [mcQuestions, setMcQuestions] = useState<MCQuestionItem[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState<string[]>([]);
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<string[]>([]);
  const [mcFeedback, setMcFeedback] = useState<{ selected: number; correct: boolean } | null>(null);
  const [errorNoteResult, setErrorNoteResult] = useState<ErrorNoteResult | null>(null);
  const [showContinueChoice, setShowContinueChoice] = useState(false);
  const [pendingAnswersForNote, setPendingAnswersForNote] = useState<string[]>([]);

  // Editor mode
  const [noteSearch, setNoteSearch] = useState("");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [noteContent, setNoteContent] = useState<string>("");
  const [loadingNote, setLoadingNote] = useState(false);
  const [formatting, setFormatting] = useState(false);
  const [templates, setTemplates] = useState<{ name: string; filename: string }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [formatInstructions, setFormatInstructions] = useState("");

  // Editor: saving & keynote
  const [savingNote, setSavingNote] = useState(false);
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
  // null = loading, -1 = Anki unavailable, 0 = no cards, N = card count

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

  // Progressive loading state
  const [statusMsg, setStatusMsg] = useState("");
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusIndexRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => { scrollToBottom(); }, [messages, statusMsg]);

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

  // Load notes
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const response = await fetch("/api/list-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vaultPath }),
        });
        if (response.ok) {
          const data = await response.json();
          setAllNotes(data.notes || []);
        }
      } catch (error) {
        console.error("Failed to load notes:", error);
      }
    };
    loadNotes();
  }, [vaultPath]);

  // Load activity history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("obsidianChatActivity");
      if (stored) setActivityHistory(JSON.parse(stored));
    } catch { }
  }, []);

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
        const resp = await fetch(`${CREWAI_URL}/anki/direct-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: qId }),
        });
        if (!resp.ok) { setNoteCardCounts((p) => ({ ...p, [qId]: -1 })); return; }
        const data = await resp.json();
        setNoteCardCounts((p) => ({ ...p, [qId]: data.cards?.length ?? 0 }));
      } catch {
        setNoteCardCounts((p) => ({ ...p, [qId]: -1 }));
      }
    });
  }, [selectedNote]);

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const resp = await fetch(`${CREWAI_URL}/templates`);
        if (resp.ok) {
          const data = await resp.json();
          setTemplates(data.templates || []);
        }
      } catch (error) {
        console.error("Failed to load templates:", error);
      }
    };
    loadTemplates();
  }, []);

  // Load vault tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        const response = await fetch(`${CREWAI_URL}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vault_path: vaultPath }),
        });
        if (response.ok) {
          const data = await response.json();
          setVaultTags(data.tags || []);
        }
      } catch (error) {
        console.error("Failed to load vault tags:", error);
      }
    };
    loadTags();
  }, [vaultPath]);

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
    fetch(`${CREWAI_URL}/anki/card-templates`)
      .then((r) => r.json())
      .then((d) => {
        setAnkiCardTemplates(d.templates || []);
        if (d.templates?.length > 0) setSelectedCardTemplate(d.templates[0].filename);
      })
      .catch(() => { });
    fetch(`${CREWAI_URL}/anki/decks`)
      .then((r) => r.json())
      .then((d) => { if (d.decks?.length > 0) { setAnkiDecks(d.decks); setAnkiCreateDeck(d.decks[0]); } })
      .catch(() => { });
  }, [viewMode]);

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
      const resp = await fetch(`${CREWAI_URL}/anki/create-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault_path: vaultPath,
          note_path: ankiCreateNote,
          template_filename: selectedCardTemplate,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setAnkiCreateFront(data.front);
        setAnkiCreateBack(data.back);
      } else {
        setAnkiCreateError(data.error || "Generation failed.");
      }
    } catch {
      setAnkiCreateError("Failed to reach backend.");
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
      const resp = await fetch(`${CREWAI_URL}/anki/add-note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deck: ankiCreateDeck || "Default",
          model: "Cloze",
          front: ankiCreateFront,
          back: ankiCreateBack,
          tags: [],
          field_names: ["Text", "Extra"],
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setAnkiCreateSuccess("Card added to Anki successfully!");
        setAnkiCreateFront("");
        setAnkiCreateBack("");
        setAnkiCreateNote("");
      } else {
        setAnkiCreateError(data.error || "Failed to add card.");
      }
    } catch {
      setAnkiCreateError("Failed to reach backend.");
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
        body: JSON.stringify({ message: input, tag: tagFilter || undefined, vaultPath }),
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

      setWorkflowStep("questioning");
      const questionsResp = await fetch(`${CREWAI_URL}/questions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extraction: extracted }) });
      if (!questionsResp.ok) throw new Error(`Questions error: ${questionsResp.status}`);
      const questionsData = await questionsResp.json();
      const mcQs: MCQuestionItem[] = (questionsData.questions || []).filter((q: any) => q && q.question && Array.isArray(q.options) && q.options.length > 0);
      if (mcQs.length === 0) throw new Error("No valid MC questions returned");
      setMcQuestions(mcQs);
      setCurrentQuestionIdx(0);
      setQuestionAnswers([]);
      setDiagnosticQuestions(mcQs.map((q: MCQuestionItem) => q.question));
      setMcFeedback(null);

      // Show first question in chat
      if (mcQs.length > 0) {
        const q = mcQs[0];
        const optionsText = q.options.map((o, i) => `  ${String.fromCharCode(65 + i)}) ${o}`).join("\n");
        setMessages((prev) => [...prev, { id: (Date.now() + 2).toString(), role: "assistant", content: `🧠 **Question 1** *(${q.difficulty})*\n\n${q.question}\n\n${optionsText}` }]);
      }
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
    if (mcFeedback || loading) return; // already answered this one
    const q = mcQuestions[currentQuestionIdx];
    const isCorrect = optionIdx === q.correct;
    const chosenLetter = String.fromCharCode(65 + optionIdx);
    const correctLetter = String.fromCharCode(65 + q.correct);
    setMcFeedback({ selected: optionIdx, correct: isCorrect });

    // Record answer
    const updatedAnswers = [...questionAnswers, `${chosenLetter}) ${q.options[optionIdx]} [${isCorrect ? "CORRECT" : "WRONG - correct: " + correctLetter + ") " + q.options[q.correct]}]`];
    setQuestionAnswers(updatedAnswers);

    // Show feedback in chat
    setMessages((prev) => [...prev, {
      id: Date.now().toString(), role: "user",
      content: `${chosenLetter}) ${q.options[optionIdx]}`
    }]);

    setTimeout(() => {
      if (!isCorrect) {
        // Wrong — generate note immediately
        const msg = `❌ That was **${correctLetter}) ${q.options[q.correct]}**. Generating your note now...`;
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: msg }]);
        handleSubmitAnswers(updatedAnswers);
      } else if (currentQuestionIdx < mcQuestions.length - 1) {
        // Correct, more questions available — let user decide
        setPendingAnswersForNote(updatedAnswers);
        setShowContinueChoice(true);
      } else {
        // Correct, no more questions — generate note
        setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: "✅ Correct! Generating your error note..." }]);
        handleSubmitAnswers(updatedAnswers);
      }
    }, 1200);
  };

  const handleSubmitAnswers = async (answersOverride?: string[]) => {
    const answers = answersOverride || questionAnswers;
    if (loading) return;
    setLoading(true);
    setWorkflowStep("generating");

    try {
      const generateResp = await fetch(`${CREWAI_URL}/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ extraction: extractedJson, questions: diagnosticQuestions, answers: answers, vault_path: vaultPath }) });
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
      setWorkflowStep("done");

      // Refresh tags & notes
      try {
        const [tagsResp, notesResp] = await Promise.all([
          fetch(`${CREWAI_URL}/tags`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vault_path: vaultPath }) }),
          fetch("/api/list-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vaultPath }) }),
        ]);
        if (tagsResp.ok) { const d = await tagsResp.json(); setVaultTags(d.tags || []); }
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
    setDiagnosticQuestions([]);
    setQuestionAnswers([]);
    setMcQuestions([]);
    setCurrentQuestionIdx(0);
    setMcFeedback(null);
    setErrorNoteResult(null);
    setShowContinueChoice(false);
    setPendingAnswersForNote([]);
  };

  // ── Editor: read note ──────────────────────────────────────────────────

  const openNote = async (note: Note) => {
    setSelectedNote(note);
    setLoadingNote(true);
    try {
      const resp = await fetch("/api/read-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultPath, notePath: note.path }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setNoteContent(data.content || "");
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

  const formatNote = async (customMsg?: string) => {
    if (!selectedNote || formatting) return;
    setFormatting(true);
    try {
      const resp = await fetch(`${CREWAI_URL}/format`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault_path: vaultPath,
          note_path: selectedNote.path,
          selected_template: selectedTemplate,
          custom_instructions: customMsg || formatInstructions,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success) {
          setNoteContent(data.formatted_content);
          setFormatInstructions("");
        } else {
          alert(`Format failed: ${data.error}`);
        }
      }
    } catch (error) {
      console.error("Format error:", error);
      alert("Failed to format note.");
    } finally {
      setFormatting(false);
    }
  };

  const handleFormatChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formatInstructions.trim() || !selectedNote) return;
    formatNote(formatInstructions);
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
          vaultPath,
          notePath: selectedNote.path,
          content: noteContent,
        }),
      });
      const data = await resp.json();
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

  // ── Anki Search ────────────────────────────────────────────────────────

  const handleAnkiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ankiQuery.trim() || ankiLoading) return;
    setAnkiLoading(true);
    setAnkiError("");
    setAnkiCards([]);
    setEditingCard(null);
    setExpandedTagCards(new Set());
    try {
      const resp = await fetch(`${CREWAI_URL}/anki/direct-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: ankiQuery }),
      });
      if (resp.status === 503) {
        setAnkiError("Anki is not running. Open Anki with the AnkiConnect plugin installed.");
        return;
      }
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) {
        setAnkiError(data.error);
      } else {
        const seen = new Set<number>();
        const unique = (data.cards || []).filter((c: AnkiCard) => {
          if (seen.has(c.note_id)) return false;
          seen.add(c.note_id);
          return true;
        });
        setAnkiCards(unique);
      }
    } catch (err) {
      setAnkiError("Failed to reach the backend. Is the server running?");
    } finally {
      setAnkiLoading(false);
    }
  };

  const handleSaveCard = async (card: AnkiCard) => {
    setAnkiSaving(true);
    setAnkiEditError("");
    try {
      const resp = await fetch(`${CREWAI_URL}/anki/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_id: card.note_id,
          front: editFront,
          back: editBack,
          field_names: card.field_names,
        }),
      });
      const data = await resp.json();
      if (data.success) {
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
      } else {
        setAnkiEditError(data.error || "Save failed.");
      }
    } catch {
      setAnkiEditError("Failed to reach backend.");
    } finally {
      setAnkiSaving(false);
    }
  };

  const handleFormatCard = async () => {
    setAnkiFormatting(true);
    setAnkiEditError("");
    try {
      const resp = await fetch(`${CREWAI_URL}/anki/format-card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: editFront,
          back: editBack,
          template_filename: selectedCardTemplate,
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
      setAnkiEditError("Failed to reach backend.");
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

  const handleSavePath = () => {
    if (tempPath.trim()) {
      setVaultPath(tempPath);
      setShowPathSettings(false);
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: `Vault path updated to: ${tempPath}` }]);
    }
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

  const addActivity = (item: Omit<ActivityItem, "savedAt">) => {
    setActivityHistory((prev) => {
      const next = [{ ...item, savedAt: Date.now() }, ...prev].slice(0, 50);
      try { localStorage.setItem("obsidianChatActivity", JSON.stringify(next)); } catch { }
      return next;
    });
  };

  // Simple markdown renderer for note viewer
  const renderMarkdown = (md: string) => {
    // Strip YAML frontmatter
    let body = md.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
    // Headers
    body = body.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    body = body.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    body = body.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // Bold & italic
    body = body.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    body = body.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Wiki links
    body = body.replace(/\[\[(.+?)\]\]/g, '<span class="wikilink">$1</span>');
    // Line breaks
    body = body.replace(/\n/g, '<br/>');
    return body;
  };

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
    <div className={styles.container}>
      {/* Left Sidebar */}
      <div className={styles.sidebar}>
        <h1>Obsidian Chat</h1>

        {/* View Toggle */}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === "chat" ? styles.viewToggleActive : ""}`}
            onClick={() => setViewMode("chat")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            Chat
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === "editor" ? styles.viewToggleActive : ""}`}
            onClick={() => setViewMode("editor")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            Editor
          </button>
          <button
            className={`${styles.viewToggleBtn} ${viewMode === "anki" ? styles.viewToggleActive : ""}`}
            onClick={() => setViewMode("anki")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            Anki
          </button>
        </div>

        {/* Vault Path */}
        <div className={styles.pathSection}>
          <button
            onClick={() => setShowPathSettings(!showPathSettings)}
            className={styles.settingsBtn}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
            {vaultPath.split("\\").pop() || "Select Folder"}
          </button>
          {showPathSettings && (
            <div className={styles.pathSettings}>
              <label className={styles.pathLabel}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                Vault Folder
              </label>
              <div className={styles.pathManualInput}>
                <input type="text" value={tempPath} onChange={(e) => setTempPath(e.target.value)} placeholder="C:\Users\...\VaultFolder" className={styles.pathInput} />
              </div>
              <div className={styles.pathButtonsGroup}>
                <button onClick={handleSavePath} className={styles.pathSaveBtn}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                  Save
                </button>
                <button onClick={() => { setTempPath(vaultPath); setShowPathSettings(false); }} className={styles.pathCancelBtn}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chat sidebar content */}
        {viewMode === "chat" && (
          <>
            <div className={styles.searchBox}>
              <input type="text" placeholder="Filter by tag..." value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} className={styles.tagInput} />
              <button onClick={handleReindex} disabled={loading} className={styles.reindexBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                Re-index
              </button>
              {vaultTags.length > 0 && (
                <div className={styles.vaultTagsSection}>
                  <div className={styles.vaultTagsLabel}>Tags ({vaultTags.length}):</div>
                  <div className={styles.vaultTagsList}>
                    {vaultTags.map((tag, i) => (
                      <button key={i} className={`${styles.vaultTagChip} ${tagFilter === tag ? styles.vaultTagActive : ""}`} onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}>{tag}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.extractorInfo}>
              <p className={styles.extractorDesc}>
                💬 Type to chat • 📸 Paste screenshots for error notes
              </p>
              {isInWorkflow && (
                <button onClick={resetWorkflow} className={styles.resetBtn}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: "inline", marginRight: "5px", verticalAlign: "middle" }}><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
                  Start Over
                </button>
              )}
            </div>
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
            <form onSubmit={handleAnkiSearch} className={styles.ankiSearchForm}>
              <input
                type="text"
                placeholder="e.g. 2513  →  tag::2513"
                value={ankiQuery}
                onChange={(e) => setAnkiQuery(e.target.value)}
                className={styles.noteSearchInput}
                disabled={ankiLoading}
              />
              <button
                type="submit"
                disabled={ankiLoading || !ankiQuery.trim()}
                className={styles.ankiSearchBtn}
              >
                {ankiLoading ? "..." : "Search"}
              </button>
            </form>
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
                <h2>Obsidian Chat</h2>
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

          {workflowStep === "answering" && mcQuestions.length > 0 && (
            showContinueChoice ? (
              <div className={styles.questionCards}>
                <div className={styles.questionCard}>
                  <div style={{ fontSize: "14px", color: "#dcddde", marginBottom: "16px" }}>
                    ✅ You got it right. Keep going with more questions or generate your note now?
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <button
                      style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #888", background: "#2a2a2a", color: "#dcddde", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}
                      onClick={() => {
                        setShowContinueChoice(false);
                        const nextIdx = currentQuestionIdx + 1;
                        setCurrentQuestionIdx(nextIdx);
                        setMcFeedback(null);
                        const nextQ = mcQuestions[nextIdx];
                        const optionsText = nextQ.options.map((o, i) => `  ${String.fromCharCode(65 + i)}) ${o}`).join("\n");
                        setMessages((prev) => [...prev, {
                          id: Date.now().toString(), role: "assistant",
                          content: `➡️ Next question *(${nextQ.difficulty})*:\n\n${nextQ.question}\n\n${optionsText}`
                        }]);
                      }}
                    >
                      Keep Going
                    </button>
                    <button
                      style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #22c55e", background: "rgba(34,197,94,0.15)", color: "#22c55e", cursor: "pointer", fontSize: "13px", fontFamily: "inherit" }}
                      onClick={() => {
                        setShowContinueChoice(false);
                        handleSubmitAnswers(pendingAnswersForNote);
                      }}
                    >
                      Generate Note
                    </button>
                  </div>
                </div>
              </div>
            ) : currentQuestionIdx < mcQuestions.length ? (
              <div className={styles.questionCards}>
                <div className={styles.questionCard}>
                  <label className={styles.questionLabel}>
                    <span className={styles.questionNumber}>{currentQuestionIdx + 1}</span>
                    <span>{mcQuestions[currentQuestionIdx].question}</span>
                  </label>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                    {mcQuestions[currentQuestionIdx].options.map((opt, i) => {
                      let btnStyle: React.CSSProperties = {
                        padding: "12px 16px", border: "1px solid #444", borderRadius: "10px",
                        background: "#2a2a2a", color: "#dcddde", cursor: "pointer", textAlign: "left" as const,
                        fontSize: "13px", fontFamily: "inherit", transition: "all 0.2s",
                        display: "flex", alignItems: "center", gap: "10px",
                      };
                      if (mcFeedback) {
                        if (i === mcQuestions[currentQuestionIdx].correct) {
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
                    {mcQuestions[currentQuestionIdx].difficulty} • Question {currentQuestionIdx + 1} of {mcQuestions.length}
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
                  <button className={styles.formatNoteBtn} onClick={() => formatNote()} disabled={formatting}>
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
                <div className={styles.editorSplitView}>
                  <textarea
                    className={styles.editorTextarea}
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    spellCheck={false}
                  />
                  <div className={styles.editorPreview} dangerouslySetInnerHTML={{ __html: renderMarkdown(noteContent) }} />
                </div>
              )}
              {/* Formatting overlay */}
              {formatting && (
                <div className={styles.formattingOverlay}>
                  <div className={styles.loadingInner}>
                    <div className={styles.spinner} />
                    <div className={styles.loadingText}>
                      <span className={styles.thinkingLabel}>Formatting<span className={styles.ellipsis} /></span>
                      <span className={styles.statusLine}>{statusMsg}</span>
                    </div>
                  </div>
                </div>
              )}
              {/* Format Chat Input */}
              <form onSubmit={handleFormatChat} className={styles.formatChatBar}>
                <input
                  type="text"
                  value={formatInstructions}
                  onChange={(e) => setFormatInstructions(e.target.value)}
                  placeholder={formatting ? "Formatting in progress..." : "Ask the formatter to make specific changes..."}
                  disabled={formatting}
                  className={styles.formatChatInput}
                />
                <button
                  type="submit"
                  disabled={formatting || !formatInstructions.trim()}
                  className={styles.formatChatSend}
                >
                  {formatting ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinIcon} aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg>
                  ) : "Send"}
                </button>
              </form>
            </>
          ) : (
            <div className={styles.editorEmpty}>
              <h2>Select a note</h2>
              <p>Choose a note from the sidebar to view it here</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Anki View ──────────────────────────────────────────────── */
        <div className={styles.ankiContainer}>
          {ankiLoading && (
            <div className={styles.ankiCenterMsg}>
              <div className={styles.spinner} />
              <span>Searching Anki collection...</span>
            </div>
          )}
          {!ankiLoading && ankiError && (
            <div className={styles.ankiErrorBanner}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              {ankiError}
            </div>
          )}
          {!ankiLoading && !ankiError && ankiCards.length === 0 && (
            <div className={styles.ankiCreatePanel}>
              <h2 className={styles.ankiCreateTitle}>Create Anki Card</h2>
              <p className={styles.ankiCreateSubtitle}>Select an Obsidian note and template to generate a new card.</p>

              <div className={styles.ankiCreateForm}>
                {/* Note selector combobox */}
                <div className={styles.ankiCreateField}>
                  <label className={styles.ankiCreateLabel}>Source Note</label>

                  {/* Tag filter chips — always visible in the main panel */}
                  {allNotesTags.length > 0 && (
                    <div className={styles.comboboxTagRow}>
                      {allNotesTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          className={`${styles.comboboxTagChip} ${ankiCreateTagFilter === tag ? styles.comboboxTagChipActive : ""}`}
                          onClick={() => setAnkiCreateTagFilter((f) => f === tag ? "" : tag)}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={styles.comboboxWrap} ref={comboboxRef}>
                    <button
                      type="button"
                      className={styles.comboboxToggle}
                      onClick={() => setAnkiCreateDropdownOpen((o) => !o)}
                    >
                      <span className={styles.comboboxToggleText}>
                        {ankiCreateNote
                          ? (allNotes.find((n) => n.path === ankiCreateNote)?.title || ankiCreateNote)
                          : "Select a note..."}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, transform: ankiCreateDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}><polyline points="6 9 12 15 18 9" /></svg>
                    </button>

                    {ankiCreateDropdownOpen && (
                      <div className={styles.comboboxDropdown}>
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search notes..."
                          value={ankiCreateNoteSearch}
                          onChange={(e) => setAnkiCreateNoteSearch(e.target.value)}
                          className={styles.comboboxSearch}
                        />
                        <div className={styles.comboboxList}>
                          {filteredCreateNotes.length === 0 ? (
                            <div className={styles.comboboxEmpty}>No notes found</div>
                          ) : (
                            filteredCreateNotes.map((note, i) => (
                              <button
                                key={i}
                                type="button"
                                className={`${styles.comboboxOption} ${ankiCreateNote === note.path ? styles.comboboxOptionActive : ""}`}
                                onClick={() => {
                                  setAnkiCreateNote(note.path);
                                  setAnkiCreateDropdownOpen(false);
                                  setAnkiCreateNoteSearch("");
                                }}
                              >
                                <span className={styles.comboboxOptionTitle}>{note.title}</span>
                                {note.tags && note.tags.length > 0 && (
                                  <span className={styles.comboboxOptionTags}>{note.tags.slice(0, 3).join(", ")}</span>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Template selector */}
                <div className={styles.ankiCreateField}>
                  <label className={styles.ankiCreateLabel}>Card Template</label>
                  <select
                    className={styles.ankiCreateTemplateSelect}
                    value={selectedCardTemplate}
                    onChange={(e) => setSelectedCardTemplate(e.target.value)}
                  >
                    {ankiCardTemplates.map((t) => (
                      <option key={t.filename} value={t.filename}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <button
                  className={styles.ankiGenerateBtn}
                  onClick={handleCreateCard}
                  disabled={ankiCreating || !ankiCreateNote}
                >
                  {ankiCreating ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinIcon} aria-hidden="true"><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg>
                      Generating...
                    </>
                  ) : "Generate Card"}
                </button>
              </div>

              {ankiCreateError && (
                <div className={styles.ankiEditError} style={{ marginTop: "12px" }}>{ankiCreateError}</div>
              )}
              {ankiCreateSuccess && (
                <div className={styles.ankiCreateSuccessMsg}>{ankiCreateSuccess}</div>
              )}

              {/* Generated preview */}
              {(ankiCreateFront || ankiCreateBack) && (
                <div className={styles.ankiCreatePreview}>
                  <div className={styles.ankiCreatePreviewDivider} />
                  <div className={styles.ankiCreatePreviewTitle}>Generated Card Preview</div>

                  <label className={styles.ankiEditLabel}>Front</label>
                  <div
                    ref={ankiCreateFrontRef}
                    className={styles.ankiEditRichText}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => setAnkiCreateFront(e.currentTarget.innerHTML)}
                    spellCheck={false}
                    style={{ minHeight: "70px" }}
                  />

                  <label className={styles.ankiEditLabel} style={{ marginTop: "10px" }}>Back</label>
                  <div
                    ref={ankiCreateBackRef}
                    className={styles.ankiEditRichText}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => setAnkiCreateBack(e.currentTarget.innerHTML)}
                    spellCheck={false}
                    style={{ minHeight: "100px" }}
                  />

                  <div className={styles.ankiCreateSaveRow}>
                    <div className={styles.ankiCreateField} style={{ marginBottom: 0, flex: 1 }}>
                      <label className={styles.ankiCreateLabel}>Deck</label>
                      {ankiDecks.length > 0 ? (
                        <select
                          className={styles.ankiCreateTemplateSelect}
                          value={ankiCreateDeck}
                          onChange={(e) => setAnkiCreateDeck(e.target.value)}
                        >
                          {ankiDecks.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className={styles.ankiCreateSearch}
                          value={ankiCreateDeck}
                          onChange={(e) => setAnkiCreateDeck(e.target.value)}
                          placeholder="Deck name (e.g. Default)"
                        />
                      )}
                    </div>
                    <button
                      className={styles.ankiSaveBtn}
                      onClick={handleAddNote}
                      disabled={ankiAddingNote || !ankiCreateFront}
                      style={{ alignSelf: "flex-end" }}
                    >
                      {ankiAddingNote ? "Saving…" : "Save to Anki"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!ankiLoading && ankiCards.length > 0 && (
            <div className={styles.ankiCardList}>
              {ankiCards.map((card) => {
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
                            <span dangerouslySetInnerHTML={{ __html: card.front }} />
                          ) : (
                            <span className={styles.ankiCardFrontFallback}>{card.deck}</span>
                          )}
                        </div>
                        <div className={styles.ankiCardHeaderActions}>
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
                        <div className={styles.ankiDeckBadge} style={{ marginBottom: "8px" }}>{card.deck}</div>
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

                    {/* Tags at bottom with collapse toggle */}
                    {displayTags.length > 0 && (
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
              })}
            </div>
          )}
        </div>
      )}

      {/* Right Sidebar */}
      <div className={styles.sourcesPanel}>
        <h3>{isInWorkflow ? "Workflow" : viewMode === "editor" ? "Note Info" : viewMode === "anki" ? "Anki" : "Notes"}</h3>

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

        {!isInWorkflow && viewMode === "chat" && (
          <>
            {sources.length > 0 ? (
              <div>
                <div className={styles.sourcesHeading}>Search Results:</div>
                <div className={styles.sourcesList}>
                  {sources.map((source, idx) => (
                    <div key={idx} className={styles.sourceItem}>
                      <div className={styles.sourceTitle}>{source.title}</div>
                      <div className={styles.sourcePath}>{source.path}</div>
                      <div className={styles.sourceSnippet}>{source.snippet}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className={styles.sourcesHeading}>All Notes ({allNotes.length}):</div>
                <div className={styles.sourcesList}>
                  {allNotes.map((note, idx) => (
                    <div key={idx} className={styles.sourceItem}>
                      <div className={styles.sourceTitle}>{note.title}</div>
                      <div className={styles.sourcePath}>{note.path}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {viewMode === "editor" && selectedNote && noteContent && (
          <div>
            <div className={styles.sourcesHeading}>Tags:</div>
            <div className={styles.resultTagList}>
              {getNoteTags(noteContent).map((tag, i) => (
                <span key={i} className={styles.resultTag}>{tag}</span>
              ))}
            </div>
          </div>
        )}

        {viewMode === "anki" && (
          <div>
            <div className={styles.sourcesHeading}>Query syntax:</div>
            <div className={styles.ankiSyntaxPanel}>
              <div className={styles.ankiSyntaxRow}><code>2513</code><span>→ tag::2513</span></div>
              <div className={styles.ankiSyntaxRow}><code>uworld</code><span>→ tag::uworld</span></div>
              <div className={styles.ankiSyntaxRow}><code>deck:USMLE</code><span>by deck</span></div>
              <div className={styles.ankiSyntaxRow}><code>is:due</code><span>due cards</span></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
