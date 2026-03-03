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
CRITICAL: Return the FULL text of the option selected by the student — letter AND complete text.
Returning only the letter (e.g. "D") is WRONG. You MUST find the actual answer text.
Look in the answer choices, the explanation, or the educational objective to find the full text.
Format example: "D. Inhibition of acetylcholine release at the neuromuscular junction"
If the screenshot shows highlighted/selected answers, extract the full text of the highlighted one.

wrong_alternative
CRITICAL: Return the FULL text of the correct answer — letter AND complete text.
This is the answer the student SHOULD have picked. Only return if the student got it wrong.
Returning only the letter is WRONG. Find the full answer text from choices or explanation.
Format example: "E. Mammillary bodies"
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

    // ── Post-process: fix letter-only alternatives using explanation ──
    const isLetterOnly = (val: string | null) => {
      if (!val) return false;
      const trimmed = val.trim();
      // Matches patterns like "D", "D.", "D. D", "C. C", single letter answers
      return /^[A-F]\.?\s*[A-F]?\.?$/i.test(trimmed) || trimmed.length <= 4;
    };

    const obj = Array.isArray(parsed) ? parsed[0] : parsed;
    const needsFix =
      obj &&
      (isLetterOnly(obj.choosed_alternative) || isLetterOnly(obj.wrong_alternative)) &&
      (obj.full_explanation || obj.educational_objective || obj.question);

    if (needsFix) {
      try {
        const context = [
          obj.full_explanation ? `Explanation: ${obj.full_explanation}` : "",
          obj.educational_objective ? `Educational Objective: ${obj.educational_objective}` : "",
          obj.question ? `Question: ${obj.question}` : "",
        ].filter(Boolean).join("\n\n");

        const fixPrompt = `Given this USMLE question context, identify the FULL text of these answer choices.

${context}

Student's chosen answer letter: ${obj.choosed_alternative || "unknown"}
Correct answer letter: ${obj.wrong_alternative || "unknown"}

Return ONLY valid JSON with these two fields:
{
  "choosed_alternative": "LETTER. Full text of the student's chosen answer",
  "wrong_alternative": "LETTER. Full text of the correct answer"
}

Find the answer text from the explanation or context. If you cannot determine the full text, return the best description based on context.`;

        const fixResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: fixPrompt }],
          temperature: 0,
          max_tokens: 300,
        });

        const fixRaw = fixResp.choices[0].message.content || "";
        const fixCleaned = fixRaw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
        const fixParsed = JSON.parse(fixCleaned);

        if (fixParsed.choosed_alternative && fixParsed.choosed_alternative.length > 5) {
          obj.choosed_alternative = fixParsed.choosed_alternative;
        }
        if (fixParsed.wrong_alternative && fixParsed.wrong_alternative.length > 5) {
          obj.wrong_alternative = fixParsed.wrong_alternative;
        }
      } catch {
        // If fix fails, keep original values
      }
    }

    return NextResponse.json({ result: Array.isArray(parsed) ? parsed : obj }, { status: 200 });
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
