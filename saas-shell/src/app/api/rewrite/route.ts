import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const { selected_text, full_note, mode } = await request.json();

    if (!selected_text) {
      return NextResponse.json(
        { success: false, error: "selected_text is required" },
        { status: 400 }
      );
    }

    const systemPrompt =
      mode === "expand"
        ? `You are a medical education writer. You expand selected text with more detail, mechanisms, and clinical relevance. Keep the same Obsidian markdown style. Return ONLY the rewritten text — no JSON wrapper, no explanations. Preserve any wikilinks [[ ]] exactly as they are.`
        : `You are a medical education writer. You condense selected text to be more concise while keeping all essential facts and mechanisms. Remove redundancy and wordiness. Keep the same Obsidian markdown style. Return ONLY the rewritten text — no JSON wrapper, no explanations. Preserve any wikilinks [[ ]] exactly as they are.`;

    const userPrompt =
      mode === "expand"
        ? `Expand the following selected text with more detail. Add mechanisms, clinical correlations, or clarifying context where useful. Keep it focused and educational.\n\n## Selected Text\n${selected_text}\n\n## Context (full note — do NOT rewrite, just use for context)\n${(full_note || "").slice(0, 2000)}`
        : `Condense the following selected text. Keep all essential medical facts but remove redundancy and wordiness. Make it tighter.\n\n## Selected Text\n${selected_text}\n\n## Context (full note — do NOT rewrite, just use for context)\n${(full_note || "").slice(0, 2000)}`;

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 2048,
    });

    const result = response.choices[0].message.content || "";

    return NextResponse.json({ success: true, rewritten: result.trim() });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
