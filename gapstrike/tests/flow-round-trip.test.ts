import { describe, it, expect } from 'vitest';
import { parseFlowHTML } from '../src/lib/parse-flow-html';
import { rebuildHTML } from '../src/lib/rebuild-flow-html';

// Linear 4-box flowchart fixture:
// Wernicke Encephalopathy Mechanism
// Chronic alcohol use --depletes--> {{c1::Thiamine deficiency}} --impairs--> {{c2::mammillary bodies::anatomy}} --presents as--> Confusion
const FIXTURE_LINEAR = '<div style="text-align:center"><div style="font-size:14px;font-weight:bold;margin-bottom:10px;color:#e2e2e2">Wernicke Encephalopathy Mechanism</div><div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">Chronic alcohol use</div><div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div><div style="display:inline-block;padding:2px 10px;font-size:10px;color:#777;font-style:italic;border:1px solid #2a2a2a;border-radius:8px;background:#111">depletes</div><div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div><div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">{{c1::Thiamine deficiency}}</div><div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div><div style="display:inline-block;padding:2px 10px;font-size:10px;color:#777;font-style:italic;border:1px solid #2a2a2a;border-radius:8px;background:#111">impairs</div><div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div><div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">{{c2::mammillary bodies::anatomy}}</div><div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div><div style="display:inline-block;padding:2px 10px;font-size:10px;color:#777;font-style:italic;border:1px solid #2a2a2a;border-radius:8px;background:#111">presents as</div><div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div><div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">Confusion</div></div>';

// Branching fixture: 1 root box branching into 2 children
// Intermediate mesoderm --branches--> [Ureteric bud / Metanephric blastema]
const FIXTURE_BRANCHING = '<div style="text-align:center"><div style="font-size:14px;font-weight:bold;margin-bottom:10px;color:#e2e2e2">Kidney Development</div><div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">Intermediate mesoderm</div><div><div style="width:2px;height:15px;background:#3a3a3a;margin:0 auto"></div></div><div style="display:inline-flex"><div style="text-align:center"><div style="height:15px;border-top:2px solid #3a3a3a;border-left:2px solid #3a3a3a;margin-left:50%"></div><div style="padding:0 16px"><div style="display:inline-block;padding:2px 10px;font-size:10px;color:#777;font-style:italic;border:1px solid #2a2a2a;border-radius:8px;background:#111">induces</div><div><div style="width:2px;height:12px;background:#3a3a3a;margin:0 auto"></div></div><div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">Ureteric bud</div></div></div><div style="text-align:center"><div style="height:15px;border-top:2px solid #3a3a3a;border-right:2px solid #3a3a3a;margin-right:50%"></div><div style="padding:0 16px"><div style="display:inline-block;padding:2px 10px;font-size:10px;color:#777;font-style:italic;border:1px solid #2a2a2a;border-radius:8px;background:#111">differentiates into</div><div><div style="width:2px;height:12px;background:#3a3a3a;margin:0 auto"></div></div><div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">Metanephric blastema</div></div></div></div></div>';

describe('parseFlowHTML — linear fixture', () => {
  it('returns 4 nodes from a 4-box linear flowchart', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    expect(graph.nodes).toHaveLength(4);
  });

  it('returns 3 edges from a 4-box linear flowchart', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    expect(graph.edges).toHaveLength(3);
  });

  it('returns 0 branchGroups from a linear flowchart', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    expect(graph.branchGroups).toHaveLength(0);
  });

  it('extracts the correct title', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    expect(graph.title).toBe('Wernicke Encephalopathy Mechanism');
  });
});

describe('parseFlowHTML — cloze survival', () => {
  it('preserves basic cloze syntax {{c1::text}} verbatim in node label', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    const clozeNode = graph.nodes.find((n) => n.label.includes('{{c1::'));
    expect(clozeNode).toBeDefined();
    expect(clozeNode!.label).toBe('{{c1::Thiamine deficiency}}');
  });

  it('preserves cloze with hint {{c2::term::hint}} verbatim in node label', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    const clozeNode = graph.nodes.find((n) => n.label.includes('{{c2::'));
    expect(clozeNode).toBeDefined();
    expect(clozeNode!.label).toBe('{{c2::mammillary bodies::anatomy}}');
  });
});

describe('parseFlowHTML — branching fixture', () => {
  it('returns 1 branchGroup with parentId pointing to the root node', () => {
    const graph = parseFlowHTML(FIXTURE_BRANCHING);
    expect(graph.branchGroups).toHaveLength(1);
    const rootNode = graph.nodes.find((n) => n.label === 'Intermediate mesoderm');
    expect(rootNode).toBeDefined();
    expect(graph.branchGroups[0].parentId).toBe(rootNode!.id);
  });

  it('stores branch childIds in left-to-right order', () => {
    const graph = parseFlowHTML(FIXTURE_BRANCHING);
    const bg = graph.branchGroups[0];
    expect(bg.childIds).toHaveLength(2);
    const leftNode = graph.nodes.find((n) => n.id === bg.childIds[0]);
    const rightNode = graph.nodes.find((n) => n.id === bg.childIds[1]);
    expect(leftNode!.label).toBe('Ureteric bud');
    expect(rightNode!.label).toBe('Metanephric blastema');
  });
});

// ── Round-trip tests (Plan 02) ────────────────────────────────────────────────

describe('rebuildHTML round-trip', () => {
  it('round-trips linear fixture: parse -> rebuild -> re-parse yields identical node labels and edge labels', () => {
    const original = parseFlowHTML(FIXTURE_LINEAR);
    const rebuilt = rebuildHTML(original);
    const reparsed = parseFlowHTML(rebuilt);

    expect(reparsed.title).toBe(original.title);
    expect(reparsed.nodes).toHaveLength(original.nodes.length);
    expect(reparsed.edges).toHaveLength(original.edges.length);
    expect(reparsed.branchGroups).toHaveLength(original.branchGroups.length);

    // Node labels match in order
    original.nodes.forEach((node, i) => {
      expect(reparsed.nodes[i].label).toBe(node.label);
    });

    // Edge stepLabels match in order
    original.edges.forEach((edge, i) => {
      expect(reparsed.edges[i].stepLabel).toBe(edge.stepLabel);
    });
  });

  it('round-trips branching fixture: parse -> rebuild -> re-parse yields identical branchGroup structure and childIds order', () => {
    const original = parseFlowHTML(FIXTURE_BRANCHING);
    const rebuilt = rebuildHTML(original);
    const reparsed = parseFlowHTML(rebuilt);

    expect(reparsed.branchGroups).toHaveLength(original.branchGroups.length);
    expect(reparsed.nodes).toHaveLength(original.nodes.length);

    // Child node labels are in the same left-to-right order
    original.branchGroups.forEach((group, i) => {
      const reparsedGroup = reparsed.branchGroups[i];
      expect(reparsedGroup.childIds).toHaveLength(group.childIds.length);
      group.childIds.forEach((childId, j) => {
        const originalLabel = original.nodes.find((n) => n.id === childId)!.label;
        const reparsedChildId = reparsedGroup.childIds[j];
        const reparsedLabel = reparsed.nodes.find((n) => n.id === reparsedChildId)!.label;
        expect(reparsedLabel).toBe(originalLabel);
      });
    });
  });

  it('rebuilt HTML contains no newlines between tags', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    const rebuilt = rebuildHTML(graph);
    expect(rebuilt).not.toMatch(/>\s*\n\s*</);
  });

  it('rebuilt HTML contains no <style> blocks', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    const rebuilt = rebuildHTML(graph);
    expect(rebuilt).not.toMatch(/<style/i);
  });

  it('cloze {{c1::text}} and {{c2::term::hint}} survive full round-trip verbatim', () => {
    const graph = parseFlowHTML(FIXTURE_LINEAR);
    const rebuilt = rebuildHTML(graph);
    const reparsed = parseFlowHTML(rebuilt);

    const c1Node = reparsed.nodes.find((n) => n.label.includes('{{c1::'));
    expect(c1Node).toBeDefined();
    expect(c1Node!.label).toBe('{{c1::Thiamine deficiency}}');

    const c2Node = reparsed.nodes.find((n) => n.label.includes('{{c2::'));
    expect(c2Node).toBeDefined();
    expect(c2Node!.label).toBe('{{c2::mammillary bodies::anatomy}}');
  });
});
