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

// ── Mermaid helpers ────────────────────────────────────────────────────────

function isMermaidTemplate(template: string): boolean {
  // HTML diagram templates (div-based or table-grid layout) are NOT Mermaid — skip post-processing
  if (/border-collapse|display:inline-block|display:inline-flex|#3a3a3a|#1a1a1a|&#8595;|&#8594;|&#9660;/.test(template)) return false;
  return /mermaid|flowchart|sequenceDiagram/i.test(template);
}

function ensureMermaidWrapped(text: string): string {
  if (text.includes("```mermaid")) return text;
  if (text.includes('class="mermaid"')) {
    return text.replace(
      /<div class="mermaid">([\s\S]*?)<\/div>/gi,
      (_m, content: string) => "```mermaid\n" + content.trim() + "\n```"
    );
  }
  const kwMatch = text.match(/(flowchart|graph|sequenceDiagram)\s/i);
  if (!kwMatch || kwMatch.index === undefined) return text;
  const kwIdx = kwMatch.index;
  const before = text.substring(0, kwIdx);
  const rest = text.substring(kwIdx);
  const endMatch = rest.match(/\b(Key point|Pitfall)\b/i);
  let diagram: string, after: string;
  if (endMatch && endMatch.index) {
    diagram = rest.substring(0, endMatch.index).trimEnd();
    after = rest.substring(endMatch.index);
  } else {
    diagram = rest.trimEnd();
    after = "";
  }
  return before + "```mermaid\n" + diagram + "\n```\n" + after;
}

function fixMermaidInCodeBlock(text: string): string {
  return text.replace(
    /(```mermaid\n)([\s\S]*?)(```)/g,
    (_m, open: string, content: string, close: string) => {
      let f = content;
      f = f.replace(/→/g, "-->").replace(/←/g, "<--");
      f = f.replace(/((?:flowchart|graph|sequenceDiagram)(?:\s+(?:TD|TB|BT|RL|LR))?)\s+([A-Za-z])/i, "$1\n    $2");
      f = f.replace(/\]\s+([A-Za-z]\w*)\s*(-->|---)/g, "]\n    $1 $2");
      f = f.replace(/\]\s+([A-Za-z]\w*)\[/g, "]\n    $1[");
      f = f.replace(/\}\s+([A-Za-z]\w*)\s*(-->|---)/g, "}\n    $1 $2");
      return open + f + close;
    }
  );
}

function cleanMermaidLegacy(text: string): string {
  return text
    .replace(/<script[^>]*mermaid[^>]*><\/script>/gi, "")
    .replace(/<script>mermaid\.initialize[^<]*<\/script>/gi, "")
    .replace(/<div class="mermaid">([\s\S]*?)<\/div>/gi, (_m, c: string) => "```mermaid\n" + c.trim() + "\n```")
    .trim();
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
  const mermaid = isMermaidTemplate(template);
  return `Reformat the FRONT (Text field) of this Anki cloze card to match the given template style. Keep all medical content accurate. Do NOT modify or return the Back field.

## Current Front (Text field)
${front}

## Target Template Style
${template}

## Rules
- Only reformat the FRONT field
- Preserve all medical facts and cloze deletions
- Apply the template's formatting style (headings, bullets, bold, etc.)
- Keep cloze deletions in {{c1::answer}} format${mermaid ? `
- CRITICAL: Wrap ALL mermaid diagram code in markdown code blocks: \`\`\`mermaid ... \`\`\`
- Do NOT use <div class="mermaid"> tags. Use \`\`\`mermaid code blocks only.
- Use proper mermaid arrow syntax: --> for arrows, -->|label| for labeled arrows. NEVER use unicode arrows
- Each node connection MUST be on its own line with 4-space indent` : ""}

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
    const mermaid = isMermaidTemplate(template || "");
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
      temperature: mermaid ? 0.3 : 0.3,
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

    let resultFront: string = parsed.front || "";

    // Post-process: ensure mermaid in code blocks, fix syntax, clean legacy
    if (mermaid) {
      resultFront = cleanMermaidLegacy(resultFront);
      resultFront = ensureMermaidWrapped(resultFront);
      resultFront = fixMermaidInCodeBlock(resultFront);
    }

    return NextResponse.json({ success: true, front: resultFront });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
