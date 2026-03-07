import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("github_token")?.value;
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const resp = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const user = await resp.json();
  return NextResponse.json({
    authenticated: true,
    login: user.login,
    avatar_url: user.avatar_url,
    name: user.name,
  });
}
