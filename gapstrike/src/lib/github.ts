const GITHUB_API = "https://api.github.com";
const DEFAULT_BRANCH = "master";

export const DEFAULT_REPO =
  process.env.DEFAULT_GITHUB_REPO || "vanioljantunes/usmle-vault";

// ── Token helpers ────────────────────────────────────────────────────────

export function getTokenFromCookies(cookies: {
  get: (name: string) => { value: string } | undefined;
}): string | null {
  return cookies.get("github_token")?.value || null;
}

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

// ── List all .md files (Trees API, single call) ─────────────────────────

interface GitFile {
  path: string;
  sha: string;
  size: number;
}

export async function listAllFiles(
  token: string,
  repo: string,
  branch = DEFAULT_BRANCH
): Promise<GitFile[]> {
  const resp = await fetch(
    `${GITHUB_API}/repos/${repo}/git/trees/${branch}?recursive=1`,
    { headers: headers(token) }
  );
  if (!resp.ok) throw new Error(`Trees API ${resp.status}`);
  const data = await resp.json();
  return (data.tree || [])
    .filter((i: any) => i.type === "blob" && i.path.endsWith(".md") && !i.path.startsWith("."))
    .map((i: any) => ({ path: i.path, sha: i.sha, size: i.size }));
}

// ── Read blob content (Git Blobs API) ───────────────────────────────────

export async function readBlob(
  token: string,
  repo: string,
  sha: string
): Promise<string> {
  const resp = await fetch(
    `${GITHUB_API}/repos/${repo}/git/blobs/${sha}`,
    { headers: headers(token) }
  );
  if (!resp.ok) return "";
  const data = await resp.json();
  return Buffer.from(data.content, "base64").toString("utf-8");
}

// ── Read file via Contents API (returns content + sha for updates) ──────

export async function readFile(
  token: string,
  repo: string,
  filePath: string,
  branch = DEFAULT_BRANCH
): Promise<{ content: string; sha: string }> {
  const resp = await fetch(
    `${GITHUB_API}/repos/${repo}/contents/${encodeURIComponent(filePath)}?ref=${branch}`,
    { headers: headers(token) }
  );
  if (!resp.ok) {
    if (resp.status === 404) throw new Error("File not found");
    throw new Error(`Contents API GET ${resp.status}`);
  }
  const data = await resp.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha };
}

// ── Write / create file (Contents API PUT) ──────────────────────────────

export async function writeFile(
  token: string,
  repo: string,
  filePath: string,
  content: string,
  message: string,
  sha?: string,
  branch = DEFAULT_BRANCH
): Promise<{ sha: string }> {
  const body: Record<string, string> = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  const resp = await fetch(
    `${GITHUB_API}/repos/${repo}/contents/${encodeURIComponent(filePath)}`,
    {
      method: "PUT",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Contents API PUT ${resp.status}: ${err.message || ""}`);
  }
  const data = await resp.json();
  return { sha: data.content.sha };
}

// ── Delete file (Contents API DELETE) ───────────────────────────────────

export async function deleteFile(
  token: string,
  repo: string,
  filePath: string,
  sha: string,
  message: string,
  branch = DEFAULT_BRANCH
): Promise<void> {
  const resp = await fetch(
    `${GITHUB_API}/repos/${repo}/contents/${encodeURIComponent(filePath)}`,
    {
      method: "DELETE",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ message, sha, branch }),
    }
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`Contents API DELETE ${resp.status}: ${err.message || ""}`);
  }
}

// ── Frontmatter tag parser ──────────────────────────────────────────────

export function parseFrontmatterTags(content: string): string[] {
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
}
