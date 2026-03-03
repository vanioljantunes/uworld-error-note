"use client";

import { useState, useRef, useEffect } from "react";
import styles from "../app/page.module.css";

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

// ── Props ─────────────────────────────────────────────────────────────────

interface FlowViewProps {
  savedExtractions: SavedExtraction[];
  userTemplates: Template[];
  vaultPath: string;
  onNewExtraction: (ext: SavedExtraction) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function FlowView({ savedExtractions, userTemplates, vaultPath, onNewExtraction }: FlowViewProps) {
  // ID selection
  const [activeExtraction, setActiveExtraction] = useState<SavedExtraction | null>(null);
  const [shortTitle, setShortTitle] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Upload
  const uploadRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);

  // Collapsible sections (all collapsed by default)
  const [showQuestion, setShowQuestion] = useState(false);
  const [showChosenAlt, setShowChosenAlt] = useState(false);
  const [showCorrectAlt, setShowCorrectAlt] = useState(false);
  const [showEduObj, setShowEduObj] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [showPriorQuestions, setShowPriorQuestions] = useState(false);

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
    const eduObj = activeExtraction.extraction?.educational_objective;
    if (!eduObj) { setShortTitle(activeExtraction.title); return; }

    (async () => {
      try {
        const resp = await fetch("/api/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: eduObj }),
        });
        if (resp.ok) {
          const data = await resp.json();
          setShortTitle(data.title || activeExtraction.title);
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
        const cardIds = (await ankiConnect("findCards", { query: `tag:${qId}` })) as number[];
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

  // Find matching notes
  useEffect(() => {
    if (!activeExtraction) { setNoteContent(""); setNotePath(""); setNoteResult(null); setMatchingNotes([]); return; }
    const qId = activeExtraction.questionId || activeExtraction.extraction?.question_id;
    if (!qId) { setMatchingNotes([]); return; }

    (async () => {
      try {
        const resp = await fetch("/api/list-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vaultPath }),
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const notes = data.notes || [];
        const matches = notes.filter((n: any) => (n.tags || []).includes(qId));
        setMatchingNotes(matches.map((n: any) => ({ title: n.title, path: n.path })));
        if (matches.length > 0) loadNote(matches[0].path);
      } catch { /* ignore */ }
    })();
  }, [activeExtraction, vaultPath]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const selectExtraction = (ext: SavedExtraction) => {
    setActiveExtraction(ext);
    setDropdownOpen(false);
    setNoteResult(null);
    setNoteContent("");
    setNotePath("");
    setSaveMsg("");
    setMakeCardMsg("");
    setMatchingNotes([]);
    setCurrentQuestion(null);
    setQuestionCount(0);
    setPreviousQuestions([]);
    setDiagnosticQuestions([]);
    setQuestionAnswers([]);
    setMcFeedback(null);
    setShowQuestion(false);
    setShowChosenAlt(false);
    setShowCorrectAlt(false);
    setShowEduObj(false);
    setShowExplanation(false);
    setShowPriorQuestions(false);
  };

  const loadNote = async (path: string) => {
    try {
      const readResp = await fetch("/api/read-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultPath, notePath: path }),
      });
      if (readResp.ok) {
        const readData = await readResp.json();
        setNoteContent(readData.content || "");
        setNotePath(path);
      }
    } catch { /* ignore */ }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setExtracting(true);
    try {
      const images: string[] = [];
      for (const file of imageFiles) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        images.push(base64);
      }
      const resp = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      if (!resp.ok) throw new Error("Extraction failed");
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
    } catch { /* ignore */ }
    finally {
      setExtracting(false);
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

  const handleGenerateNote = async () => {
    if (!activeExtraction || generating) return;
    setGenerating(true);
    setSaveMsg("");
    setMakeCardMsg("");
    try {
      const template = userTemplates.find((t) => t.slug === "error_note_a")?.content || "";
      const questionsPayload = diagnosticQuestions.map((q) => ({
        question: q.question,
        options: q.options,
        correct: q.correct,
        difficulty: q.difficulty,
      }));
      const answersPayload = questionAnswers.map((idx, i) =>
        diagnosticQuestions[i] ? diagnosticQuestions[i].options[idx] : ""
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
        await fetch("/api/save-note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vaultPath, notePath: note.file_path, content: note.note_content }),
        });
      }
    } catch { /* ignore */ }
    finally { setGenerating(false); }
  };

  const handleSaveNote = async () => {
    if (!notePath || savingNote) return;
    setSavingNote(true);
    setSaveMsg("");
    try {
      const resp = await fetch("/api/save-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultPath, notePath, content: noteContent }),
      });
      if (resp.ok) setSaveMsg("Saved");
      else setSaveMsg("Save failed");
    } catch { setSaveMsg("Save failed"); }
    finally {
      setSavingNote(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
  };

  const handleMakeCard = async () => {
    if (!noteContent || makingCard) return;
    setMakingCard(true);
    setMakeCardMsg("");
    try {
      const tpl = userTemplates.find((t) => t.category === "anki")?.content || "";
      const resp = await fetch("/api/create-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_content: noteContent, template: tpl }),
      });
      const data = await resp.json();
      if (data.success && data.front) {
        await ankiConnect("addNote", {
          note: {
            deckName: "Default",
            modelName: "Cloze",
            fields: { Text: data.front, Extra: data.back || "" },
            tags: activeExtraction?.questionId ? [activeExtraction.questionId] : [],
            options: { allowDuplicate: false },
          },
        });
        setMakeCardMsg("Card added!");
        setActiveExtraction((prev) => prev ? { ...prev } : null);
      } else {
        setMakeCardMsg(data.error || "Failed");
      }
    } catch (err: any) {
      setMakeCardMsg(err?.message || "Failed to create card.");
    } finally {
      setMakingCard(false);
      setTimeout(() => setMakeCardMsg(""), 4000);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const ext = activeExtraction?.extraction;
  const qId = activeExtraction?.questionId || ext?.question_id || null;
  const hasAnswered = questionAnswers.length > 0;
  const displayTitle = shortTitle || activeExtraction?.title || "";

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={styles.flowContainer}>
      {/* ID Bar */}
      <div className={styles.flowIdBar}>
        <div className={styles.flowIdDropdown} ref={dropdownRef}>
          <button className={styles.flowIdBtn} onClick={() => setDropdownOpen(!dropdownOpen)}>
            ▼ Choose from extractions
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
        <button className={styles.flowIdBtn} onClick={() => uploadRef.current?.click()} disabled={extracting}>
          {extracting ? "Extracting…" : "Upload Screenshot"}
        </button>
        <input ref={uploadRef} type="file" accept="image/*" multiple className={styles.flowUploadInput} onChange={(e) => handleUpload(e.target.files)} />
      </div>

      {/* Active ID */}
      <div className={styles.flowActiveId}>
        {activeExtraction ? (
          <div className={styles.flowActiveIdLabel}>
            {qId || "Unknown ID"} — {displayTitle}
          </div>
        ) : (
          <div className={styles.flowActiveIdLabel} style={{ color: "var(--text-subtle)" }}>
            No extraction selected
          </div>
        )}
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
                    <button className={styles.flowGenerateBtn} onClick={dismissFeedback} style={{ flex: 1, marginTop: 0 }}>
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

                {hasAnswered && !noteResult && (
                  <button
                    className={styles.flowGenerateBtn}
                    onClick={handleGenerateNote}
                    disabled={generating}
                    style={{ marginTop: 0, marginBottom: 12, background: "var(--bg-elevated)", border: "1px solid var(--accent)" }}
                  >
                    {generating ? "Generating Note…" : "Generate Note"}
                  </button>
                )}

                {noteResult && (
                  <div className={styles.flowExtField}>
                    <div className={styles.flowExtFieldLabel}>Generated Note</div>
                    <div className={styles.flowExtFieldValue}>{noteResult.error_pattern}</div>
                    <div style={{ marginTop: 6 }}>
                      {noteResult.tags.map((t) => (
                        <span key={t} className={styles.flowResultTag}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prior questions — collapsible */}
                {diagnosticQuestions.length > 0 && (
                  <>
                    <button className={styles.flowSectionToggle} onClick={() => setShowPriorQuestions(!showPriorQuestions)}>
                      <span className={`${styles.flowSectionArrow} ${showPriorQuestions ? styles.flowSectionArrowOpen : ""}`}>▶</span>
                      Prior Questions ({diagnosticQuestions.length})
                    </button>
                    {showPriorQuestions && (
                      <div className={styles.flowSectionContent}>
                        {diagnosticQuestions.map((dq, i) => {
                          const answerIdx = questionAnswers[i];
                          const wasCorrect = answerIdx === dq.correct;
                          return (
                            <div key={i} className={styles.flowPriorQuestion}>
                              <div className={`${styles.flowPriorQuestionDiff} ${wasCorrect ? styles.flowPriorCorrect : styles.flowPriorWrong}`}>
                                {dq.difficulty} · {wasCorrect ? "Correct" : "Wrong"}
                              </div>
                              <div>{dq.question.slice(0, 100)}{dq.question.length > 100 ? "…" : ""}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Individual field toggles */}
                {ext?.question && (
                  <>
                    <button className={styles.flowSectionToggle} onClick={() => setShowQuestion(!showQuestion)}>
                      <span className={`${styles.flowSectionArrow} ${showQuestion ? styles.flowSectionArrowOpen : ""}`}>▶</span>
                      Question
                    </button>
                    {showQuestion && (
                      <div className={styles.flowExtField}>
                        <div className={styles.flowExtFieldValue}>{ext.question}</div>
                      </div>
                    )}
                  </>
                )}

                {ext?.choosed_alternative && (
                  <>
                    <button className={styles.flowSectionToggle} onClick={() => setShowChosenAlt(!showChosenAlt)}>
                      <span className={`${styles.flowSectionArrow} ${showChosenAlt ? styles.flowSectionArrowOpen : ""}`}>▶</span>
                      Chosen Alternative
                    </button>
                    {showChosenAlt && (
                      <div className={styles.flowExtField}>
                        <div className={styles.flowExtFieldValue}>{ext.choosed_alternative}</div>
                      </div>
                    )}
                  </>
                )}

                {ext?.wrong_alternative && (
                  <>
                    <button className={styles.flowSectionToggle} onClick={() => setShowCorrectAlt(!showCorrectAlt)}>
                      <span className={`${styles.flowSectionArrow} ${showCorrectAlt ? styles.flowSectionArrowOpen : ""}`}>▶</span>
                      Correct Alternative
                    </button>
                    {showCorrectAlt && (
                      <div className={styles.flowExtField}>
                        <div className={styles.flowExtFieldValue}>{ext.wrong_alternative}</div>
                      </div>
                    )}
                  </>
                )}

                {ext?.educational_objective && (
                  <>
                    <button className={styles.flowSectionToggle} onClick={() => setShowEduObj(!showEduObj)}>
                      <span className={`${styles.flowSectionArrow} ${showEduObj ? styles.flowSectionArrowOpen : ""}`}>▶</span>
                      Educational Objective
                    </button>
                    {showEduObj && (
                      <div className={styles.flowExtField}>
                        <div className={styles.flowExtFieldValue}>{ext.educational_objective}</div>
                      </div>
                    )}
                  </>
                )}

                {ext?.full_explanation && (
                  <>
                    <button className={styles.flowSectionToggle} onClick={() => setShowExplanation(!showExplanation)}>
                      <span className={`${styles.flowSectionArrow} ${showExplanation ? styles.flowSectionArrowOpen : ""}`}>▶</span>
                      Explanation
                    </button>
                    {showExplanation && (
                      <div className={styles.flowExtField}>
                        <div className={styles.flowExtFieldValue}>{ext.full_explanation}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Note Editor Panel ── */}
        <div
          className={`${styles.flowPanel} ${focusedPanel === "editor" ? styles.flowPanelFocused : focusedPanel ? styles.flowPanelShrunk : ""}`}
          onClick={() => setFocusedPanel(focusedPanel === "editor" ? null : "editor")}
        >
          <div className={styles.flowPanelHeader}>Note Editor</div>
          {matchingNotes.length > 0 && (
            <div className={styles.flowNotesList}>
              {matchingNotes.map((n) => (
                <button
                  key={n.path}
                  className={`${styles.flowNotesItem} ${n.path === notePath ? styles.flowNotesItemActive : ""}`}
                  onClick={() => loadNote(n.path)}
                >
                  {n.title}
                </button>
              ))}
            </div>
          )}
          {noteContent ? (
            <>
              <div className={styles.flowPanelBody}>
                <textarea
                  className={styles.flowNoteEditor}
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  spellCheck={false}
                />
              </div>
              <div className={styles.flowNoteSaveRow}>
                {saveMsg && <span className={styles.flowNoteSaveMsg}>{saveMsg}</span>}
                <button
                  className={styles.flowNoteSaveBtn}
                  onClick={(e) => { e.stopPropagation(); handleSaveNote(); }}
                  disabled={savingNote}
                >
                  {savingNote ? "Saving…" : "Save"}
                </button>
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
                  onClick={(e) => { e.stopPropagation(); handleMakeCard(); }}
                  disabled={makingCard || !noteContent}
                >
                  {makingCard ? "Creating…" : "+ Make Card"}
                </button>
                {makeCardMsg && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, textAlign: "center" }}>
                    {makeCardMsg}
                  </div>
                )}

                {ankiLoading ? (
                  <div className={styles.flowEmpty}>Searching Anki…</div>
                ) : ankiError ? (
                  <div className={styles.flowEmpty}>{ankiError}</div>
                ) : ankiCards.length === 0 ? (
                  <div className={styles.flowEmpty}>No cards found for {qId}</div>
                ) : (
                  ankiCards.map((card) => (
                    <div key={card.card_id} className={styles.flowAnkiCard}>
                      <div
                        className={styles.flowAnkiCardFront}
                        dangerouslySetInnerHTML={{ __html: stripHtml(card.front).slice(0, 120) + (card.front.length > 120 ? "…" : "") }}
                      />
                      <div className={styles.flowAnkiCardMeta}>
                        {card.deck} · {card.tags.join(", ")}
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
