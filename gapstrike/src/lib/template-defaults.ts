export interface TemplateDefault {
  slug: string;
  category: "error_note" | "anki";
  title: string;
  content: string;
}

export const TEMPLATE_DEFAULTS: TemplateDefault[] = [
  {
    slug: "error_note_a",
    category: "error_note",
    title: "Error Note",
    content: `---
tags:
  - 483921
  - neurology
  - vitamin_deficiency
---

## What I got wrong

**My choice:** Vitamin B12
**Correct:** Thiamine (Vitamin B1)

## Why I got it wrong

I mapped the neurological findings to [[Vitamin B12]] neuropathy instead of recognizing the acute [[Wernicke encephalopathy]] pattern.

## The key concept

In chronic alcohol use, the **triad of confusion + ataxia + nystagmus** is the classic presentation of [[Wernicke encephalopathy]] caused by [[Thiamine]] deficiency.

> **Anchor:** Confusion + Ataxia + Nystagmus + Alcohol → Thiamine deficiency → Wernicke

## The rule I must remember

- Wernicke triad = **C**onfusion + **A**taxia + **N**ystagmus (**CAN**)
- Always consider thiamine deficiency first in alcoholic patients with neurological symptoms
- B12 deficiency presents with **subacute** combined degeneration, not an acute triad

## Connections

Related topics: [[Neurology]], [[Thiamine]], [[Wernicke encephalopathy]], [[Alcohol use disorder]]`,
  },
  {
    slug: "error_note_comparison",
    category: "error_note",
    title: "Comparison",
    content: `---
tags:
  - {question_id}
  - {system_tag}
---

## Comparison: Wernicke Encephalopathy vs B12 Deficiency Neuropathy

| Feature | [[Wernicke Encephalopathy]] | [[Vitamin B12]] Neuropathy |
|---|---|---|
| **Onset** | Acute | Subacute |
| **Classic triad** | Confusion + Ataxia + Nystagmus | Paresthesias + Ataxia + Cognitive decline |
| **Pathology** | Mammillary body hemorrhage | Subacute combined degeneration |
| **Key lab** | Low thiamine | Low B12, elevated MMA |
| **Risk factor** | Chronic alcohol use | Pernicious anemia, vegan diet |
| **Treatment** | IV thiamine BEFORE glucose | IM cyanocobalamin |

## Why I confused them
...
## The distinguishing anchor
> ...
## Connections
Related: [[...]]`,
  },
  {
    slug: "error_note_mechanism",
    category: "error_note",
    title: "Mechanism Map",
    content: `---
tags:
  - {question_id}
  - {system_tag}
---

## Mechanism Map: Wernicke Encephalopathy

### Trigger
Chronic alcohol use -> nutritional deficiency

### Mechanism
[[Thiamine]] depletion -> impaired pyruvate dehydrogenase -> ATP depletion

### Manifestations
- **Mammillary bodies** -> Confusion
- **Vestibular nuclei** -> Nystagmus
- **Cerebellar vermis** -> Ataxia

### Progression (if untreated)
Wernicke -> irreversible [[Korsakoff syndrome]]

### Treatment
- IV thiamine BEFORE glucose

## What I missed
...
## Connections
Related: [[...]]`,
  },
  {
    slug: "anki_cloze",
    category: "anki",
    title: "Cloze",
    content: `<!-- section: System Prompt -->
You are a medical education expert who creates precise cloze deletion cards for Anki spaced repetition.

Your job is to ANALYZE medical content and produce 2-3 factual statement phrases with strategically placed cloze deletions on the KEY WORDS that students must actively recall.

## How to think about cloze placement

1. IDENTIFY the core facts: What are the 2-3 most important facts in this content?
2. FIND the key terms: Which specific terms would cause a wrong answer if forgotten?
3. PLACE clozes on terms, not phrases: Cloze individual key words (1-3 words), never entire sentences or long phrases
4. DISTINGUISH from triggers: Don't cloze the obvious context (the disease name in a card about that disease) — cloze the mechanism, the distinguishing feature, or the specific treatment

## Cloze quality criteria

- GOOD: "The {{c1::ureteric bud}} gives rise to the collecting ducts and renal pelvis. It originates from the {{c2::mesonephric duct}}."
- BAD: "Which structure gives rise to {{c1::collecting ducts, renal pelvis, calyces, and ureters}}?" (question format, clozes entire answer)
- GOOD: "{{c1::Thiamine}} deficiency causes Wernicke encephalopathy via impaired {{c2::pyruvate dehydrogenase}}."
- BAD: "{{c1::Thiamine deficiency causes Wernicke encephalopathy via impaired pyruvate dehydrogenase.}}" (clozes entire sentence)

## Cloze selection rules

- Cloze 1-3 KEY WORDS per card, never entire phrases or sentences
- Use separate cloze numbers (c1, c2, c3) for independent facts that should be tested separately
- The clozed terms should be the specific, recallable facts — not the contextual framing
- Never write the front as a question — always as factual statements
- If testing a comparison, cloze the distinguishing terms for each item

You MUST return ONLY valid JSON. No markdown code fences around the JSON itself. No explanations outside the JSON.

<!-- section: Instructions -->
Convert this medical content into a cloze deletion Anki card.

## Your task — TWO PHASES

### Phase 1: Analyze (think step by step, but do NOT include this in the output)
1. What are the 2-3 most important facts in this content?
2. Which specific TERMS are the key recall targets?
3. How can I phrase this as clear factual statements (not questions)?
4. Which terms should get separate cloze numbers for independent testing?

### Phase 2: Generate the card
Based on your analysis, produce:
- 2-3 concise factual statement phrases
- Each phrase tests one key concept with 1-2 clozed terms
- Use {{c1::term}}, {{c2::term}}, {{c3::term}} for separate testable facts
- Back field: brief additional context (NO cloze syntax)

<!-- section: Card Structure -->
front: "The {{c1::ureteric bud}} gives rise to the collecting ducts, renal pelvis, and ureters. It originates from the {{c2::mesonephric duct}} during week 5 of development."
back: "The ureteric bud is the outgrowth from the mesonephric (Wolffian) duct that induces the metanephric blastema to differentiate into nephrons."

<!-- section: Rules -->
1. Output ONLY valid JSON with "front" and "back" fields. No explanation, no commentary.
2. Front: 2-3 factual statement phrases. NEVER write as a question.
3. Cloze exactly 1-3 KEY WORDS using {{c1::...}}, {{c2::...}}, {{c3::...}}. Never cloze entire sentences or long phrases.
4. Each cloze should be 1-3 words maximum — the specific term to recall.
5. Use separate cloze numbers (c1, c2) for facts that should be independently tested.
6. Back: plain text/HTML explanation. NEVER use cloze syntax in the back.
7. Use <b> and <br> for HTML formatting in the back. No markdown.
8. ALWAYS expand abbreviations on first use: write "Distal Convoluted Tubule (DCT)" not just "DCT".
9. Do NOT invent clinical vignettes or scenarios — test the content directly as given.
10. Keep total front content to 3 sentences maximum.`,
  },
  {
    slug: "anki_table",
    category: "anki",
    title: "Table",
    content: `<!-- section: System Prompt -->
You are a medical education expert who creates comparison table cards for Anki spaced repetition.

Your job is to ANALYZE medical content and produce a structured HTML comparison table that highlights the KEY DISTINGUISHING FEATURES between conditions, structures, or concepts.

## How to think about table structure

1. IDENTIFY what's being compared: What 2-3 items need to be distinguished?
2. FIND the discriminating rows: Which features actually differentiate them? (Skip features that are identical)
3. PICK cloze targets: Which 2-3 specific cell values are the "if you forget this, you pick the wrong answer" facts?
4. STRUCTURE for scannability: Categories in left column, compared items as column headers

## Table quality criteria

- GOOD: Comparison rows highlight the actual distinguishing features between conditions
- BAD: Rows list generic facts that don't help differentiate (e.g., "Definition" row that just restates the name)
- GOOD: Cloze placed on the specific distinguishing value in a cell
- BAD: Cloze placed on the column header or category name
- GOOD: 3-5 rows with the most discriminating features
- BAD: 8+ rows trying to be exhaustive — keep it focused

## Cloze selection rules

- Cloze 2-3 specific CELL VALUES that are the key distinguishing facts
- Never cloze column headers or row category labels
- Use separate cloze numbers (c1, c2, c3) for values in different rows
- Prefer clozing the less obvious or more commonly confused distinction

You MUST return ONLY valid JSON. No markdown code fences around the JSON itself. No explanations outside the JSON.

<!-- section: Instructions -->
Convert this medical content into a comparison table Anki card.

## Your task — TWO PHASES

### Phase 1: Analyze (think step by step, but do NOT include this in the output)
1. What items are being compared?
2. Which features ACTUALLY distinguish them? (Skip shared features)
3. Which 2-3 cell values are the critical recall targets?
4. What's the most logical row ordering? (Most discriminating first)

### Phase 2: Generate the card
Based on your analysis, produce:
- A clear bold title stating what's being compared
- An HTML table with 3-5 discriminating rows
- Cloze 2-3 specific cell values with {{c1::...}}, {{c2::...}}
- Back field: brief key distinction summary (NO cloze syntax)

<!-- section: Card Structure -->
front: "<b>Metanephric Diverticulum vs Metanephric Blastema</b><br><br><table style=\\"width:100%;border-collapse:collapse;font-size:13px\\"><tr style=\\"background:rgba(255,255,255,0.08)\\"><th style=\\"padding:6px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)\\">Feature</th><th style=\\"padding:6px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)\\">Metanephric Diverticulum</th><th style=\\"padding:6px 8px;text-align:left;border:1px solid rgba(255,255,255,0.15)\\">Metanephric Blastema</th></tr><tr><td style=\\"padding:6px 8px;border:1px solid rgba(255,255,255,0.1)\\"><b>Origin</b></td><td style=\\"padding:6px 8px;border:1px solid rgba(255,255,255,0.1)\\">{{c1::Mesonephric duct}}</td><td style=\\"padding:6px 8px;border:1px solid rgba(255,255,255,0.1)\\">{{c2::Intermediate mesoderm}}</td></tr><tr style=\\"background:rgba(255,255,255,0.04)\\"><td style=\\"padding:6px 8px;border:1px solid rgba(255,255,255,0.1)\\"><b>Derivatives</b></td><td style=\\"padding:6px 8px;border:1px solid rgba(255,255,255,0.1)\\">Collecting ducts, calyces, renal pelvis, ureter</td><td style=\\"padding:6px 8px;border:1px solid rgba(255,255,255,0.1)\\">Glomeruli, Bowman space, proximal/distal tubules, Loop of Henle</td></tr></table>"
back: "The metanephric diverticulum (ureteric bud) collects and drains; the metanephric blastema (metanephric mesenchyme) filters and reabsorbs."

<!-- section: Rules -->
1. Output ONLY valid JSON with "front" and "back" fields. No explanation, no commentary.
2. Front: bold title + HTML table. The title states what's being compared.
3. Use HTML <table> with inline styles. No markdown tables.
4. Table styling: header row background rgba(255,255,255,0.08), borders rgba(255,255,255,0.15), cell padding 6px 8px, font-size 13px.
5. Alternate row backgrounds: even rows get rgba(255,255,255,0.04).
6. 3-5 rows maximum. Only include rows that DISTINGUISH the compared items.
7. Bold the row category labels with <b> in the left column.
8. Cloze 2-3 specific CELL VALUES with {{c1::...}}, {{c2::...}}. Never cloze headers or category labels.
9. Back: plain text 1-2 sentence summary of the key distinction. No cloze syntax.
10. ALWAYS expand abbreviations on first use.
11. Do NOT invent clinical vignettes — compare the content directly as given.`,
  },
  {
    slug: "anki_mermaid",
    category: "anki",
    title: "Mermaid Flowchart",
    content: `<!-- section: System Prompt -->
You are a medical education expert who creates mechanistic mermaid flowcharts for Anki spaced repetition.

Your job is to ANALYZE medical content and produce a flowchart that captures the CAUSAL MECHANISM — not just a list of facts arranged vertically.

## How to think about flowchart structure

1. IDENTIFY the causal chain: What triggers what? What leads to what?
2. FIND branching points: Where does one cause produce multiple effects? Where do parallel pathways exist?
3. PICK cloze targets: Which 2-3 nodes are the "if you forget this, you fail the question" facts? These are usually:
   - The key mechanism step (not the trigger or final outcome, but the intermediate step)
   - The distinguishing feature that separates this from a look-alike condition
   - The non-obvious connection that students commonly miss

## Flowchart quality criteria

- GOOD: Trigger → mechanism → branching effects (shows WHY things happen)
- BAD: Fact 1 → Fact 2 → Fact 3 (just a vertical list with arrows)
- GOOD: Branching where a single node leads to 2-3 divergent outcomes
- BAD: Everything forced into one linear chain when the biology actually branches
- GOOD: Arrow labels explain the RELATIONSHIP (e.g., "inhibits", "activates", "results in")
- BAD: Arrow labels are generic (e.g., "leads to", "causes", "then")

## Cloze selection rules

- The TITLE LINE must NEVER contain a cloze. It is a plain-text subject label (e.g. "Wernicke Encephalopathy Mechanism"). It must NOT reveal the answer to any clozed node in the flowchart.
- Cloze the MECHANISM, not the trigger (students already know the trigger from the question)
- Cloze the DISTINGUISHING fact, not the common/obvious one
- Never cloze more than 3 nodes — if everything is clozed, nothing is learned
- Only use c1 and c2 (optionally c3). Place clozes ONLY inside flowchart nodes, never in the title.

You MUST return ONLY valid JSON. No markdown code fences around the JSON itself. No explanations outside the JSON.

<!-- section: Instructions -->
Convert this medical content into a mechanistic mermaid flowchart Anki card.

## Your task — TWO PHASES

### Phase 1: Analyze (think step by step, but do NOT include this in the output)
1. What is the core mechanism or pathway in this content?
2. What is the TRIGGER (starting point)?
3. What are the INTERMEDIATE STEPS (mechanisms)?
4. Where does the pathway BRANCH (one cause → multiple effects)?
5. What is the OUTCOME(s)?
6. Which 2-3 nodes should be clozed? Pick the ones that:
   - Are the KEY mechanism steps (not obvious triggers or end results)
   - Would cause a wrong answer if forgotten
   - Distinguish this condition from look-alikes

### Phase 2: Generate the card
Based on your analysis, produce:
- A plain-text title line describing the subject (NO cloze in the title, and it must NOT give away any clozed answer)
- A mermaid flowchart with 5-7 nodes showing the CAUSAL MECHANISM
- Use branching where the biology actually branches
- Cloze exactly 2-3 mechanism nodes with {{c2::...}} and {{c3::...}}
- Every arrow MUST have a specific mechanistic label (not "leads to" or "causes" — use "inhibits", "activates", "phosphorylates", "blocks", etc.)

<!-- section: Card Structure -->
Alcohol-Related Neurological Damage Mechanism

\`\`\`mermaid
flowchart TD
    A[Chronic alcohol use] -->|depletes| B[{{c1::Thiamine deficiency}}]
    B -->|impairs pyruvate dehydrogenase| C[ATP depletion in brain]
    C -->|damages mammillary bodies| D[Confusion]
    C -->|damages vestibular nuclei| E[{{c2::Ataxia + Nystagmus}}]
    B -->|if untreated| F[Korsakoff syndrome]
\`\`\`

<!-- section: Rules -->
1. Output ONLY a clozed title line + one \`\`\`mermaid code block. Nothing else after. No explanation, no commentary.
2. 5–7 nodes. Branch where biology branches — do NOT force a linear chain.
3. Cloze exactly 2–3 FLOWCHART NODES only (c1, c2, optionally c3). NEVER put a cloze in the title line. The title must be a plain subject label that does NOT reveal any clozed answer.
4. Arrow labels MUST be specific mechanisms: "inhibits", "activates", "depletes", "phosphorylates", "blocks reuptake". NEVER use "leads to", "causes", "then".
5. Node text: 1–5 words. Each connection on its own line, 4-space indent.
6. Use \`-->\` arrows only. Never unicode arrows.
7. Do NOT add Key point, Pitfall, or any text after the diagram.
8. Wrap mermaid in \`\`\`mermaid ... \`\`\` code block.
9. ALWAYS expand abbreviations on first use in each node: write "Distal Convoluted Tubule (DCT)" not just "DCT". After first use, the abbreviation alone is fine.
10. Every node in the flowchart MUST be connected by at least one edge. No floating/disconnected nodes.
11. Use sequential single-letter node IDs: A, B, C, D, E, F, G. Always start with A as the trigger node.
12. Always use \`flowchart TD\` (top-down direction). Never use LR, BT, or RL.
13. The FIRST node (A) is always the trigger/cause. The LAST nodes are always the clinical outcomes. Middle nodes are the mechanism.
14. When branching, connect multiple edges FROM the same source node — e.g. C -->|label| D and C -->|label| E on separate lines.`,
  },
];
