import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("github_token")?.value;
  if (!token) {
    return NextResponse.json({ repos: [] }, { status: 401 });
  }

  try {
    // Fetch user's repos (up to 100, sorted by most recently pushed)
    const resp = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=pushed&direction=desc",
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
    );

    if (!resp.ok) {
      return NextResponse.json({ repos: [] }, { status: resp.status });
    }

    const data = await resp.json();
    const repos = data.map((r: any) => ({
      full_name: r.full_name,
      name: r.name,
      private: r.private,
      description: r.description || "",
      pushed_at: r.pushed_at,
    }));

    return NextResponse.json({ repos });
  } catch {
    return NextResponse.json({ repos: [] }, { status: 500 });
  }
}
