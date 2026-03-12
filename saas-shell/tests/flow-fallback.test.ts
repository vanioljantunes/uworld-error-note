import { describe, it, expect } from 'vitest';
import { parseFlowHTML } from '../src/lib/parse-flow-html';

// Minimal valid flowchart fixture (linear, 1 box) for positive-case test
const FIXTURE_VALID =
  '<div style="text-align:center">' +
  '<div style="font-size:14px;font-weight:bold;margin-bottom:10px;color:#e2e2e2">Test Chart</div>' +
  '<div style="border:2px solid #3a3a3a;padding:8px 16px;display:inline-block;background:#1a1a1a;color:#e2e2e2;border-radius:4px">Node A</div>' +
  '</div>';

describe('parse-failure detection', () => {
  it('parseFlowHTML returns empty nodes for garbage HTML', () => {
    const result = parseFlowHTML('<div>random garbage</div>');
    expect(result.nodes.length).toBe(0);
  });

  it('parseFlowHTML returns empty nodes for empty string', () => {
    const result = parseFlowHTML('');
    expect(result.nodes.length).toBe(0);
  });

  it('parseFlowHTML returns non-empty nodes for valid flowchart HTML', () => {
    const result = parseFlowHTML(FIXTURE_VALID);
    expect(result.nodes.length).toBeGreaterThan(0);
  });
});
