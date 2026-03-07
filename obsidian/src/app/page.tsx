"use client";

import { useState, useRef, useEffect } from "react";
import styles from "./page.module.css";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Source {
  title: string;
  path: string;
  snippet: string;
}

interface Note {
  title: string;
  path: string;
}

interface ChatResponse {
  answer: string;
  sources: Source[];
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState("");
  const [vaultPath, setVaultPath] = useState(
    "C:\\Users\\vanio\\OneDrive\\Área de Trabalho\\teste_crew\\teste"
  );
  const [showPathSettings, setShowPathSettings] = useState(false);
  const [tempPath, setTempPath] = useState(vaultPath);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load all notes from the vault when vault path changes
  useEffect(() => {
    const loadVaultData = async () => {
      try {
        const [notesResponse, tagsResponse] = await Promise.all([
          fetch("/api/list-notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vaultPath }),
          }),
          fetch("/api/list-tags", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vaultPath }),
          }),
        ]);

        if (notesResponse.ok) {
          const notesData = await notesResponse.json();
          setAllNotes(notesData.notes || []);
        }

        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json();
          setAvailableTags(tagsData.tags || []);
        } else {
          setAvailableTags([]);
        }
      } catch (error) {
        console.error("Failed to load vault data:", error);
        setAvailableTags([]);
      }
    };

    loadVaultData();
  }, [vaultPath]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          tag: tagFilter || undefined,
          vaultPath: vaultPath,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data: ChatResponse = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSources(data.sources);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Error: Failed to get response. Please check your OpenAI API key and vault path.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleReindex = async () => {
    setLoading(true);
    try {
      await fetch("/api/reindex", { method: "POST" });
      const statusMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Re-index complete. Ready to search again.",
      };
      setMessages((prev) => [...prev, statusMessage]);
    } catch (error) {
      console.error("Reindex error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePath = () => {
    if (tempPath.trim()) {
      setVaultPath(tempPath);
      setShowPathSettings(false);
      const statusMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Vault path updated to: ${tempPath}`,
      };
      setMessages((prev) => [...prev, statusMessage]);
    }
  };

  const handleCancelPath = () => {
    setTempPath(vaultPath);
    setShowPathSettings(false);
  };

  const handleBrowseFolder = () => {
    fileInputRef.current?.click();
  };

  const handleFolderSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (files && files.length > 0) {
      // Get the first file's webkitRelativePath
      const firstFilePath = files[0].webkitRelativePath || "";
      
      if (firstFilePath) {
        // Extract the top-level folder from the relative path
        const pathParts = firstFilePath.split("/");
        if (pathParts.length > 0) {
          const folderName = pathParts[0];
          setTempPath(folderName);
          
          const statusMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: `Selected folder: ${folderName}. Click Save to apply.`,
          };
          setMessages((prev) => [...prev, statusMessage]);
        }
      }
    }
  };

  return (
    <div className={styles.container}>
      {/* Left Sidebar - Search & Filter */}
      <div className={styles.sidebar}>
        <h1>Obsidian Chat</h1>

        {/* Vault Path Settings */}
        <div className={styles.pathSection}>
          <button
            onClick={() => setShowPathSettings(!showPathSettings)}
            className={styles.settingsBtn}
            title="Click to change vault folder"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {vaultPath.split("\\").pop() || "Select Folder"}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, transform: showPathSettings ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {showPathSettings && (
            <div className={styles.pathSettings}>
              <label className={styles.pathLabel}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                Select Your Vault Folder
              </label>

              {/* Hidden folder input */}
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFolderSelection}
                style={{ display: "none" }}
                {...({
                  webkitdirectory: true,
                  directory: true,
                  mozdirectory: true,
                } as any)}
              />

              {/* Browse Button */}
              <button onClick={handleBrowseFolder} className={styles.browseBtn}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  <polyline points="12 11 12 17"/>
                  <polyline points="9 14 12 17 15 14"/>
                </svg>
                Browse & Select Folder
              </button>

              {/* Manual Path Input */}
              <div className={styles.pathManualInput}>
                <label className={styles.subLabel}>Or paste full folder path</label>
                <input
                  type="text"
                  value={tempPath}
                  onChange={(e) => setTempPath(e.target.value)}
                  placeholder="C:\Users\...\VaultFolder"
                  className={styles.pathInput}
                />
              </div>

              {/* Action Buttons */}
              <div className={styles.pathButtonsGroup}>
                <button onClick={handleSavePath} className={styles.pathSaveBtn}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Save
                </button>
                <button onClick={handleCancelPath} className={styles.pathCancelBtn}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.searchBox}>
          <label htmlFor="tag-filter" className={styles.tagLabel}>
            Tag filter (optional)
          </label>
          <input
            id="tag-filter"
            type="search"
            list="tag-options"
            placeholder="Select or type a tag..."
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className={styles.tagInput}
          />
          <datalist id="tag-options">
            {availableTags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
          <div className={styles.tagMeta}>
            {availableTags.length > 0
              ? `${availableTags.length} tag(s) found`
              : "No tags found in this vault yet"}
          </div>
          <button
            onClick={handleReindex}
            disabled={loading}
            className={styles.reindexBtn}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Re-index
          </button>
        </div>
      </div>

      {/* Center - Chat */}
      <div className={styles.chatContainer}>
        {/* Chat header */}
        <div className={styles.chatHeader}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--accent)", flexShrink: 0 }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span className={styles.chatHeaderTitle}>Chat</span>
          {tagFilter && (
            <span className={styles.chatHeaderSub}>— filtered by #{tagFilter}</span>
          )}
        </div>

        <div className={styles.messages}>
          {messages.length === 0 ? (
            <div className={styles.emptyState}>
              <svg className={styles.emptyStateIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              <h2>Ask about your vault</h2>
              <p>Type a question to search your Obsidian notes</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`${styles.message} ${styles[msg.role]}`}>
                <div className={styles.messageContent}>{msg.content}</div>
              </div>
            ))
          )}
          {loading && (
            <div className={styles.message}>
              <div className={styles.loadingDots} aria-label="Loading">
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
                <span className={styles.loadingDot} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className={styles.inputForm}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your notes..."
            disabled={loading}
            className={styles.messageInput}
          />
          <button type="submit" disabled={loading} className={styles.sendBtn}>
            {loading ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinIcon} aria-hidden="true">
                <line x1="12" y1="2" x2="12" y2="6"/>
                <line x1="12" y1="18" x2="12" y2="22"/>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                <line x1="2" y1="12" x2="6" y2="12"/>
                <line x1="18" y1="12" x2="22" y2="12"/>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
              </svg>
            ) : (
              <>
                Send
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Right Sidebar - Sources */}
      <div className={styles.sourcesPanel}>
        <h3>Notes</h3>
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
            {allNotes.length === 0 ? (
              <p className={styles.noSources}>Loading notes...</p>
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
          </div>
        )}
      </div>
    </div>
  );
}
