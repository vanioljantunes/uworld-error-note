import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const TEMPLATE_EXAMPLE = `---
tags:
  - 483921
  - neurology
  - vitamin_deficiency
---

## ❌ What I got wrong

**My choice:** Vitamin B12
**Correct:** Thiamine (Vitamin B1)

## 🔍 Why I got it wrong

I mapped the neurological findings to [[Vitamin B12]] neuropathy instead of recognizing the acute [[Wernicke encephalopathy]] pattern.

## ✅ The key concept

In chronic alcohol use, the **triad of confusion + ataxia + nystagmus** is the classic presentation of [[Wernicke encephalopathy]] caused by [[Thiamine]] deficiency.

> **Anchor:** Confusion + Ataxia + Nystagmus + Alcohol → Thiamine deficiency → Wernicke

## 📌 The rule I must remember

- Wernicke triad = **C**onfusion + **A**taxia + **N**ystagmus (**CAN**)
- Always consider thiamine deficiency first in alcoholic patients with neurological symptoms
- B12 deficiency presents with **subacute** combined degeneration, not an acute triad

## 🔗 Connections

Related topics: [[Neurology]], [[Thiamine]], [[Wernicke encephalopathy]], [[Alcohol use disorder]]`;

const SYSTEM_PROMPT = `You are a medical education specialist who identifies why students get USMLE questions wrong and creates focused error-pattern notes.

You MUST return ONLY valid JSON. No markdown code fences. No explanations outside the JSON.`;

interface GenerateRequest {
  extraction: {
    question_id?: string | null;
    question?: string | null;
    choosed_alternative?: string | null;
    wrong_alternative?: string | null;
    full_explanation?: string | null;
    educational_objective?: string | null;
  };
  questions: Array<{
    question: string;
    options: string[];
    correct: number;
    difficulty: string;
  }>;
  answers: string[];
  template?: string;
}

function buildUserPrompt(body: GenerateRequest): string {
  const ext = body.extraction || {};
  const questionsJson = JSON.stringify(body.questions || []);
  const answersJson = JSON.stringify(body.answers || []);
  const explanation = (ext.full_explanation || "").slice(0, 500);
  const template = body.template || TEMPLATE_EXAMPLE;

  return `Using the original extraction and the user's answers to diagnostic questions,
identify exactly 1 primary knowledge gap and create an Obsidian micro-note for it.

Original extraction:
- question_id: ${ext.question_id ?? "unknown"}
- question_stem: ${ext.question ?? "N/A"}
- choosed_alternative (WRONG): ${ext.choosed_alternative ?? "N/A"}
- correct_answer: ${ext.wrong_alternative ?? "N/A"}
- educational_objective: ${ext.educational_objective ?? "N/A"}
- explanation (summary): ${explanation}

Diagnostic questions asked: ${questionsJson}
User's answers: ${answersJson}

YOUR TASKS:
1. Identify exactly 1 PRIMARY knowledge gap — the single most important concept the user needs to learn.
2. Infer a concise note title in Title Case (e.g., "Snare Vesicle Exocytosis", "Presynaptic vs Postsynaptic Confusion").
3. Determine ONE system tag from: renal, cardio, pulm, neuro, endo, heme-onc, repro, gi, msk, derm, psych, biostats, ethics, micro, pharm, immuno, genetics.
4. Determine 2-4 concept tags in kebab-case.
5. Compose an Obsidian micro-note following this TEMPLATE STRUCTURE (adapt content, don't copy):

${template}

HARD RULES:
- question_id tag MUST be numeric only (e.g. "1017", NOT "uworld_1017")
- YAML frontmatter tags list: [<question_id>, <system_tag>, <concept_tags...>]
- Use [[wikilinks]] naturally in sentences for key medical terms
- Each note focuses on ONE gap only
- Do NOT paste the full question text or full explanation verbatim

Return a JSON object in this exact format:
{
  "notes": [{
    "action": "created",
    "file_path": "<Title Case Name>.md",
    "error_pattern": "<Title Case Name>",
    "tags": ["<question_id>", "<system_tag>", "<concept_tag1>", "<concept_tag2>"],
    "note_content": "<full markdown note including YAML frontmatter>"
  }]
}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as GenerateRequest;

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
      temperature: 0.5,
      max_tokens: 2048,
    });

    const rawAnswer =
      response.choices[0].message.content || '{"notes": []}';

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
    console.error("Generate API error:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: `Note generation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
