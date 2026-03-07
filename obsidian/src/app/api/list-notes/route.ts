import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface Note {
  title: string;
  path: string;
}

async function listNotesFromDirectory(vaultPath: string): Promise<Note[]> {
  try {
    const notes: Note[] = [];

    async function walkDir(dir: string, baseDir: string) {
      const files = await fs.readdir(dir);
      
      for (const file of files) {
        // Skip hidden directories and node_modules
        if (file.startsWith(".")) continue;
        
        const fullPath = path.join(dir, file);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          // Recursively walk subdirectories
          await walkDir(fullPath, baseDir);
        } else if (file.endsWith(".md")) {
          // Add markdown files
          const relativePath = path.relative(baseDir, fullPath);
          const title = file.replace(".md", "");
          notes.push({
            title,
            path: relativePath,
          });
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
      return NextResponse.json(
        { notes: [] },
        { status: 400 }
      );
    }

    const notes = await listNotesFromDirectory(vaultPath);
    return NextResponse.json({ notes }, { status: 200 });
  } catch (error) {
    console.error("List notes API error:", error);
    return NextResponse.json(
      { notes: [] },
      { status: 200 }
    );
  }
}
