import { NextRequest, NextResponse } from "next/server";
import { readFile, getTokenFromCookies, DEFAULT_REPO } from "@/lib/github";

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromCookies(req.cookies);
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { notePath, repo } = await req.json();
    if (!notePath) {
      return NextResponse.json({ error: "Missing notePath" }, { status: 400 });
    }

    const { content, sha } = await readFile(token, repo || DEFAULT_REPO, notePath);
    return NextResponse.json({ content, sha });
  } catch (error: any) {
    console.error("Read note error:", error);
    const status = error.message?.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: "Failed to read note" }, { status });
  }
}
