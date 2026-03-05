# Mermaid — Structural Template

## FRONT (clinical prompt)

[Symptom / Finding / Concept] → Map the [mechanism / algorithm / pathway]:

Rules for front:
- State the concept or scenario requiring visualization
- Keep to 1-2 lines
- End with "→ Map the mechanism" or "→ Draw the diagnostic algorithm"
- No cloze syntax on Mermaid cards

## BACK (Mermaid diagram + key points)

Use flowchart TD for pathways, algorithms, or decision trees:

<div class="mermaid">
flowchart TD
    A[Trigger / Finding] --> B{Key Decision}
    B -->|Condition A| C[Outcome A]
    B -->|Condition B| D[Outcome B]
    C --> E[Final Step]
    D --> E
</div>
<br>
<b>Key point:</b> [1-sentence mechanistic takeaway]<br>
<b>Pitfall:</b> [Common mistake or mimicker]

Use sequenceDiagram for signal cascades or cell-cell interactions:

<div class="mermaid">
sequenceDiagram
    Cell A->>Cell B: Signal (ligand/receptor)
    Cell B->>Cell C: Downstream effect
    Cell C-->>Cell A: Feedback
</div>
<br>
<b>Key point:</b> [1-sentence takeaway]<br>
<b>Pitfall:</b> [What breaks this cascade]

Rules for back:
- Choose flowchart TD OR sequenceDiagram — whichever best fits the concept
- Keep diagram to 4-8 nodes — readable at a glance
- Label every arrow with the relationship (causes, activates, inhibits, leads to)
- Always include <b>Key point</b> and <b>Pitfall</b> after the diagram using <b> and <br>
- Wrap diagram in <div class="mermaid"> ... </div>
- No markdown code fences — use the HTML div wrapper only
