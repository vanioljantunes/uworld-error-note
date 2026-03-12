"use client";

import { useState, useCallback } from "react";
import styles from "../app/page.module.css";

export interface Template {
  id: string;
  slug: string;
  category: string;
  title: string;
  content: string;
  updated_at: string;
}

interface Props {
  templates: Template[];
  onUpdate: (slug: string, content: string) => Promise<void>;
  onReset: (slug: string) => Promise<void>;
}

// ── Section parsing utilities ──────────────────────────────────────────────

interface TemplateSection {
  name: string;
  content: string;
}

const SECTION_RE = /<!--\s*section:\s*(.+?)\s*-->/gi;

function parseSections(content: string): TemplateSection[] | null {
  const markers = [...content.matchAll(SECTION_RE)];
  if (markers.length === 0) return null; // not a sectioned template
  const sections: TemplateSection[] = [];
  for (let i = 0; i < markers.length; i++) {
    const name = markers[i][1];
    const start = markers[i].index! + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index! : content.length;
    sections.push({ name, content: content.substring(start, end).trim() });
  }
  return sections;
}

function joinSections(sections: TemplateSection[]): string {
  return sections
    .map((s) => `<!-- section: ${s.name} -->\n${s.content}`)
    .join("\n\n");
}

// ── Component ──────────────────────────────────────────────────────────────

export default function TemplatesView({ templates, onUpdate, onReset }: Props) {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSections, setEditSections] = useState<TemplateSection[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const errorNoteTemplates = templates.filter((t) => t.category === "error_note");
  const ankiTemplates = templates.filter((t) => t.category === "anki");

  const openEditor = (t: Template) => {
    setEditingSlug(t.slug);
    const sections = parseSections(t.content);
    if (sections) {
      setEditSections(sections);
      setEditContent(t.content);
    } else {
      setEditSections(null);
      setEditContent(t.content);
    }
  };

  const updateSection = useCallback((idx: number, value: string) => {
    setEditSections((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], content: value };
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!editingSlug) return;
    setSaving(true);
    try {
      const content = editSections ? joinSections(editSections) : editContent;
      await onUpdate(editingSlug, content);
      setEditContent(content);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!editingSlug) return;
    setResetting(true);
    try {
      await onReset(editingSlug);
      setEditingSlug(null);
    } finally {
      setResetting(false);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  // ── Editor View ──
  if (editingSlug) {
    const tpl = templates.find((t) => t.slug === editingSlug);
    if (!tpl) return null;

    return (
      <div className={styles.tplEditorWrap}>
        <div className={styles.tplEditorHeader}>
          <button
            className={styles.tplBackBtn}
            onClick={() => setEditingSlug(null)}
          >
            &larr; Back
          </button>
          <span className={styles.tplEditorTitle}>{tpl.title}</span>
          <div className={styles.tplEditorActions}>
            <button
              className={styles.tplResetBtn}
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? "Resetting\u2026" : "Reset to Default"}
            </button>
            <button
              className={styles.tplSaveBtn}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving\u2026" : "Save"}
            </button>
          </div>
        </div>

        {editSections ? (
          <div className={styles.tplSectionsWrap}>
            {editSections.map((sec, i) => (
              <div key={sec.name} className={styles.tplSectionBlock}>
                <div className={styles.tplSectionLabel}>{sec.name}</div>
                <textarea
                  className={styles.tplSectionEditor}
                  value={sec.content}
                  onChange={(e) => updateSection(i, e.target.value)}
                  spellCheck={false}
                  rows={Math.max(4, sec.content.split("\n").length + 1)}
                />
              </div>
            ))}
          </div>
        ) : (
          <textarea
            className={styles.tplEditor}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            spellCheck={false}
          />
        )}

        <div className={styles.tplEditorFooter}>
          Last edited: {formatDate(tpl.updated_at)}
        </div>
      </div>
    );
  }

  // ── Grid View ──
  const renderCard = (t: Template) => (
    <button
      key={t.slug}
      className={styles.tplCard}
      onClick={() => openEditor(t)}
    >
      <div className={styles.tplCardTitle}>{t.title}</div>
      <div className={styles.tplCardPreview}>
        {t.content.replace(/<!--\s*section:.*?-->/gi, "").slice(0, 80).replace(/\n/g, " ")}&hellip;
      </div>
      <div className={styles.tplCardMeta}>
        Edited {formatDate(t.updated_at)}
      </div>
    </button>
  );

  return (
    <div className={styles.tplContainer}>
      <section className={styles.tplSection}>
        <h2 className={styles.tplSectionTitle}>Error Note Templates</h2>
        <div className={styles.tplGrid}>
          {errorNoteTemplates.map(renderCard)}
        </div>
      </section>

      <section className={styles.tplSection}>
        <h2 className={styles.tplSectionTitle}>Anki Card Templates</h2>
        <div className={styles.tplGrid}>
          {ankiTemplates.map(renderCard)}
        </div>
      </section>
    </div>
  );
}
