import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 30;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();

const SYSTEM_PROMPT = `You are a structured extraction agent for USMLE/UWorld-style review screenshots.

You will receive:
1. OCR text from the full screenshot
2. Four image quadrants (A, B, C, D) with this FIXED layout:

  A (top-left) | B (top-right)
  C (bot-left) | D (bot-right)

What lives where:
- A: Question ID (top-left corner, a number like "1736") + question stem
- B: Explanation text (first part)
- C: Answer alternatives (A-E) + sometimes part of the question
- D: Explanation text (continued) + Educational Objective

Output Rules

Output ONLY valid JSON. No markdown. No explanations. No extra keys.

If a field is not found, return null.
Merge multiple screenshots into one object if same question.
Return array only if multiple distinct questions.

Required Schema

{
"question_id": string | null,
"question": string | null,
"choosed_alternative": string | null,
"wrong_alternative": string | null,
"full_explanation": string | null,
"educational_objective": string | null
}

Extraction Rules

question_id
MUST come from QUADRANT A ONLY. Ignore all numbers from quadrants B, C, D.
The ID is a standalone number displayed near the top-left of the screen (e.g., "1736", "2513", "483921").
It is NOT:
- A time like "3:08" or "12:45" (these contain colons)
- A percentage like "73%"
- A page number like "1 of 40"
- A score or countdown
If you cannot find a clear standalone numeric ID in QUADRANT A, return null.

question
Extract the full question stem (vignette + lead-in) from QUADRANT A and possibly C.
Do NOT include answer choices.

choosed_alternative
The student's selected answer — letter AND full text.
Look in QUADRANT C for the answer choices. The selected answer may have a red X or highlight.
Cross-reference with the OCR text. Never return just a letter.
Format: "D. Full answer text here"

wrong_alternative
The correct answer — letter AND full text. Only if the student got it wrong.
To find the correct answer, check ALL of these sources:
1. QUADRANT C: look for a green checkmark or highlight on one of the alternatives
2. QUADRANTS B and D (explanation): the explanation almost always states the correct answer explicitly (e.g., "The correct answer is...", "The answer is...", or names the correct concept)
3. OCR text: search for phrases like "correct answer", "the answer is", or the answer that matches the explanation
If choosed_alternative is different from the correct answer found in the explanation, return the correct one here.
If the chosen answer was correct (matches what the explanation says), return null.
Format: "E. Full answer text here"

full_explanation
Extract from QUADRANTS B and D. The explanation is usually the longest block of text.

educational_objective
Extract verbatim from QUADRANT D. Usually starts with "Educational Objective" as a header.

Validate JSON before returning.`;

interface ExtractRequest {
  text: string;
  quadrants?: string[][];
}

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as ExtractRequest;
    const { text, quadrants } = body;

    if ((!text || text.trim().length === 0) && (!quadrants || quadrants.length === 0)) {
      return NextResponse.json(
        { error: "No text or images provided." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const labels = [
      "QUADRANT A (top-left): Question ID + question stem",
      "QUADRANT B (top-right): Explanation text (first part)",
      "QUADRANT C (bottom-left): Answer alternatives + sometimes more question",
      "QUADRANT D (bottom-right): Explanation (continued) + Educational Objective",
    ];

    // Build multimodal content
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    if (text && text.trim().length > 0) {
      userContent.push({
        type: "text" as const,
        text: `OCR text from the full screenshot:\n\n${text}\n\nBelow are 4 quadrant images from the same screenshot. Use BOTH the OCR text and the images to extract all fields. Return ONLY valid JSON.`,
      });
    }

    if (quadrants && quadrants.length > 0) {
      // Send quadrants for each screenshot
      for (let s = 0; s < quadrants.length; s++) {
        const quads = quadrants[s];
        for (let q = 0; q < quads.length && q < 4; q++) {
          userContent.push({
            type: "text" as const,
            text: labels[q],
          });
          userContent.push({
            type: "image_url" as const,
            image_url: {
              url: quads[q],
              detail: "low" as const,
            },
          });
        }
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0,
      max_tokens: 4096,
    });

    const rawAnswer =
      response.choices[0].message.content || '{"error": "No response"}';

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
          { result: rawAnswer, parseError: true },
          { status: 200 }
        );
      }
    }

    const obj = Array.isArray(parsed) ? parsed[0] : parsed;
    return NextResponse.json({ result: Array.isArray(parsed) ? parsed : obj }, { status: 200 });
  } catch (error) {
    console.error("Extract API error:", error);
    let errorMessage = "Unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { error: `Extraction failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
