import { describe, it, expect } from 'vitest';
import { parseFlowHTML } from '../src/lib/parse-flow-html';
import { highlightCloze } from '../src/components/FlowchartEditor';

// Linear 4-box flowchart fixture containing cloze syntax
// Wernicke Encephalopathy Mechanism
// Chronic alcohol use --depletes--> {{c1::Thiamine deficiency}} --impairs--> {{c2::mammillary bodies::anatomy}} --presents as--> Confusion
const FIXTURE_LINEAR =
  '<div style="text-align:center"><div style="font-size:14px;font-weight:bold;margin-bottom:10px;color:#e2e2e2">Wernicke Encephalopathy Mechanism</div>' +
  '<div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">Chronic alcohol use</div>' +
  '<div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div>' +
  '<div style="display:inline-block;padding:2px 10px;font-size:10px;color:#777;font-style:italic;border:1px solid #2a2a2a;border-radius:8px;background:#111">depletes</div>' +
  '<div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div>' +
  '<div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">{{c1::Thiamine deficiency}}</div>' +
  '<div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div>' +
  '<div style="display:inline-block;padding:2px 10px;font-size:10px;color:#777;font-style:italic;border:1px solid #2a2a2a;border-radius:8px;background:#111">impairs</div>' +
  '<div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div>' +
  '<div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">{{c2::mammillary bodies::anatomy}}</div>' +
  '<div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div>' +
  '<div style="display:inline-block;padding:2px 10px;font-size:10px;color:#777;font-style:italic;border:1px solid #2a2a2a;border-radius:8px;background:#111">presents as</div>' +
  '<div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div>' +
  '<div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">Confusion</div>' +
  '</div>';

describe('FLOW-01: FlowchartEditor data flow smoke tests', () => {
  it('parseFlowHTML returns nodes from linear fixture', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    expect(graph.nodes.length).toBeGreaterThan(0);
  });

  it('cloze syntax preserved verbatim in parsed node labels (FLOW-08)', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    const clozeNode = graph.nodes.find((n) => n.label.includes('{{c1::'));
    expect(clozeNode).toBeDefined();
    expect(clozeNode!.label).toBe('{{c1::Thiamine deficiency}}');
  });
});

describe('FLOW-08: highlightCloze smoke tests', () => {
  it('highlightCloze wraps cloze markers — result is array of length 3', () => {
    const result = highlightCloze('Before {{c1::cloze text}} after');
    // Split on /({{c\d+::[^}]*}})/g produces: ['Before ', '{{c1::cloze text}}', ' after']
    expect(Array.isArray(result) ? (result as unknown[]).length : 1).toBe(3);
  });

  it('highlightCloze returns text unchanged without cloze — array of length 1', () => {
    const result = highlightCloze('plain text');
    expect(Array.isArray(result) ? (result as unknown[]).length : 1).toBe(1);
  });
});
