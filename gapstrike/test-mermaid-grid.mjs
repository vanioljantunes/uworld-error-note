// Test script: traces through MermaidStructEditor's parseMermaid + assignPositions
// to verify sibling nodes land on the same row.

// ── Copied from MermaidStructEditor.tsx (logic only) ──

function extractBracketLabel(str, startIdx) {
  if (str[startIdx] !== "[") return null;
  let depth = 0, clozeDepth = 0;
  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    if (ch === "{" && i + 1 < str.length && str[i + 1] === "{") { clozeDepth++; i++; }
    else if (ch === "}" && i + 1 < str.length && str[i + 1] === "}") { clozeDepth--; i++; }
    else if (ch === "[" && clozeDepth === 0) depth++;
    else if (ch === "]" && clozeDepth === 0) { depth--; if (depth === 0) return { label: str.substring(startIdx + 1, i), endIdx: i }; }
  }
  return null;
}

function assignPositions(nodes, edges) {
  if (nodes.length === 0) return;
  const children = new Map();
  for (const e of edges) {
    if (!children.has(e.fromId)) children.set(e.fromId, []);
    children.get(e.fromId).push(e.toId);
  }
  const hasIncoming = new Set(edges.map(e => e.toId));
  const roots = nodes.filter(n => !hasIncoming.has(n.id));
  if (roots.length === 0) roots.push(nodes[0]);

  const visited = new Set();
  const occupied = new Set();

  const place = (id, row, col) => {
    if (visited.has(id)) return;
    visited.add(id);
    while (occupied.has(`${row},${col}`)) col++;
    const node = nodes.find(n => n.id === id);
    node.row = row;
    node.col = col;
    occupied.add(`${row},${col}`);
    let childCol = col;
    for (const kid of children.get(id) || []) {
      if (!visited.has(kid)) {
        place(kid, row + 1, childCol);
        const kidNode = nodes.find(n => n.id === kid);
        childCol = Math.max(childCol, kidNode.col) + 1;
      }
    }
  };

  let rootCol = 0;
  for (const root of roots) {
    place(root.id, 0, rootCol);
    rootCol = Math.max(rootCol, root.col) + 1;
  }
  for (const n of nodes) {
    if (!visited.has(n.id)) {
      const maxRow = Math.max(0, ...nodes.filter(x => visited.has(x.id)).map(x => x.row));
      let col = 0;
      while (occupied.has(`${maxRow + 1},${col}`)) col++;
      n.row = maxRow + 1; n.col = col;
      occupied.add(`${n.row},${n.col}`);
      visited.add(n.id);
    }
  }
}

function parseMermaid(value) {
  if (!/```mermaid/i.test(value)) return null;

  const titleParts = value.split(/```mermaid/i);
  const title = (titleParts[0] || "").trim();
  const codeBlock = titleParts[1] || "";
  const code = codeBlock.replace(/```\s*$/, "").trim();

  const lines = code.split("\n");
  let direction = "TD";
  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  const ensureNode = (id, label) => {
    const existing = nodeMap.get(id);
    if (existing) {
      if (existing.label === id && label !== id) existing.label = label;
      return existing;
    }
    const node = { id, label, row: 0, col: 0 };
    nodeMap.set(id, node);
    nodes.push(node);
    return node;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const dirMatch = line.match(/^(?:flowchart|graph)\s+(TD|TB|BT|RL|LR)/i);
    if (dirMatch) { direction = dirMatch[1].toUpperCase(); continue; }
    if (!line || line.startsWith("style") || line.startsWith("classDef") || line.startsWith("%%")) continue;

    const idMatch = line.match(/^([A-Za-z_]\w*)/);
    if (!idMatch) continue;
    const fromId = idMatch[1];
    let pos = idMatch[0].length;

    let fromLabel = fromId;
    if (pos < line.length && line[pos] === "[") {
      const br = extractBracketLabel(line, pos);
      if (br) { fromLabel = br.label; pos = br.endIdx + 1; }
    }
    ensureNode(fromId, fromLabel);

    const rest = line.substring(pos);
    const arrowMatch = rest.match(/\s*(-->)\s*(?:\|([^|]*)\|)?\s*/);
    if (!arrowMatch) continue;
    const edgeLabel = arrowMatch[2] || "";
    pos += (arrowMatch.index || 0) + arrowMatch[0].length;

    const toStr = line.substring(pos).trim();
    const toIdMatch = toStr.match(/^([A-Za-z_]\w*)/);
    if (!toIdMatch) continue;
    const toId = toIdMatch[1];
    let toLabel = toId;
    const tPos = toIdMatch[0].length;
    if (tPos < toStr.length && toStr[tPos] === "[") {
      const br = extractBracketLabel(toStr, tPos);
      if (br) toLabel = br.label;
    }
    ensureNode(toId, toLabel);
    edges.push({ fromId, toId, label: edgeLabel });
  }

  assignPositions(nodes, edges);
  return { title, direction, nodes, edges };
}

// ── ASCII Grid Renderer ──

function renderGrid(graph) {
  const maxRow = Math.max(...graph.nodes.map(n => n.row));
  const maxCol = Math.max(...graph.nodes.map(n => n.col));

  // Strip cloze for display width calc but show in output
  const strip = s => s.replace(/\{\{c\d+::/g, "").replace(/\}\}/g, "");

  // Compute column widths
  const colWidths = [];
  for (let c = 0; c <= maxCol; c++) {
    const nodesInCol = graph.nodes.filter(n => n.col === c);
    colWidths[c] = Math.max(12, ...nodesInCol.map(n => strip(n.label).length + 4));
  }

  const lines = [];
  for (let r = 0; r <= maxRow; r++) {
    const rowNodes = graph.nodes.filter(n => n.row === r).sort((a, b) => a.col - b.col);
    let line = "";
    for (let c = 0; c <= maxCol; c++) {
      const node = rowNodes.find(n => n.col === c);
      if (node) {
        const display = `[${strip(node.label)}]`;
        line += display.padEnd(colWidths[c] + 2);
      } else {
        line += " ".repeat(colWidths[c] + 2);
      }
    }
    lines.push(`  Row ${r}: ${line.trimEnd()}`);

    // Draw arrows between rows
    if (r < maxRow) {
      const edgesDown = graph.edges.filter(e => {
        const from = graph.nodes.find(n => n.id === e.fromId);
        const to = graph.nodes.find(n => n.id === e.toId);
        return from && to && from.row === r && to.row === r + 1;
      });
      if (edgesDown.length > 0) {
        let arrowLine = "";
        for (let c = 0; c <= maxCol; c++) {
          const hasArrow = edgesDown.some(e => {
            const to = graph.nodes.find(n => n.id === e.toId);
            return to && to.col === c;
          });
          if (hasArrow) {
            arrowLine += "  |  ".padEnd(colWidths[c] + 2);
          } else {
            arrowLine += " ".repeat(colWidths[c] + 2);
          }
        }
        lines.push(`        ${arrowLine.trimEnd()}`);
        arrowLine = "";
        for (let c = 0; c <= maxCol; c++) {
          const hasArrow = edgesDown.some(e => {
            const to = graph.nodes.find(n => n.id === e.toId);
            return to && to.col === c;
          });
          if (hasArrow) {
            arrowLine += "  v  ".padEnd(colWidths[c] + 2);
          } else {
            arrowLine += " ".repeat(colWidths[c] + 2);
          }
        }
        lines.push(`        ${arrowLine.trimEnd()}`);
      }
    }
  }
  return lines.join("\n");
}

// ── Test Cases ──

const TEST_1 = `Heparin-Induced Thrombocytopenia Mechanism

\`\`\`mermaid
flowchart TD
    A[Heparin administration] -->|binds| B[Platelet Factor 4 complex]
    B -->|triggers immune response| C[{{c1::IgG antibody formation}}]
    C -->|activates platelets| D[{{c2::Platelet aggregation}}]
    D -->|consumes platelets| E[Thrombocytopenia]
    D -->|paradoxical| F[Thrombosis]
\`\`\``;

const TEST_2 = `Adrenal Cortex Hormone Production

\`\`\`mermaid
flowchart TD
    A[ACTH stimulation] -->|activates| B[{{c1::Adrenal cortex}}]
    B -->|zona glomerulosa secretes| C[Aldosterone]
    B -->|zona fasciculata secretes| D[{{c2::Cortisol}}]
    B -->|zona reticularis secretes| E[Androgens]
    C -->|acts on collecting duct| F[Na+ reabsorption]
\`\`\``;

const TEST_3 = `Renin-Angiotensin-Aldosterone System

\`\`\`mermaid
flowchart TD
    A[Renal hypoperfusion] -->|stimulates JG cells| B[{{c1::Renin release}}]
    B -->|cleaves angiotensinogen| C[Angiotensin I]
    C -->|ACE in lungs converts| D[{{c2::Angiotensin II}}]
    D -->|stimulates adrenal cortex| E[Aldosterone secretion]
    D -->|direct effect on arterioles| F[Vasoconstriction]
    D -->|stimulates posterior pituitary| G[ADH release]
\`\`\``;

// ── Also test a WRONG pattern (chained siblings) to confirm it fails ──

const TEST_WRONG = `WRONG: Chained Siblings (should NOT look like this)

\`\`\`mermaid
flowchart TD
    A[ACTH stimulation] -->|activates| B[Adrenal cortex]
    B -->|secretes| C[Aldosterone]
    C -->|also secretes| D[Cortisol]
    D -->|also secretes| E[Androgens]
\`\`\``;

const tests = [
  { name: "Test 1: Linear mechanism (chain is correct here)", input: TEST_1 },
  { name: "Test 2: Branching siblings (C,D,E must be same row)", input: TEST_2 },
  { name: "Test 3: Mixed branch + continuation (E,F,G must be same row)", input: TEST_3 },
  { name: "ANTI-PATTERN: Chained siblings (C,D,E on DIFFERENT rows = BAD)", input: TEST_WRONG },
];

console.log("=" .repeat(70));
console.log("  MermaidStructEditor Grid Position Test");
console.log("=" .repeat(70));

for (const test of tests) {
  console.log(`\n${"─".repeat(70)}`);
  console.log(`  ${test.name}`);
  console.log(`${"─".repeat(70)}`);

  const graph = parseMermaid(test.input);
  if (!graph) { console.log("  PARSE FAILED"); continue; }

  console.log(`\n  Title: ${graph.title}`);
  console.log(`  Nodes: ${graph.nodes.length} | Edges: ${graph.edges.length}`);
  console.log(`\n  Node positions:`);
  for (const n of graph.nodes) {
    const cloze = /\{\{c\d+::/.test(n.label) ? " [CLOZE]" : "";
    console.log(`    ${n.id} → row=${n.row}, col=${n.col}  "${n.label}"${cloze}`);
  }

  // Check siblings
  console.log(`\n  Sibling check (nodes sharing a parent):`);
  const children = new Map();
  for (const e of graph.edges) {
    if (!children.has(e.fromId)) children.set(e.fromId, []);
    children.get(e.fromId).push(e.toId);
  }
  let siblingOk = true;
  for (const [parentId, kids] of children) {
    if (kids.length > 1) {
      const rows = kids.map(k => graph.nodes.find(n => n.id === k)?.row);
      const allSameRow = rows.every(r => r === rows[0]);
      const status = allSameRow ? "PASS (same row)" : "FAIL (different rows!)";
      if (!allSameRow) siblingOk = false;
      console.log(`    ${parentId} → [${kids.join(",")}] rows=[${rows.join(",")}] → ${status}`);
    }
  }
  if (siblingOk) console.log(`    All siblings on same row.`);

  console.log(`\n  Rendered grid:`);
  console.log(renderGrid(graph));
}

console.log(`\n${"=".repeat(70)}`);
console.log("  DONE");
console.log("=".repeat(70));
