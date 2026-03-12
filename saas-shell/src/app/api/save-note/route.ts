import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, getTokenFromCookies, DEFAULT_REPO } from "@/lib/github";

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromCookies(request.cookies);
    if (!token) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { notePath, content, sha, repo } = await request.json();
    if (!notePath || content === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing notePath or content" },
        { status: 400 }
      );
    }

    const targetRepo = repo || DEFAULT_REPO;

    // If no SHA provided, try to get it (file may already exist)
    let fileSha = sha;
    if (!fileSha) {
      try {
        const existing = await readFile(token, targetRepo, notePath);
        fileSha = existing.sha;
      } catch {
        // File doesn't exist — will create new
      }
    }

    const message = fileSha
      ? `Update ${notePath.split("/").pop()}`
      : `Create ${notePath.split("/").pop()}`;

    const result = await writeFile(token, targetRepo, notePath, content, message, fileSha);
    return NextResponse.json({ success: true, sha: result.sha });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
