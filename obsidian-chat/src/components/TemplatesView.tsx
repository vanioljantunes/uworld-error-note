"use client";

import { useState } from "react";
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

export default function TemplatesView({ templates, onUpdate, onReset }: Props) {
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const errorNoteTemplates = templates.filter((t) => t.category === "error_note");
  const ankiTemplates = templates.filter((t) => t.category === "anki");

  const openEditor = (t: Template) => {
    setEditingSlug(t.slug);
    setEditContent(t.content);
  };

  const handleSave = async () => {
    if (!editingSlug) return;
    setSaving(true);
    try {
      await onUpdate(editingSlug, editContent);
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
        <textarea
          className={styles.tplEditor}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          spellCheck={false}
        />
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
        {t.content.slice(0, 80).replace(/\n/g, " ")}&hellip;
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
