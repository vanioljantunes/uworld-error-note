import { NextRequest } from "next/server";

export async function getGithubUserId(
  request: NextRequest
): Promise<string | null> {
  const token = request.cookies.get("github_token")?.value;
  if (!token) return null;
  try {
    const resp = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return null;
    const user = await resp.json();
    return `github_${user.id}`;
  } catch {
    return null;
  }
}
