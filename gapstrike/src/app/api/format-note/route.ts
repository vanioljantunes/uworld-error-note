import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are a medical education specialist who reformats USMLE error notes.
Preserve all [[wikilinks]], YAML frontmatter tags, and medical accuracy.
Return ONLY the reformatted note as plain markdown. No JSON wrapper, no code fences around the result.`;

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { note_content, extraction, template } = body;

    if (!note_content || !template) {
      return NextResponse.json(
        { success: false, error: "note_content and template are required" },
        { status: 400 }
      );
    }

    // Build extraction context block
    const ext = extraction || {};
    const contextParts: string[] = [];
    if (ext.educational_objective) contextParts.push(`Educational Objective: ${ext.educational_objective}`);
    if (ext.full_explanation) contextParts.push(`Explanation: ${ext.full_explanation.slice(0, 1500)}`);
    if (ext.question) contextParts.push(`Question: ${ext.question}`);
    if (ext.chosen_answer) contextParts.push(`Student chose: ${ext.chosen_answer}`);
    if (ext.correct_answer) contextParts.push(`Correct answer: ${ext.correct_answer}`);
    const extractionContext = contextParts.length > 0
      ? `\n## Extraction Context (use for accuracy)\n${contextParts.join("\n")}`
      : "";

    const userMsg = `Reformat the following error note to match the target template style.

## Current Note Content
${note_content}
${extractionContext}

## Target Template Style
${template}

## Rules
- Match the template's structure and section headings exactly
- Use the extraction context to ensure medical accuracy and fill in specific details
- Preserve the YAML frontmatter tags from the original note
- Use [[wikilinks]] for medical terms and connections
- Do NOT copy the question verbatim — reference concepts instead
- Return ONLY the reformatted note as plain markdown`;

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      temperature: 0.5,
      max_tokens: 3000,
    });

    let content = response.choices[0].message.content || "";

    // Strip markdown code fences if the LLM wrapped the result
    content = content
      .replace(/^```markdown\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return NextResponse.json({ success: true, content });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
