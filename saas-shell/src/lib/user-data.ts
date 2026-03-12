// All known fixed localStorage keys to migrate
const FIXED_KEYS = [
  "github_repo",
  "chatSessions",
  "savedExtractions",
  "obsidianChatActivity",
  "anki_url",
  "llm_provider",
  "llm_primary_model",
  "llm_economy_model",
  "llm_key_openai",
  "llm_key_anthropic",
  "llm_key_google",
] as const;

// Dynamic key prefixes (title_, note_, qhist_)
const DYNAMIC_PREFIXES = ["title_", "note_", "qhist_"];

// Module-level cache (populated by fetchAll on mount)
let cache: Record<string, unknown> | null = null;
let cacheReady = false;

// ── Fetch all keys for current user (single API call) ────────────────────
export async function fetchAllUserData(): Promise<Record<string, unknown>> {
  const resp = await fetch("/api/user-data");
  if (!resp.ok) throw new Error(`fetchAll: ${resp.status}`);
  const { data } = await resp.json();
  cache = data || {};
  cacheReady = true;
  return cache as Record<string, unknown>;
}

// ── Get a single value (from cache first, falls back to localStorage) ────
export function getUserData<T = unknown>(key: string, fallback: T): T {
  if (cacheReady && cache) {
    const val = cache[key];
    return val !== undefined ? (val as T) : fallback;
  }
  // Not loaded yet — fall back to localStorage
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

// ── Save a single key-value pair (write-through: cache + localStorage + Supabase)
export async function saveUserData(
  key: string,
  value: unknown
): Promise<void> {
  // Update cache immediately
  if (cache) cache[key] = value;

  // Always write to localStorage as backup
  try {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch {
    /* quota exceeded */
  }

  // Write to Supabase
  try {
    await fetch("/api/user-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
  } catch {
    // Network error — localStorage backup ensures no data loss
  }
}

// ── Debounced save (for high-frequency writes like chatSessions) ─────────
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export function saveUserDataDebounced(
  key: string,
  value: unknown,
  ms = 1000
): void {
  // Update cache + localStorage immediately
  if (cache) cache[key] = value;
  try {
    const serialized =
      typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch {
    /* quota exceeded */
  }

  // Debounce the Supabase write
  if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
  debounceTimers[key] = setTimeout(async () => {
    try {
      await fetch("/api/user-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
    } catch {
      /* network error — localStorage has the data */
    }
  }, ms);
}

// ── Delete a single key ──────────────────────────────────────────────────
export async function deleteUserData(key: string): Promise<void> {
  if (cache) delete cache[key];
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }

  try {
    await fetch("/api/user-data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
  } catch {
    /* network error */
  }
}

// ── One-time migration: push all localStorage data to Supabase ───────────
export async function migrateLocalStorageToSupabase(): Promise<void> {
  if (typeof window === "undefined") return;

  const toMigrate: { key: string; value: unknown }[] = [];

  // Fixed keys
  for (const key of FIXED_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        value = raw;
      }
      toMigrate.push({ key, value });
    }
  }

  // Dynamic keys (title_*, note_*, qhist_*)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (DYNAMIC_PREFIXES.some((p) => key.startsWith(p))) {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        let value: unknown;
        try {
          value = JSON.parse(raw);
        } catch {
          value = raw;
        }
        toMigrate.push({ key, value });
      }
    }
  }

  if (toMigrate.length === 0) return;

  // Send each to Supabase in parallel (upsert — safe to run multiple times)
  await Promise.all(
    toMigrate.map(({ key, value }) =>
      fetch("/api/user-data", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      }).catch(() => {})
    )
  );
}

// ── Reset cache (call on logout) ─────────────────────────────────────────
export function resetUserDataCache(): void {
  cache = null;
  cacheReady = false;
}
