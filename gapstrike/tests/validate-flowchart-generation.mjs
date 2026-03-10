/**
 * Temporary validation script for Plan 08-02, Task 1.
 *
 * Generates 5 flowcharts from diverse USMLE-style extractions using the
 * live GPT-4o API and validates each output via parseFlowHTML.
 *
 * Run from gapstrike/:
 *   node tests/validate-flowchart-generation.mjs
 *
 * Requires OPENAI_API_KEY in .env.local (or environment).
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load env vars from .env.local
function loadEnv() {
  try {
    const envPath = path.join(ROOT, '.env.local');
    const text = readFileSync(envPath, 'utf8');
    for (const line of text.split('\n')) {
      const match = line.match(/^([A-Z_]+)\s*=\s*(.+)$/);
      if (match) process.env[match[1]] = match[2].trim();
    }
  } catch {
    // no .env.local
  }
}
loadEnv();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY not set');
  process.exit(1);
}

// ─── Template (from template-defaults.ts — replicated inline) ────────────────
// We read the file and extract the anki_flowchart content via a simple parse
// to avoid TypeScript compilation overhead in this script.
function extractFlowchartTemplate() {
  const src = readFileSync(path.join(ROOT, 'src/lib/template-defaults.ts'), 'utf8');
  // Find the anki_flowchart slug section — get the content field
  const slugIdx = src.indexOf('"anki_flowchart"');
  if (slugIdx === -1) throw new Error('anki_flowchart slug not found');

  // After the slug, find content: `...`
  const contentStart = src.indexOf('content: `', slugIdx);
  if (contentStart === -1) throw new Error('content backtick not found');

  // Find the matching closing backtick (accounts for escaped backticks if any)
  let i = contentStart + 10; // skip 'content: `'
  while (i < src.length) {
    if (src[i] === '`') {
      // check it's not escaped
      let backslashes = 0;
      let j = i - 1;
      while (j >= 0 && src[j] === '\\') { backslashes++; j--; }
      if (backslashes % 2 === 0) break;
    }
    i++;
  }

  const rawContent = src.slice(contentStart + 10, i);
  // Unescape template literal escapes
  return rawContent.replace(/\\`/g, '`').replace(/\\\$/g, '$');
}

const FLOWCHART_TEMPLATE = extractFlowchartTemplate();

// ─── Parse template sections ─────────────────────────────────────────────────
function parseTemplateSections(template) {
  if (!template.includes('<!-- section:')) return null;
  const sections = {};
  const parts = template.split(/<!--\s*section:\s*/i);
  for (const part of parts.slice(1)) {
    const endComment = part.indexOf('-->');
    if (endComment === -1) continue;
    const name = part.substring(0, endComment).trim();
    const content = part.substring(endComment + 3).trim();
    sections[name] = content;
  }
  return Object.keys(sections).length > 0 ? sections : null;
}

function buildPrompt(noteContent, sections) {
  const system = sections['System Prompt'];
  const instructions = sections['Instructions'] || '';
  const cardStructure = sections['Card Structure'] || '';
  const rules = sections['Rules'] || '';

  const user = `${instructions}

## Selected Content
${noteContent}
${cardStructure ? `\n## Example Card\n${cardStructure}` : ''}
${rules ? `\n## Rules\n${rules}` : ''}

Return JSON:
{
  "success": true,
  "front": "<card front content>",
  "back": "<card back content>"
}`;

  return { system, user };
}

// ─── Simple parseFlowHTML (browser-like via jsdom) ───────────────────────────
// We inline a minimal parser instead of loading jsdom here
// to keep the script dependency-free. We use jsdom via a dynamic require.
async function parseFlowHTML(html) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`);
  const doc = dom.window.document;
  const wrapper = doc.body.firstElementChild;
  if (!wrapper) return { title: '', nodes: [], edges: [], branchGroups: [] };

  function getRole(el) {
    const style = (el.getAttribute('style') || '').replace(/\s+/g, ' ').trim();
    if (style.includes('font-weight:bold') && style.includes('font-size:14px')) return 'title';
    if (style.includes('display:inline-flex')) return 'branch';
    if (style.includes('display:inline-block') && style.includes('border:2px solid #3a3a3a')) return 'box';
    if (style.includes('display:inline-block') && style.includes('font-size:10px')) return 'pill';
    if (el.children.length === 1) {
      const cs = (el.children[0].getAttribute('style') || '').replace(/\s+/g, ' ').trim();
      if (cs.includes('width:2px') && cs.includes('background:#3a3a3a')) return 'stemWrap';
    }
    return 'unknown';
  }

  const nodes = [];
  const edges = [];
  const branchGroups = [];
  const counter = { value: 0 };
  let title = '';
  let lastNodeId = null;
  let pendingPill = null;

  for (const el of Array.from(wrapper.children)) {
    const role = getRole(el);

    if (role === 'title') { title = (el.textContent || '').trim(); continue; }

    if (role === 'box') {
      const id = 'n' + counter.value++;
      const label = (el.textContent || '').trim();
      nodes.push({ id, label });
      if (lastNodeId !== null && pendingPill !== null) {
        edges.push({ fromId: lastNodeId, toId: id, stepLabel: pendingPill });
        pendingPill = null;
      }
      lastNodeId = id;
      continue;
    }

    if (role === 'pill') {
      pendingPill = (el.textContent || '').trim();
      continue;
    }

    if (role === 'stemWrap') continue;

    if (role === 'branch') {
      const parentId = lastNodeId;
      if (!parentId) continue;
      const childIds = [];

      for (const armOuter of Array.from(el.children)) {
        let paddingWrapper = null;
        for (const child of Array.from(armOuter.children)) {
          const s = (child.getAttribute('style') || '').replace(/\s+/g, ' ').trim();
          if (s.includes('padding:0 16px')) { paddingWrapper = child; break; }
        }
        if (!paddingWrapper) continue;

        let parentToChildPill = null;
        let firstBoxInArm = null;
        let armLastNodeId = null;
        let armPendingPill = null;

        for (const armEl of Array.from(paddingWrapper.children)) {
          const armRole = getRole(armEl);
          if (armRole === 'pill') {
            if (firstBoxInArm === null) parentToChildPill = (armEl.textContent || '').trim();
            else armPendingPill = (armEl.textContent || '').trim();
          } else if (armRole === 'stemWrap') {
            // skip
          } else if (armRole === 'box') {
            const id = 'n' + counter.value++;
            const label = (armEl.textContent || '').trim();
            nodes.push({ id, label });
            if (firstBoxInArm === null) {
              firstBoxInArm = id;
              if (parentToChildPill !== null) {
                edges.push({ fromId: parentId, toId: id, stepLabel: parentToChildPill });
                parentToChildPill = null;
              }
            } else if (armLastNodeId !== null && armPendingPill !== null) {
              edges.push({ fromId: armLastNodeId, toId: id, stepLabel: armPendingPill });
              armPendingPill = null;
            }
            armLastNodeId = id;
          }
        }
        if (firstBoxInArm !== null) childIds.push(firstBoxInArm);
      }
      branchGroups.push({ parentId, childIds });
      continue;
    }
  }

  return { title, nodes, edges, branchGroups };
}

// ─── Call OpenAI ──────────────────────────────────────────────────────────────
async function generateFlowchart(noteContent) {
  const sections = parseTemplateSections(FLOWCHART_TEMPLATE);
  const { system, user } = buildPrompt(noteContent, sections);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      max_tokens: 2048,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${err}`);
  }

  const data = await response.json();
  const raw = data.choices[0].message.content || '';

  // Strip markdown fences if present
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

// ─── Validation helpers ───────────────────────────────────────────────────────
function hasClozeOnTriggerOrLeaf(nodes, edges, branchGroups) {
  if (nodes.length === 0) return false;

  const clozeRegex = /\{\{c\d+::/;

  // Find trigger: node with no incoming edges
  const nodesWithIncoming = new Set(edges.map(e => e.toId));
  const trigger = nodes.find(n => !nodesWithIncoming.has(n.id));
  if (trigger && clozeRegex.test(trigger.label)) return true;

  // Find primary chain leaves: nodes with no outgoing edges AND not branch children
  // Branch children (arm leaves) are allowed to be clozed — they represent the
  // distinguishing mechanism within their branch arm (e.g., Bradykinin in ACE inhibitor).
  const branchChildIds = new Set(branchGroups.flatMap(bg => bg.childIds));
  const nodesWithOutgoing = new Set(edges.map(e => e.fromId));
  const primaryLeaves = nodes.filter(n => !nodesWithOutgoing.has(n.id) && !branchChildIds.has(n.id));

  if (primaryLeaves.some(l => clozeRegex.test(l.label))) return true;
  return false;
}

// Only "leads to", "causes", "then", "results in" are explicitly forbidden by Rule 14
// "presents as" and "manifests as" are valid domain vocabulary (Anatomy/Clinical)
const GENERIC_ARROWS = /^(leads to|causes|then|results in|giving rise to)$/i;

function hasGenericArrowLabels(edges) {
  return edges.some(e => GENERIC_ARROWS.test(e.stepLabel.trim()));
}

// ─── USMLE extractions ───────────────────────────────────────────────────────
const EXTRACTIONS = [
  {
    domain: 'Pathophysiology (Heart Failure)',
    text: `A 68-year-old man with chronic hypertension presents with dyspnea on exertion, bilateral lower extremity edema, and orthopnea. Echocardiography shows an ejection fraction of 35%.

Educational objective: Explain why increased afterload in systolic heart failure leads to pulmonary edema and peripheral edema via the Frank-Starling mechanism breakdown.

Wrong alternative most chosen: Students often pick "decreased preload" as the primary cause of edema, missing that the failing ventricle backs up blood into the pulmonary and systemic venous circulation.`,
  },
  {
    domain: 'Pharmacology (Beta-blocker mechanism)',
    text: `A patient with chronic stable angina is started on metoprolol. His heart rate decreases and angina episodes resolve.

Educational objective: Explain how beta-1 receptor blockade by metoprolol reduces myocardial oxygen demand to relieve angina. The key steps: metoprolol binds beta-1 receptors on the SA node and myocardium, reducing heart rate and contractility, which decreases myocardial O2 demand. Additionally, the slower heart rate prolongs diastole, improving coronary perfusion. Together these effects relieve ischemia and prevent angina. The distinguishing step from non-selective beta-blockers is beta-1 selectivity that spares bronchial beta-2 receptors.

Wrong alternative most chosen: Students pick "coronary vasodilation" as the mechanism, missing that beta-blockers primarily work by reducing the heart's oxygen demand, not by increasing supply.`,
  },
  {
    domain: 'Infectious Disease (TB granuloma)',
    text: `A 32-year-old immigrant presents with night sweats, weight loss, and hemoptysis for 3 months. Chest CT shows upper lobe cavitary lesion. AFB smear positive.

Educational objective: Explain how Mycobacterium tuberculosis survives inside macrophages and activates granuloma formation, ultimately producing caseous necrosis. The distinguishing step is that M. tb inhibits phagosome-lysosome fusion, allowing intracellular survival and triggering Th1 immune response. M. tb is phagocytosed → inhibits phagosome-lysosome fusion → survives intracellularly → activates Th1 CD4 T cells → stimulates macrophage walling-off → produces granuloma → undergoes caseous necrosis (immune-mediated, not direct bacterial toxicity).

Wrong alternative most chosen: Students pick "exotoxin-mediated tissue destruction" missing that lung damage is immune-mediated (Th1 hypersensitivity), not directly bacterial.`,
  },
  {
    domain: 'Renal (Nephrotic syndrome)',
    text: `A 4-year-old boy presents with periorbital edema worse in the morning, ascites, and massive proteinuria (>3.5 g/day). Serum albumin is 1.8 g/dL.

Educational objective: Explain the mechanism linking proteinuria to edema in nephrotic syndrome. The distinguishing step is that loss of albumin reduces oncotic pressure, leading to third-spacing of fluid — not a primary sodium retention problem.

Wrong alternative most chosen: Students pick "decreased GFR causing salt retention" missing that the initial driver of edema is hypoalbuminemia reducing plasma oncotic pressure.`,
  },
  {
    domain: 'Neurology (Myasthenia gravis)',
    text: `A 28-year-old woman presents with ptosis and diplopia that worsen throughout the day and improve with rest. Ice pack test is positive. Anti-AChR antibodies are detected.

Educational objective: Explain why fatigable muscle weakness occurs in myasthenia gravis. The distinguishing step is that autoantibodies against nicotinic AChR reduce the number of functional receptors at the neuromuscular junction, so repeated nerve stimulation leads to progressive failure of neuromuscular transmission.

Wrong alternative most chosen: Students pick "decreased ACh synthesis" missing that the defect is at the receptor level (antibody-mediated destruction and endocytosis of AChR), not at the presynaptic neurotransmitter synthesis level.`,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Plan 08-02 Task 1: Flowchart Generation Validation ===\n');

  const results = [];
  let allPassed = true;

  for (let i = 0; i < EXTRACTIONS.length; i++) {
    const ext = EXTRACTIONS[i];
    console.log(`[${i + 1}/5] ${ext.domain}`);
    console.log('  Calling GPT-4o...');

    try {
      const card = await generateFlowchart(ext.text);
      const html = card.front || '';

      if (!html || !html.includes('div')) {
        console.log('  FAIL: front HTML is empty or not a div-based flowchart');
        results.push({ domain: ext.domain, passed: false, reason: 'Empty or non-div HTML', html: html.slice(0, 200) });
        allPassed = false;
        continue;
      }

      const graph = await parseFlowHTML(html);
      const nodeCount = graph.nodes.length;
      const clozeOnTriggerLeaf = hasClozeOnTriggerOrLeaf(graph.nodes, graph.edges, graph.branchGroups);
      const genericArrows = hasGenericArrowLabels(graph.edges);

      const checks = {
        nodeCount5Plus: nodeCount >= 5,
        nodeCount7OrLess: nodeCount <= 7,
        noClozeOnTriggerOrLeaf: !clozeOnTriggerLeaf,
        noDomainSpecificArrows: !genericArrows,
      };

      const passed = Object.values(checks).every(Boolean);
      if (!passed) allPassed = false;

      const edgeLabels = graph.edges.map(e => e.stepLabel).join(', ');
      const clozeNodes = graph.nodes.filter(n => n.label.includes('{{c'));

      console.log(`  Nodes: ${nodeCount} ${checks.nodeCount5Plus && checks.nodeCount7OrLess ? '✓' : '✗ (expected 5-7)'}`);
      console.log(`  Edges: ${graph.edges.length}`);
      console.log(`  Arrow labels: ${edgeLabels} ${checks.noDomainSpecificArrows ? '✓' : '✗ (generic arrows found)'}`);
      console.log(`  Cloze nodes (${clozeNodes.length}): ${clozeNodes.map(n => n.label).join(' | ')}`);
      console.log(`  Cloze on trigger/leaf: ${clozeOnTriggerLeaf ? '✗ YES (bad)' : '✓ no'}`);
      console.log(`  BranchGroups: ${graph.branchGroups.length}`);
      console.log(`  Status: ${passed ? 'PASS' : 'FAIL'}`);

      if (!passed) {
        console.log(`  Failed checks: ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
        console.log(`  HTML (first 500 chars): ${html.slice(0, 500)}`);
      }

      results.push({ domain: ext.domain, passed, nodeCount, edgeLabels, clozeNodes: clozeNodes.map(n => n.label), checks });
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      results.push({ domain: ext.domain, passed: false, reason: err.message });
      allPassed = false;
    }
    console.log('');
  }

  console.log('=== Summary ===');
  results.forEach((r, i) => {
    console.log(`  [${i + 1}] ${r.domain}: ${r.passed ? 'PASS' : 'FAIL'}`);
  });
  console.log(`\nOverall: ${allPassed ? 'ALL 5 PASS' : 'SOME FAILURES — see above'}`);

  if (!allPassed) process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
