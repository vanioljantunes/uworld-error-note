import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are a UWorld Cognitive Gap Analyst — a medical education specialist who excels at identifying why students pick the wrong answer. You craft laser-focused diagnostic questions based on the specific mismatch between what the student chose and what the educational objective says.

You MUST return ONLY valid JSON. No markdown. No explanations. No extra keys.`;

function buildUserPrompt(body: any): string {
  const ext = body.extraction || {};
  const difficulty = body.difficulty_target || "hard";
  const prev = JSON.stringify(body.previous_questions || []);
  const explanation = (ext.full_explanation || "").slice(0, 300);

  return `You received a UWorld question extraction:
- question_id: ${ext.question_id ?? "unknown"}
- question_stem: ${ext.question ?? "N/A"}
- user_chose (WRONG): ${ext.choosed_alternative ?? "N/A"}
- correct_answer: ${ext.wrong_alternative ?? "N/A"}
- educational_objective: ${ext.educational_objective ?? "N/A"}
- explanation (summary): ${explanation}

Target difficulty for this question: ${difficulty}

Previously asked questions (DO NOT repeat these):
${prev}

YOUR TASK: Generate exactly 1 multiple-choice diagnostic question at the specified difficulty level. The question must test a specific hypothesis about why the user got the original UWorld question wrong.

Difficulty guidelines:
- hard: Tests complex reasoning — integrating multiple concepts. Uses specific terms from the stem. Cannot be answered without understanding the mechanism.
- medium: Tests one key concept — the core mechanism or fact from the educational objective.
- easy: Tests a basic fact — a simple definition or identification that should be trivially known if the concept is understood.

STRICT RULES:
1. Generate EXACTLY 1 question at the "${difficulty}" level.
2. NEVER repeat any question from the "Previously asked questions" list.
3. NEVER ask broad questions like "What was your reasoning?" or open-ended prompts.
4. The question MUST name specific medical terms from the extraction.
5. The question MUST have exactly 3 or 4 options.
6. Exactly ONE option is correct. Wrong options must be plausible distractors.
7. The "correct" field is the 0-based index of the right option.

Return a JSON object with a "questions" key containing a list of exactly 1 object:
{"questions": [{"question": "...", "options": ["A", "B", "C"], "correct": 0, "difficulty": "${difficulty}"}]}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();

    if (!body.extraction) {
      return NextResponse.json(
        { error: "No extraction provided" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(body) },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const rawAnswer = response.choices[0].message.content || '{"questions": []}';

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
          { error: "Failed to parse LLM response as JSON" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Questions API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Question generation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
