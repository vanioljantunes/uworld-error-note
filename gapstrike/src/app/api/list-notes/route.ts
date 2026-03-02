import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface Note {
  title: string;
  path: string;
  tags: string[];
}

function parseFrontmatterTags(content: string): string[] {
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

async function listNotesFromDirectory(vaultPath: string): Promise<Note[]> {
  try {
    const notes: Note[] = [];

    async function walkDir(dir: string, baseDir: string) {
      const files = await fs.readdir(dir);

      for (const file of files) {
        if (file.startsWith(".")) continue;

        const fullPath = path.join(dir, file);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await walkDir(fullPath, baseDir);
        } else if (file.endsWith(".md")) {
          const relativePath = path.relative(baseDir, fullPath);
          const title = file.replace(".md", "");
          let tags: string[] = [];
          try {
            const content = await fs.readFile(fullPath, "utf-8");
            tags = parseFrontmatterTags(content);
          } catch {
            // ignore read errors, leave tags empty
          }
          notes.push({ title, path: relativePath, tags });
        }
      }
    }

    await walkDir(vaultPath, vaultPath);
    return notes;
  } catch (error) {
    console.error("List notes error:", error);
    return [];
  }
}

export async function POST(request: NextRequest): Promise<NextResponse<{ notes: Note[] }>> {
  try {
    const body = await request.json() as { vaultPath?: string };
    const { vaultPath } = body;

    if (!vaultPath) {
      return NextResponse.json({ notes: [] }, { status: 400 });
    }

    const notes = await listNotesFromDirectory(vaultPath);
    return NextResponse.json({ notes }, { status: 200 });
  } catch (error) {
    console.error("List notes API error:", error);
    return NextResponse.json({ notes: [] }, { status: 200 });
  }
}
