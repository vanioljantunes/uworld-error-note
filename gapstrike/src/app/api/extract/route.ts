import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT = `You are a structured extraction agent.

Your task is to read USMLE/UWorld-style review screenshots and extract the content into strict JSON.

Output Rules

Output ONLY valid JSON.

No markdown.

No explanations.

No extra keys.

If a field is not visible, return null.

If multiple screenshots belong to the same question, merge them.

If multiple questions are present, return an array of objects.

Otherwise return a single object.

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
Extract the ID if visible (e.g., "Question ID: 12345", "QID 12345").
Otherwise null.

question
Extract only the full question stem (vignette + lead-in).
Do NOT include answer choices.

choosed_alternative
Return the option selected by the student exactly as shown.
Format example: "A. Acute tubular necrosis"

wrong_alternative
Return the correct answer ONLY if the chosen one was wrong.
If the chosen answer was correct, return null.

full_explanation
Extract the entire explanation text shown on the screen.

educational_objective
Extract the Educational Objective section verbatim.

Validate JSON before returning.`;

interface ExtractRequest {
  images: string[];
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
    const { images } = body;

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "No images provided. Please upload at least one screenshot." },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // Build the message content with all images
    const imageMessages: OpenAI.Chat.Completions.ChatCompletionContentPart[] =
      images.map((img) => ({
        type: "image_url" as const,
        image_url: {
          url: img,
          detail: "high" as const,
        },
      }));

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      ...imageMessages,
      {
        type: "text" as const,
        text: "Extract the structured data from these USMLE/UWorld screenshot(s). Return ONLY valid JSON.",
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0,
      max_tokens: 4096,
    });

    const rawAnswer =
      response.choices[0].message.content || '{"error": "No response"}';

    // Try to parse the JSON to validate it
    let parsed;
    try {
      parsed = JSON.parse(rawAnswer);
    } catch {
      // If the model wrapped it in markdown code fences, strip them
      const cleaned = rawAnswer
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // Return raw text if we still can't parse
        return NextResponse.json(
          { result: rawAnswer, parseError: true },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ result: parsed }, { status: 200 });
  } catch (error) {
    console.error("Extract API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Extraction failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
