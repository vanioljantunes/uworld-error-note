"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import styles from "@/app/page.module.css";

interface QuestionEditorProps {
  value: string;
  onChange: (val: string) => void;
}

interface ParsedQuestion {
  stem: string;
  answer: string;
  clues: string[];
  mechanism: string;
  differentials: string[];
}

function parseQuestion(value: string): ParsedQuestion {
  // Strip HTML tags for parsing, keep <br> as newlines
  const text = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<b>(.*?)<\/b>/gi, "$1")
    .replace(/<[^>]*>/g, "")
    .trim();

  let stem = text;
  let answer = "";
  let clues: string[] = [];
  let mechanism = "";
  let differentials: string[] = [];

  // Try to split on known markers
  const answerMatch = text.match(/Answer:\s*(.*?)(?=\n|Key clues:|$)/is);
  if (answerMatch) {
    stem = text.substring(0, text.indexOf("Answer:")).trim();
    answer = answerMatch[1].trim();
  }

  const cluesMatch = text.match(/Key clues:\s*([\s\S]*?)(?=Mechanism:|Differentials|$)/i);
  if (cluesMatch) {
    clues = cluesMatch[1]
      .split(/\n/)
      .map((l) => l.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);
  }

  const mechMatch = text.match(/Mechanism:\s*(.*?)(?=\n|Differentials|$)/is);
  if (mechMatch) {
    mechanism = mechMatch[1].trim();
  }

  const diffMatch = text.match(/Differentials to exclude:\s*([\s\S]*?)$/i);
  if (diffMatch) {
    differentials = diffMatch[1]
      .split(/\n/)
      .map((l) => l.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);
  }

  // If no markers found, treat entire text as stem
  if (!answerMatch && !cluesMatch) {
    return { stem: text, answer: "", clues: [""], mechanism: "", differentials: [""] };
  }

  // Ensure at least one empty entry for clues/diffs so inputs show
  if (clues.length === 0) clues = [""];
  if (differentials.length === 0) differentials = [""];

  return { stem, answer, clues, mechanism, differentials };
}

function rebuildQuestion(q: ParsedQuestion): string {
  const parts: string[] = [];

  if (q.stem) parts.push(q.stem);

  parts.push("");
  parts.push(`<b>Answer:</b> ${q.answer}`);

  if (q.clues.some((c) => c.trim())) {
    parts.push("");
    parts.push("<b>Key clues:</b>");
    for (const c of q.clues) {
      if (c.trim()) parts.push(`- ${c}`);
    }
  }

  if (q.mechanism.trim()) {
    parts.push("");
    parts.push(`<b>Mechanism:</b> ${q.mechanism}`);
  }

  if (q.differentials.some((d) => d.trim())) {
    parts.push("");
    parts.push("<b>Differentials to exclude:</b>");
    for (const d of q.differentials) {
      if (d.trim()) parts.push(`- ${d}`);
    }
  }

  return parts.join("<br>");
}

export default function QuestionEditor({ value, onChange }: QuestionEditorProps) {
  const [q, setQ] = useState<ParsedQuestion>(() => parseQuestion(value));
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      setQ(parseQuestion(value));
    }
  }, [value]);

  const emit = useCallback(
    (updated: ParsedQuestion) => {
      setQ(updated);
      const rebuilt = rebuildQuestion(updated);
      prevValueRef.current = rebuilt;
      onChange(rebuilt);
    },
    [onChange]
  );

  const updateStem = (v: string) => emit({ ...q, stem: v });
  const updateAnswer = (v: string) => emit({ ...q, answer: v });
  const updateMechanism = (v: string) => emit({ ...q, mechanism: v });

  const updateClue = (idx: number, v: string) => {
    const clues = [...q.clues];
    clues[idx] = v;
    emit({ ...q, clues });
  };
  const addClue = () => emit({ ...q, clues: [...q.clues, ""] });
  const removeClue = (idx: number) => {
    if (q.clues.length <= 1) return;
    emit({ ...q, clues: q.clues.filter((_, i) => i !== idx) });
  };

  const updateDiff = (idx: number, v: string) => {
    const differentials = [...q.differentials];
    differentials[idx] = v;
    emit({ ...q, differentials });
  };
  const addDiff = () => emit({ ...q, differentials: [...q.differentials, ""] });
  const removeDiff = (idx: number) => {
    if (q.differentials.length <= 1) return;
    emit({ ...q, differentials: q.differentials.filter((_, i) => i !== idx) });
  };

  return (
    <div className={styles.questionEditor}>
      <div className={styles.questionSection}>
        <label className={styles.questionLabel}>Question Stem</label>
        <textarea
          className={styles.questionStemInput}
          value={q.stem}
          onChange={(e) => updateStem(e.target.value)}
          rows={3}
          spellCheck={false}
        />
      </div>

      <div className={styles.questionSection}>
        <label className={styles.questionLabel}>Answer</label>
        <input
          className={styles.questionFieldInput}
          value={q.answer}
          onChange={(e) => updateAnswer(e.target.value)}
          spellCheck={false}
        />
      </div>

      <div className={styles.questionSection}>
        <label className={styles.questionLabel}>Key Clues</label>
        {q.clues.map((clue, i) => (
          <div key={i} className={styles.questionItemRow}>
            <input
              className={styles.questionFieldInput}
              value={clue}
              onChange={(e) => updateClue(i, e.target.value)}
              placeholder="Clue → why it matters"
              spellCheck={false}
            />
            {q.clues.length > 1 && (
              <button className={styles.questionRemoveBtn} onClick={() => removeClue(i)} type="button">
                ×
              </button>
            )}
          </div>
        ))}
        <button className={styles.questionAddBtn} onClick={addClue} type="button">
          + Add clue
        </button>
      </div>

      <div className={styles.questionSection}>
        <label className={styles.questionLabel}>Mechanism</label>
        <input
          className={styles.questionFieldInput}
          value={q.mechanism}
          onChange={(e) => updateMechanism(e.target.value)}
          placeholder="1-2 sentences"
          spellCheck={false}
        />
      </div>

      <div className={styles.questionSection}>
        <label className={styles.questionLabel}>Differentials to Exclude</label>
        {q.differentials.map((diff, i) => (
          <div key={i} className={styles.questionItemRow}>
            <input
              className={styles.questionFieldInput}
              value={diff}
              onChange={(e) => updateDiff(i, e.target.value)}
              placeholder="Distractor: distinguishing feature"
              spellCheck={false}
            />
            {q.differentials.length > 1 && (
              <button className={styles.questionRemoveBtn} onClick={() => removeDiff(i)} type="button">
                ×
              </button>
            )}
          </div>
        ))}
        <button className={styles.questionAddBtn} onClick={addDiff} type="button">
          + Add differential
        </button>
      </div>
    </div>
  );
}
