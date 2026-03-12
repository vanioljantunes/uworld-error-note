import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ── Fallback prompts (used when template has no sections) ──────────────────

const DEFAULT_SYSTEM_PROMPT = `You are an expert Anki card formatter for medical education.
You reformat existing card content to match a given template style.
You MUST return ONLY valid JSON. No markdown code fences around the JSON itself. No explanations outside the JSON.`;

// ── Section parser ─────────────────────────────────────────────────────────

const SECTION_RE = /<!--\s*section:\s*(.+?)\s*-->/gi;

interface TemplateSections {
  system?: string;
  instructions?: string;
  cardStructure?: string;
  rules?: string;
}

function parseTemplateSections(template: string): TemplateSections | null {
  const markers = [...template.matchAll(SECTION_RE)];
  if (markers.length === 0) return null;

  const sections: TemplateSections = {};
  for (let i = 0; i < markers.length; i++) {
    const name = markers[i][1].toLowerCase().replace(/\s+/g, "");
    const start = markers[i].index! + markers[i][0].length;
    const end = i + 1 < markers.length ? markers[i + 1].index! : template.length;
    const content = template.substring(start, end).trim();

    if (name === "systemprompt") sections.system = content;
    else if (name === "instructions") sections.instructions = content;
    else if (name === "cardstructure") sections.cardStructure = content;
    else if (name === "rules") sections.rules = content;
  }
  return sections;
}

// ── Prompt builders ────────────────────────────────────────────────────────

function buildSectionedPrompt(front: string, sections: TemplateSections): string {
  const parts: string[] = [];

  if (sections.instructions) {
    parts.push(sections.instructions);
  }

  parts.push(`## Source Content\n${front}`);

  if (sections.cardStructure) {
    parts.push(`## Example Card Structure\n${sections.cardStructure}`);
  }

  if (sections.rules) {
    parts.push(`## Rules\n${sections.rules}`);
  }

  parts.push(`Return JSON:\n{\n  "success": true,\n  "front": "<formatted card front>"\n}`);

  return parts.join("\n\n");
}

function buildFallbackPrompt(front: string, template: string): string {
  return `Reformat the FRONT (Text field) of this Anki cloze card to match the given template style. Keep all medical content accurate. Do NOT modify or return the Back field.

## Current Front (Text field)
${front}

## Target Template Style
${template}

## Rules
- Only reformat the FRONT field
- Preserve all medical facts and cloze deletions
- Apply the template's formatting style (headings, bullets, bold, etc.)
- Keep cloze deletions in {{c1::answer}} format

Return JSON:
{
  "success": true,
  "front": "<reformatted content for Text field>"
}`;
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { front, back, template } = body;

    if (!front && !back) {
      return NextResponse.json(
        { success: false, error: "front or back content is required" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const sections = parseTemplateSections(template || "");

    // Build system and user messages from sections or fallback
    let systemMsg: string;
    let userMsg: string;

    if (sections) {
      systemMsg = sections.system || DEFAULT_SYSTEM_PROMPT;
      userMsg = buildSectionedPrompt(front || "", sections);
    } else {
      systemMsg = DEFAULT_SYSTEM_PROMPT;
      userMsg = buildFallbackPrompt(front || "", template || "");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: userMsg },
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    const rawAnswer = response.choices[0].message.content || '{"success":false,"error":"Empty response"}';

    let parsed;
    try {
      parsed = JSON.parse(rawAnswer);
    } catch {
      const cleaned = rawAnswer
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return NextResponse.json(
          { success: false, error: "Failed to parse LLM response" },
          { status: 500 }
        );
      }
    }

    const resultFront: string = parsed.front || "";

    return NextResponse.json({ success: true, front: resultFront });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
