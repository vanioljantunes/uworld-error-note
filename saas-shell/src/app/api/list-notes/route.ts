import { NextRequest, NextResponse } from "next/server";
import {
  listAllFiles,
  readBlob,
  parseFrontmatterTags,
  getTokenFromCookies,
  DEFAULT_REPO,
} from "@/lib/github";

interface Note {
  title: string;
  path: string;
  tags: string[];
  sha: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = getTokenFromCookies(request.cookies);
    if (!token) {
      return NextResponse.json({ notes: [], error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const repo = body.repo || DEFAULT_REPO;

    const files = await listAllFiles(token, repo);

    // Batch-fetch blob content for frontmatter tag parsing
    const BATCH = 15;
    const notes: Note[] = [];

    for (let i = 0; i < files.length; i += BATCH) {
      const batch = files.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async (file) => {
          const content = await readBlob(token, repo, file.sha);
          const tags = parseFrontmatterTags(content);
          const title = file.path.split("/").pop()?.replace(".md", "") || "";
          return { title, path: file.path, tags, sha: file.sha } as Note;
        })
      );
      notes.push(...results);
    }

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("List notes API error:", error);
    return NextResponse.json({ notes: [] }, { status: 200 });
  }
}
