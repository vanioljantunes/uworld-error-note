import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });
    }

    const { text } = await request.json();
    if (!text) {
      return NextResponse.json({ title: "Untitled" }, { status: 200 });
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a title generator. Given a medical educational objective or explanation, produce a concise title of 2-6 words that captures the core medical concept. Return ONLY the title text, nothing else. No quotes, no punctuation at the end.",
        },
        { role: "user", content: text },
      ],
      temperature: 0,
      max_tokens: 20,
    });

    const title = response.choices[0].message.content?.trim() || "Untitled";
    return NextResponse.json({ title }, { status: 200 });
  } catch {
    return NextResponse.json({ title: "Untitled" }, { status: 200 });
  }
}
