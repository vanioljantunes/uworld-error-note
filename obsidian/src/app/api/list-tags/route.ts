import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface TagsResponse {
  tags: string[];
}

const HASH_TAG_REGEX = /(^|\s)#([\p{L}\p{N}_\-/]+)/gu;

function extractTagsFromFrontmatter(content: string): string[] {
  const tags: string[] = [];

  if (!content.startsWith("---\n")) {
    return tags;
  }

  const endIndex = content.indexOf("\n---", 4);
  if (endIndex === -1) {
    return tags;
  }

  const frontmatter = content.slice(4, endIndex);

  // tags: [foo, bar]
  const inlineMatch = frontmatter.match(/(^|\n)tags\s*:\s*\[([^\]]+)\]/i);
  if (inlineMatch?.[2]) {
    const inlineTags = inlineMatch[2]
      .split(",")
      .map((t) => t.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    tags.push(...inlineTags);
  }

  // tags:
  //   - foo
  //   - bar
  const blockMatch = frontmatter.match(/(^|\n)tags\s*:\s*\n([\s\S]*?)(\n\w|$)/i);
  if (blockMatch?.[2]) {
    const blockTags = blockMatch[2]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("-"))
      .map((line) => line.replace(/^-\s*/, "").replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    tags.push(...blockTags);
  }

  return tags;
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toLowerCase();
}

async function listTagsFromDirectory(vaultPath: string): Promise<string[]> {
  const tagsSet = new Set<string>();

  async function walkDir(dir: string) {
    const files = await fs.readdir(dir);

    for (const file of files) {
      if (file.startsWith(".")) continue;

      const fullPath = path.join(dir, file);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        await walkDir(fullPath);
        continue;
      }

      if (!file.endsWith(".md")) {
        continue;
      }

      const content = await fs.readFile(fullPath, "utf-8");

      // YAML frontmatter tags
      for (const frontmatterTag of extractTagsFromFrontmatter(content)) {
        const normalized = normalizeTag(frontmatterTag);
        if (normalized) tagsSet.add(normalized);
      }

      // Inline #tags
      for (const match of content.matchAll(HASH_TAG_REGEX)) {
        const normalized = normalizeTag(match[2] || "");
        if (normalized) tagsSet.add(normalized);
      }
    }
  }

  try {
    await walkDir(vaultPath);
    return Array.from(tagsSet).sort((a, b) => a.localeCompare(b));
  } catch (error) {
    console.error("List tags error:", error);
    return [];
  }
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<TagsResponse>> {
  try {
    const body = (await request.json()) as { vaultPath?: string };
    const { vaultPath } = body;

    if (!vaultPath) {
      return NextResponse.json({ tags: [] }, { status: 400 });
    }

    const tags = await listTagsFromDirectory(vaultPath);
    return NextResponse.json({ tags }, { status: 200 });
  } catch (error) {
    console.error("List tags API error:", error);
    return NextResponse.json({ tags: [] }, { status: 200 });
  }
}
