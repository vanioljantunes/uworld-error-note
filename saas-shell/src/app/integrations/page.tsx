"use client";

import { useState, useEffect } from "react";
import appStyles from "./navbar.module.css";
import styles from "./dashboard.module.css";
import {
  fetchAllUserData,
  saveUserData,
  deleteUserData,
  getUserData,
} from "@/lib/user-data";

interface GitHubRepo {
  full_name: string;
  name: string;
  private: boolean;
  description: string;
  pushed_at: string;
}

type AnkiStatus = "idle" | "testing" | "connected" | "error";
type LLMProvider = "openai" | "anthropic" | "google";

const PROVIDERS: LLMProvider[] = ["openai", "anthropic", "google"];

const PROVIDER_META: Record<LLMProvider, { label: string; placeholder: string }> = {
  openai: { label: "OpenAI", placeholder: "sk-proj-abc123..." },
  anthropic: { label: "Anthropic", placeholder: "sk-ant-api03-abc123..." },
  google: { label: "Google", placeholder: "AIzaSyA..." },
};

const MODEL_OPTIONS: Record<LLMProvider, { primary: string[]; economy: string[] }> = {
  openai: { primary: ["gpt-4o", "o3-mini"], economy: ["gpt-4o-mini", "gpt-4o"] },
  anthropic: { primary: ["claude-sonnet-4-20250514"], economy: ["claude-sonnet-4-20250514"] },
  google: { primary: ["gemini-2.0-flash"], economy: ["gemini-2.0-flash"] },
};

export default function DashboardPage() {
  // GitHub — read hint from localStorage for instant render
  const [ghAuth, setGhAuth] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("gh_authenticated") === "true";
    return false;
  });
  const [ghUser, setGhUser] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("gh_user") || "";
    return "";
  });
  const [ghAvatar, setGhAvatar] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("gh_avatar") || "";
    return "";
  });
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("github_repo") || "";
    return "";
  });
  const [showRepoList, setShowRepoList] = useState(false);

  // Anki
  const [ankiUrl, setAnkiUrl] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("anki_url") || "http://localhost:8765";
    return "http://localhost:8765";
  });
  const [ankiStatus, setAnkiStatus] = useState<AnkiStatus>("idle");
  const [showAnkiGuide, setShowAnkiGuide] = useState(false);

  // LLM
  const [llmProvider, setLlmProvider] = useState<LLMProvider>(() => {
    if (typeof window !== "undefined") return (localStorage.getItem("llm_provider") as LLMProvider) || "openai";
    return "openai";
  });
  const [primaryModel, setPrimaryModel] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("llm_primary_model") || "gpt-4o";
    return "gpt-4o";
  });
  const [economyModel, setEconomyModel] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("llm_economy_model") || "gpt-4o-mini";
    return "gpt-4o-mini";
  });
  const [llmKeys, setLlmKeys] = useState<Record<LLMProvider, string>>(() => {
    if (typeof window !== "undefined") return {
      openai: localStorage.getItem("llm_key_openai") || "",
      anthropic: localStorage.getItem("llm_key_anthropic") || "",
      google: localStorage.getItem("llm_key_google") || "",
    };
    return { openai: "", anthropic: "", google: "" };
  });
  const [llmSaveMsg, setLlmSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const authResp = await fetch("/api/auth/me");
        const authData = await authResp.json();
        if (authData.authenticated) {
          setGhAuth(true);
          setGhUser(authData.login || "");
          setGhAvatar(authData.avatar_url || "");
          localStorage.setItem("gh_authenticated", "true");
          localStorage.setItem("gh_user", authData.login || "");
          localStorage.setItem("gh_avatar", authData.avatar_url || "");
          setLoadingRepos(true);
          try {
            const reposResp = await fetch("/api/auth/repos");
            const reposData = await reposResp.json();
            setRepos(reposData.repos || []);
          } catch {} finally { setLoadingRepos(false); }

          // Load user data from Supabase
          await fetchAllUserData();
          setSelectedRepo(getUserData<string>("github_repo", ""));
          setAnkiUrl(getUserData<string>("anki_url", "http://localhost:8765"));
          setLlmProvider(getUserData<LLMProvider>("llm_provider", "openai"));
          setPrimaryModel(getUserData<string>("llm_primary_model", "gpt-4o"));
          setEconomyModel(getUserData<string>("llm_economy_model", "gpt-4o-mini"));
          setLlmKeys({
            openai: getUserData<string>("llm_key_openai", ""),
            anthropic: getUserData<string>("llm_key_anthropic", ""),
            google: getUserData<string>("llm_key_google", ""),
          });
        } else {
          // Fall back to localStorage
          if (typeof window !== "undefined") {
            setSelectedRepo(localStorage.getItem("github_repo") || "");
            setAnkiUrl(localStorage.getItem("anki_url") || "http://localhost:8765");
            setLlmProvider((localStorage.getItem("llm_provider") as LLMProvider) || "openai");
            setPrimaryModel(localStorage.getItem("llm_primary_model") || "gpt-4o");
            setEconomyModel(localStorage.getItem("llm_economy_model") || "gpt-4o-mini");
            setLlmKeys({
              openai: localStorage.getItem("llm_key_openai") || "",
              anthropic: localStorage.getItem("llm_key_anthropic") || "",
              google: localStorage.getItem("llm_key_google") || "",
            });
          }
        }
      } catch {
        // Full localStorage fallback
        if (typeof window !== "undefined") {
          setSelectedRepo(localStorage.getItem("github_repo") || "");
          setAnkiUrl(localStorage.getItem("anki_url") || "http://localhost:8765");
          setLlmProvider((localStorage.getItem("llm_provider") as LLMProvider) || "openai");
          setPrimaryModel(localStorage.getItem("llm_primary_model") || "gpt-4o");
          setEconomyModel(localStorage.getItem("llm_economy_model") || "gpt-4o-mini");
          setLlmKeys({
            openai: localStorage.getItem("llm_key_openai") || "",
            anthropic: localStorage.getItem("llm_key_anthropic") || "",
            google: localStorage.getItem("llm_key_google") || "",
          });
        }
      }
    };
    init();
  }, []);

  const handleSelectRepo = (fullName: string) => {
    setSelectedRepo(fullName);
    saveUserData("github_repo", fullName);
  };

  const testAnki = async (url?: string) => {
    const target = url || ankiUrl;
    setAnkiStatus("testing");
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "version", version: 6 }),
        signal: AbortSignal.timeout(4000),
      });
      const data = await res.json();
      setAnkiStatus(data.error === null ? "connected" : "error");
    } catch {
      setAnkiStatus("error");
    }
  };

  // Auto-test AnkiConnect on mount
  useEffect(() => {
    testAnki(ankiUrl);
  }, []);

  const saveAnkiUrl = (url: string) => {
    setAnkiUrl(url);
    saveUserData("anki_url", url);
  };

  const handleDisconnect = () => {
    fetch("/api/auth/logout").then(() => {
      setGhAuth(false);
      setGhUser("");
      setGhAvatar("");
      setRepos([]);
      setSelectedRepo("");
      deleteUserData("github_repo");
      localStorage.removeItem("gh_authenticated");
      localStorage.removeItem("gh_user");
      localStorage.removeItem("gh_avatar");
    });
  };

  const handleProviderChange = (p: LLMProvider) => {
    setLlmProvider(p);
    saveUserData("llm_provider", p);
    const newPrimary = MODEL_OPTIONS[p].primary[0];
    const newEconomy = MODEL_OPTIONS[p].economy[0];
    setPrimaryModel(newPrimary);
    setEconomyModel(newEconomy);
    saveUserData("llm_primary_model", newPrimary);
    saveUserData("llm_economy_model", newEconomy);
  };

  const handleKeyChange = (p: LLMProvider, v: string) => {
    setLlmKeys((prev) => ({ ...prev, [p]: v }));
    saveUserData(`llm_key_${p}`, v);
  };

  const handleSaveLLM = () => {
    saveUserData("llm_provider", llmProvider);
    saveUserData("llm_primary_model", primaryModel);
    saveUserData("llm_economy_model", economyModel);
    setLlmSaveMsg({ text: "Saved", ok: true });
    setTimeout(() => setLlmSaveMsg(null), 3000);
  };

  return (
    <div className={appStyles.appWrapper}>
      {/* Same navbar as main app */}
      <nav className={appStyles.navbar}>
        <a href="/" className={appStyles.navBrand}>
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
          <span className={appStyles.sidebarAppName}>GapStrike</span>
        </a>
        <div className={appStyles.navTabs}>
          <a href="/?view=flow" className={appStyles.navTab}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            Flow
          </a>
          <a href="/?view=editor" className={appStyles.navTab}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z" /><path d="M9 4v16" /><path d="M4 9h5" /><path d="M4 14h5" /></svg>
            Obsidian
          </a>
          <a href="/?view=anki" className={appStyles.navTab}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
            Anki
          </a>
          <a href="/?view=templates" className={appStyles.navTab}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            Templates
          </a>
          <a href="/integrations" className={`${appStyles.navTab} ${appStyles.navTabActive}`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            Integrations
          </a>
        </div>
      </nav>

      {/* Integrations content */}
      <div className={styles.content}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Settings</h1>
              <p className={styles.subtitle}>Manage your integrations and vault connection.</p>
            </div>
          </div>

          {/* GitHub Connection */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <h2 className={styles.cardTitle}>GitHub Vault</h2>
            </div>

            {!ghAuth ? (
              <div className={styles.cardBody}>
                <p className={styles.cardDesc}>
                  Connect your GitHub account to sync notes with your Obsidian vault repository.
                </p>
                <a href="/api/auth/github" className={styles.connectBtn}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  Sign in with GitHub
                </a>
              </div>
            ) : (
              <div className={styles.cardBody}>
                <div className={styles.connectedRow}>
                  {ghAvatar && <img src={ghAvatar} alt="" className={styles.avatar} />}
                  <div>
                    <div className={styles.connectedName}>{ghUser}</div>
                    <div className={styles.connectedStatus}>Connected</div>
                  </div>
                  <button className={styles.disconnectBtn} onClick={handleDisconnect}>
                    Disconnect
                  </button>
                </div>

                <div className={styles.repoSection}>
                  <label className={styles.repoLabel}>Vault Repository</label>
                  {selectedRepo && !showRepoList ? (
                    <div className={styles.selectedRepoRow}>
                      <div className={styles.selectedRepoInfo}>
                        <span className={styles.selectedRepoName}>{selectedRepo.split("/")[1]}</span>
                        <span className={styles.selectedRepoMeta}>{selectedRepo}</span>
                      </div>
                      <button className={styles.changeRepoBtn} onClick={() => setShowRepoList(true)}>
                        Choose another
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className={styles.repoHint}>
                        Select the GitHub repository that contains your Obsidian vault.
                      </p>
                      {loadingRepos ? (
                        <div className={styles.repoLoading}>Loading repositories...</div>
                      ) : (
                        <div className={styles.repoList}>
                          {repos.map((r) => (
                            <button
                              key={r.full_name}
                              className={`${styles.repoItem} ${selectedRepo === r.full_name ? styles.repoItemActive : ""}`}
                              onClick={() => { handleSelectRepo(r.full_name); setShowRepoList(false); }}
                            >
                              <div className={styles.repoItemTop}>
                                <span className={styles.repoItemName}>{r.name}</span>
                                {r.private && <span className={styles.repoItemBadge}>private</span>}
                                {selectedRepo === r.full_name && <span className={styles.repoItemCheck}>Selected</span>}
                              </div>
                              {r.description && <div className={styles.repoItemDesc}>{r.description}</div>}
                              <div className={styles.repoItemMeta}>{r.full_name}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Anki Integration */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIconWrap}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 11a9 9 0 0 1 9 9" />
                  <path d="M4 4a16 16 0 0 1 16 16" />
                  <circle cx="5" cy="19" r="1" />
                </svg>
              </div>
              <div>
                <h2 className={styles.cardTitle}>Integrations</h2>
                <p className={styles.cardSubtitle}>Connect Anki and Obsidian to your workspace</p>
              </div>
            </div>
            <div className={styles.cardBody}>
              {/* Anki section */}
              <div className={styles.sectionRow}>
                <span className={styles.sectionLabel}>Anki</span>
                <span className={`${styles.statusBadge} ${ankiStatus === "connected" ? styles.statusConnected : ankiStatus === "error" ? styles.statusError : styles.statusIdle}`}>
                  <span className={`${styles.statusDot} ${ankiStatus === "connected" ? styles.dotConnected : ankiStatus === "error" ? styles.dotError : styles.dotIdle}`} />
                  {ankiStatus === "testing" ? "Testing..." : ankiStatus === "connected" ? "Connected" : ankiStatus === "error" ? "Not reachable" : "Not configured"}
                </span>
              </div>

              {/* Setup guide — visible when not connected */}
              {ankiStatus !== "connected" && (
                <div className={styles.hintBox}>
                  <p className={styles.hintText}>
                    Requires the <span className={styles.hintHighlight}>AnkiConnect</span> add-on.
                    Install code: <code className={styles.code}>2055492159</code>
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAnkiGuide(!showAnkiGuide)}
                    className={styles.guideToggle}
                  >
                    {showAnkiGuide ? "Hide setup guide" : "View full setup guide"}
                  </button>
                  {showAnkiGuide && (
                    <div className={styles.guideSteps}>
                      <p><span className={styles.stepNum}>1.</span> Open Anki &rarr; Tools &rarr; Add-ons &rarr; Get Add-ons &rarr; paste code <code className={styles.code}>2055492159</code></p>
                      <p><span className={styles.stepNum}>2.</span> Restart Anki. AnkiConnect runs on <code className={styles.code}>http://localhost:8765</code></p>
                      <p><span className={styles.stepNum}>3.</span> For remote access, add your domain to <code className={styles.code}>webCorsOriginList</code> in AnkiConnect config</p>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.inputRow}>
                <div className={styles.inputWrap}>
                  <label className={styles.inputLabel}>AnkiConnect URL</label>
                  <input
                    type="text"
                    value={ankiUrl}
                    onChange={(e) => saveAnkiUrl(e.target.value)}
                    className={styles.input}
                    placeholder="http://localhost:8765"
                  />
                </div>
                <button className={styles.testBtn} onClick={() => testAnki()} disabled={ankiStatus === "testing"}>
                  {ankiStatus === "testing" ? "Testing..." : "Test"}
                </button>
              </div>
            </div>
          </div>

          {/* LLM Configuration */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIconWrap}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div className={styles.cardHeaderText}>
                <h2 className={styles.cardTitle}>LLM Configuration</h2>
                <p className={styles.cardSubtitle}>Provider, API key, and model selection</p>
              </div>
              {llmSaveMsg && (
                <span className={`${styles.saveMsg} ${llmSaveMsg.ok ? styles.saveMsgOk : styles.saveMsgErr}`}>
                  {llmSaveMsg.text}
                </span>
              )}
            </div>
            <div className={styles.cardBody}>
              {/* Provider tab bar */}
              <div className={styles.providerTabs} role="tablist">
                {PROVIDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="tab"
                    aria-selected={llmProvider === p}
                    onClick={() => handleProviderChange(p)}
                    className={`${styles.providerTab} ${llmProvider === p ? styles.providerTabActive : ""}`}
                  >
                    {PROVIDER_META[p].label}
                  </button>
                ))}
              </div>

              {/* API key for active provider */}
              {PROVIDERS.map((p) => (
                <div key={p} className={p === llmProvider ? "" : styles.hidden}>
                  <label className={styles.inputLabel}>
                    {PROVIDER_META[p].label} API Key
                    {llmKeys[p] && <span className={styles.keySaved}>Saved locally</span>}
                  </label>
                  <input
                    type="password"
                    value={llmKeys[p]}
                    onChange={(e) => handleKeyChange(p, e.target.value)}
                    className={styles.input}
                    placeholder={PROVIDER_META[p].placeholder}
                    autoComplete="off"
                  />
                </div>
              ))}

              {/* Model selection */}
              <div className={styles.modelGrid}>
                <div>
                  <label className={styles.inputLabel}>
                    Primary Model <span className={styles.modelHint}>(complex)</span>
                  </label>
                  <select
                    value={primaryModel}
                    onChange={(e) => { setPrimaryModel(e.target.value); saveUserData("llm_primary_model", e.target.value); }}
                    className={styles.select}
                  >
                    <option value="">Select a model</option>
                    {MODEL_OPTIONS[llmProvider].primary.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={styles.inputLabel}>
                    Economy Model <span className={styles.modelHint}>(routine)</span>
                  </label>
                  <select
                    value={economyModel}
                    onChange={(e) => { setEconomyModel(e.target.value); saveUserData("llm_economy_model", e.target.value); }}
                    className={styles.select}
                  >
                    <option value="">Select a model</option>
                    {MODEL_OPTIONS[llmProvider].economy.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Other providers summary */}
              <div className={styles.providerSummary}>
                {PROVIDERS.filter((p) => p !== llmProvider).map((p) => (
                  <span key={p} className={styles.providerSummaryItem}>
                    {PROVIDER_META[p].label}:{" "}
                    <span className={llmKeys[p] ? styles.providerKeySet : ""}>
                      {llmKeys[p] ? "configured" : "not set"}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
