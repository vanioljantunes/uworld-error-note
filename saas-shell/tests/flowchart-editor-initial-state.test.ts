/**
 * flowchart-editor-initial-state.test.ts
 *
 * Unit tests for FlowchartEditor initial state and TOGGLE_VIEW reducer.
 * Validates UX-01: FlowchartEditor opens in Preview mode by default.
 *
 * Covers: UX-01 (Wave 0 Nyquist requirement)
 */

import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { flowReducer, FLOW_INITIAL_STATE } from "@/components/FlowchartEditor";
import type { FlowGraph } from "@/lib/flowchart-types";

// ── FlowState type (mirrors internal type) ────────────────────────────────────

type FlowState = {
  graph: FlowGraph;
  viewMode: "editor" | "preview";
  editingNodeId: string | null;
  selectedNodeId: string | null;
  connectMode: boolean;
  connectingFromId: string | null;
  hasUserEdited: boolean;
  nodeCounter: number;
};

// ── Helper: apply a TOGGLE_VIEW action to a state ─────────────────────────────

function toggleView(state: FlowState): FlowState {
  return produce(state, (draft) => {
    flowReducer(draft as FlowState, { type: "TOGGLE_VIEW" });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("UX-01: FlowchartEditor initial state", () => {
  it("FLOW_INITIAL_STATE.viewMode defaults to 'preview'", () => {
    expect(FLOW_INITIAL_STATE.viewMode).toBe("preview");
  });

  it("dispatching TOGGLE_VIEW from initial state changes viewMode to 'editor'", () => {
    const next = toggleView(FLOW_INITIAL_STATE as FlowState);
    expect(next.viewMode).toBe("editor");
  });

  it("dispatching TOGGLE_VIEW twice returns viewMode to 'preview'", () => {
    const afterFirst = toggleView(FLOW_INITIAL_STATE as FlowState);
    const afterSecond = toggleView(afterFirst);
    expect(afterSecond.viewMode).toBe("preview");
  });
});
