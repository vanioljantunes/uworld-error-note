import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const FALLBACK_SYSTEM_PROMPT = `You are an expert Anki card creator for medical education.
You create cloze-deletion cards from Obsidian micro-notes.
You MUST return ONLY valid JSON. No markdown code fences around the JSON itself. No explanations outside the JSON.`;

function isMermaidTemplate(template: string): boolean {
  return /mermaid|flowchart|sequenceDiagram/i.test(template);
}

/** Parse structured template with <!-- section: Name --> markers */
function parseTemplateSections(template: string): Record<string, string> | null {
  if (!template.includes("<!-- section:")) return null;
  const sections: Record<string, string> = {};
  const parts = template.split(/<!--\s*section:\s*/i);
  for (const part of parts.slice(1)) {
    const endComment = part.indexOf("-->");
    if (endComment === -1) continue;
    const name = part.substring(0, endComment).trim();
    const content = part.substring(endComment + 3).trim();
    sections[name] = content;
  }
  return Object.keys(sections).length > 0 ? sections : null;
}

/** Ensure mermaid code is wrapped in <div class="mermaid"> for Anki rendering */
function ensureMermaidWrapped(text: string): string {
  if (text.includes('class="mermaid"')) return text;
  if (text.includes("```mermaid")) {
    return text.replace(
      /```mermaid\s*\n?([\s\S]*?)```/g,
      (_m, content: string) => '<div class="mermaid">\n' + content.trim() + "\n</div>"
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
  return before + '<div class="mermaid">\n' + diagram + "\n</div>\n" + after;
}

/** Fix mermaid syntax inside <div class="mermaid"> tags */
function fixMermaidInDivBlock(text: string): string {
  return text.replace(
    /(<div class="mermaid">\s*\n?)([\s\S]*?)(<\/div>)/gi,
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

/** Strip mermaid CDN scripts */
function cleanMermaidLegacy(text: string): string {
  return text
    .replace(/<script[^>]*mermaid[^>]*><\/script>/gi, "")
    .replace(/<script>mermaid\.initialize[^<]*<\/script>/gi, "")
    .trim();
}

/** Build system + user prompt from structured template sections */
function buildStructuredPrompt(noteContent: string, sections: Record<string, string>): { system: string; user: string } {
  const system = sections["System Prompt"] || FALLBACK_SYSTEM_PROMPT;

  const instructions = sections["Instructions"] || "";
  const cardStructure = sections["Card Structure"] || "";
  const rules = sections["Rules"] || "";

  const user = `${instructions}

## Selected Content
${noteContent}
${cardStructure ? `\n## Example Card\n${cardStructure}` : ""}
${rules ? `\n## Rules\n${rules}` : ""}

Return JSON:
{
  "success": true,
  "front": "<card front content>",
  "back": "<card back content>"
}`;

  return { system, user };
}

/** Fallback prompt for templates without section markers */
function buildFallbackPrompt(noteContent: string, template: string): string {
  return `Create ONE Anki cloze card from the selected content below.

## Selected Content
${noteContent}
${template ? `\n## Card Template (follow this format)\n${template}` : ""}

## Rules
- Create a card that directly tests the KEY fact from the selected content
- If the content is a comparison table, test the most important distinction between the items
- Do NOT invent clinical vignettes or scenarios — test the content directly as given
- Do NOT write the front as a question. Write it as 2-3 factual statement phrases.
- In those phrases, cloze-delete only 1-2 KEY WORDS per phrase (the specific terms the student must recall)
- Use {{c1::answer}} cloze syntax ONLY in the "front" field
- NEVER use {{c1::}} or any cloze syntax in the "back" field — plain text/HTML only
- Back: brief additional context or explanation (no cloze syntax)

Return JSON:
{
  "success": true,
  "front": "<2-3 factual phrases with key words clozed>",
  "back": "<plain text/HTML only — NO cloze syntax>"
}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { note_content, template } = body;

    if (!note_content) {
      return NextResponse.json(
        { success: false, error: "note_content is required" },
        { status: 400 }
      );
    }

    // Parse structured template sections if available
    const sections = parseTemplateSections(template || "");
    let systemPrompt: string;
    let userPrompt: string;

    if (sections) {
      // Structured template — use its own system prompt and instructions
      const prompts = buildStructuredPrompt(note_content, sections);
      systemPrompt = prompts.system;
      userPrompt = prompts.user;
    } else {
      // Unstructured template — use fallback generic prompt
      systemPrompt = FALLBACK_SYSTEM_PROMPT;
      userPrompt = buildFallbackPrompt(note_content, template || "");
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
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

    let front: string = parsed.front || "";
    let back: string = parsed.back || "";

    // Post-process: ensure mermaid wrapped in div, fix syntax, clean legacy
    if (isMermaidTemplate(body.template || "")) {
      front = cleanMermaidLegacy(front);
      back = cleanMermaidLegacy(back);
      front = ensureMermaidWrapped(front);
      back = ensureMermaidWrapped(back);
      front = fixMermaidInDivBlock(front);
      back = fixMermaidInDivBlock(back);
    }

    // Strip cloze syntax from back — only front should have cloze
    back = back.replace(/\{\{c\d+::([\s\S]*?)\}\}/g, "$1");

    return NextResponse.json({ success: true, front, back });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
