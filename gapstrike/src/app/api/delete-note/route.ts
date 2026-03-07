import { NextRequest, NextResponse } from "next/server";
import { deleteFile, readFile, getTokenFromCookies, DEFAULT_REPO } from "@/lib/github";

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromCookies(request.cookies);
    if (!token) {
      return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
    }

    const { notePath, sha, repo } = await request.json();
    if (!notePath) {
      return NextResponse.json(
        { success: false, error: "Missing notePath" },
        { status: 400 }
      );
    }

    const targetRepo = repo || DEFAULT_REPO;

    // If no SHA provided, fetch it
    let fileSha = sha;
    if (!fileSha) {
      const existing = await readFile(token, targetRepo, notePath);
      fileSha = existing.sha;
    }

    await deleteFile(
      token,
      targetRepo,
      notePath,
      fileSha,
      `Delete ${notePath.split("/").pop()}`
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Unknown error" },
      { status: 500 }
    );
  }
}
