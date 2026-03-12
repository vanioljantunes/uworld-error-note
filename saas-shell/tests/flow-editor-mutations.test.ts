/**
 * flow-editor-mutations.test.ts
 *
 * Unit tests for FlowchartEditor reducer mutation actions.
 * Tests the pure reducer logic without React rendering.
 *
 * Covers: FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07, FLOW-09
 */

import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { flowReducer } from "@/components/FlowchartEditor";
import { rebuildHTML } from "@/lib/rebuild-flow-html";
import type { FlowGraph } from "@/lib/flowchart-types";

// ── FlowState type (mirrors the internal type exported via reducer) ─────────────

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

type FlowAction =
  | { type: "LOAD"; graph: FlowGraph }
  | { type: "TOGGLE_VIEW" }
  | { type: "EDIT_NODE"; id: string; label: string }
  | { type: "ADD_NODE"; label: string; afterId?: string }
  | { type: "REMOVE_NODE"; id: string }
  | { type: "ADD_EDGE"; fromId: string; toId: string; stepLabel: string }
  | { type: "REMOVE_EDGE"; fromId: string; toId: string }
  | { type: "REORDER_NODE"; id: string; direction: "up" | "down" }
  | { type: "SET_EDITING_NODE"; id: string | null };

// ── Helper: apply action to state using immer ─────────────────────────────────

function apply(state: FlowState, action: FlowAction): FlowState {
  return produce(state, (draft) => {
    flowReducer(draft as FlowState, action as FlowAction);
  });
}

// ── Fixture: 3-node linear graph n0 → n1 → n2 ────────────────────────────────

function makeLinearGraph(): FlowGraph {
  return {
    title: "Test Flow",
    nodes: [
      { id: "n0", label: "Alpha" },
      { id: "n1", label: "Beta" },
      { id: "n2", label: "Gamma" },
    ],
    edges: [
      { fromId: "n0", toId: "n1", stepLabel: "" },
      { fromId: "n1", toId: "n2", stepLabel: "" },
    ],
    branchGroups: [],
  };
}

function makeInitialState(graph: FlowGraph): FlowState {
  return {
    graph,
    viewMode: "editor",
    editingNodeId: null,
    selectedNodeId: null,
    connectMode: false,
    connectingFromId: null,
    hasUserEdited: false,
    nodeCounter: graph.nodes.length,
  };
}

// ── LOAD action ───────────────────────────────────────────────────────────────

describe("LOAD action", () => {
  it("sets hasUserEdited to false and resets nodeCounter", () => {
    const graph = makeLinearGraph();
    const state = makeInitialState({ title: "", nodes: [], edges: [], branchGroups: [] });
    const next = apply(state, { type: "LOAD", graph });
    expect(next.hasUserEdited).toBe(false);
    expect(next.nodeCounter).toBe(3);
    expect(next.graph.nodes).toHaveLength(3);
  });

  it("resets hasUserEdited after prior mutations", () => {
    const graph = makeLinearGraph();
    let state = makeInitialState(graph);
    state = apply(state, { type: "EDIT_NODE", id: "n0", label: "Changed" });
    expect(state.hasUserEdited).toBe(true);
    const freshGraph = makeLinearGraph();
    const next = apply(state, { type: "LOAD", graph: freshGraph });
    expect(next.hasUserEdited).toBe(false);
  });
});

// ── EDIT_NODE action ──────────────────────────────────────────────────────────

describe("EDIT_NODE action (FLOW-02)", () => {
  it("mutates the target node label", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "EDIT_NODE", id: "n0", label: "New Text" });
    expect(next.graph.nodes[0].label).toBe("New Text");
  });

  it("sets hasUserEdited to true", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "EDIT_NODE", id: "n0", label: "New Text" });
    expect(next.hasUserEdited).toBe(true);
  });

  it("clears editingNodeId after commit", () => {
    let state = makeInitialState(makeLinearGraph());
    state = apply(state, { type: "SET_EDITING_NODE", id: "n0" });
    const next = apply(state, { type: "EDIT_NODE", id: "n0", label: "Done" });
    expect(next.editingNodeId).toBeNull();
  });

  it("does not mutate other nodes", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "EDIT_NODE", id: "n0", label: "Changed" });
    expect(next.graph.nodes[1].label).toBe("Beta");
    expect(next.graph.nodes[2].label).toBe("Gamma");
  });

  it("is a no-op for unknown id", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "EDIT_NODE", id: "n99", label: "Ghost" });
    expect(next.graph.nodes.map((n) => n.label)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(next.hasUserEdited).toBe(true);
  });
});

// ── ADD_NODE action ───────────────────────────────────────────────────────────

describe("ADD_NODE action (FLOW-03)", () => {
  it("appends to end when no afterId given (2-node graph, selectedNodeId=leaf)", () => {
    const graph: FlowGraph = {
      title: "Test",
      nodes: [
        { id: "n0", label: "Alpha" },
        { id: "n1", label: "Beta" },
      ],
      edges: [{ fromId: "n0", toId: "n1", stepLabel: "" }],
      branchGroups: [],
    };
    // selectedNodeId parent model: UI sets selectedNodeId to the leaf before ADD_NODE
    const state = { ...makeInitialState(graph), selectedNodeId: "n1" };
    const next = apply(state, { type: "ADD_NODE", label: "Tail" });
    expect(next.graph.nodes).toHaveLength(3);
    expect(next.graph.nodes[2].label).toBe("Tail");
    // Edge from selectedNodeId (n1) to new node
    const newId = next.graph.nodes[2].id;
    const edge = next.graph.edges.find((e) => e.toId === newId);
    expect(edge).toBeDefined();
    expect(edge?.fromId).toBe("n1");
  });

  it("inserts between B and C when afterId=n1 in A->B->C", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "ADD_NODE", label: "New Box", afterId: "n1" });
    expect(next.graph.nodes).toHaveLength(4);
    const newNode = next.graph.nodes.find((n) => n.label === "New Box")!;
    expect(newNode).toBeDefined();
    // Edge n1 -> newNode should exist
    expect(next.graph.edges.some((e) => e.fromId === "n1" && e.toId === newNode.id)).toBe(true);
    // Edge newNode -> n2 should exist
    expect(next.graph.edges.some((e) => e.fromId === newNode.id && e.toId === "n2")).toBe(true);
    // No direct edge n1 -> n2 anymore
    expect(next.graph.edges.some((e) => e.fromId === "n1" && e.toId === "n2")).toBe(false);
  });

  it("increments nodeCounter", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "ADD_NODE", label: "Extra" });
    expect(next.nodeCounter).toBe(state.nodeCounter + 1);
  });

  it("uses nodeCounter for ID (no collision after remove+add)", () => {
    // Remove n1 (middle), then add a new node — ID must not be "n1" (reuse) or "n2" (collision)
    const state = makeInitialState(makeLinearGraph());
    const afterRemove = apply(state, { type: "REMOVE_NODE", id: "n1" });
    // nodeCounter stays at 3 (only increments on add)
    const afterAdd = apply(afterRemove, { type: "ADD_NODE", label: "Safe" });
    const newId = afterAdd.graph.nodes.find((n) => n.label === "Safe")?.id;
    expect(newId).toBeDefined();
    // Must not collide with n0 or n2
    const allIds = afterAdd.graph.nodes.map((n) => n.id);
    expect(new Set(allIds).size).toBe(allIds.length); // all unique
  });

  it("sets hasUserEdited to true", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "ADD_NODE", label: "X" });
    expect(next.hasUserEdited).toBe(true);
  });
});

// ── REMOVE_NODE action ────────────────────────────────────────────────────────

describe("REMOVE_NODE action (FLOW-04)", () => {
  it("removes the target node", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REMOVE_NODE", id: "n1" });
    expect(next.graph.nodes.map((n) => n.id)).not.toContain("n1");
    expect(next.graph.nodes).toHaveLength(2);
  });

  it("removes edges touching the removed node", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REMOVE_NODE", id: "n1" });
    expect(next.graph.edges.some((e) => e.fromId === "n1" || e.toId === "n1")).toBe(false);
  });

  it("reconnects linear chain A->C when removing B from A->B->C", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REMOVE_NODE", id: "n1" });
    expect(next.graph.edges.some((e) => e.fromId === "n0" && e.toId === "n2")).toBe(true);
  });

  it("removes branchGroup when branch parent is removed", () => {
    const graph: FlowGraph = {
      title: "Branch",
      nodes: [
        { id: "n0", label: "Root" },
        { id: "n1", label: "Branch Parent" },
        { id: "n2", label: "Child A" },
        { id: "n3", label: "Child B" },
      ],
      edges: [
        { fromId: "n0", toId: "n1", stepLabel: "" },
        { fromId: "n1", toId: "n2", stepLabel: "path A" },
        { fromId: "n1", toId: "n3", stepLabel: "path B" },
      ],
      branchGroups: [{ parentId: "n1", childIds: ["n2", "n3"] }],
    };
    const state = makeInitialState(graph);
    const next = apply(state, { type: "REMOVE_NODE", id: "n1" });
    expect(next.graph.branchGroups.some((bg) => bg.parentId === "n1")).toBe(false);
  });

  it("removes branchGroup when a childId is removed", () => {
    const graph: FlowGraph = {
      title: "Branch",
      nodes: [
        { id: "n0", label: "Root" },
        { id: "n1", label: "Parent" },
        { id: "n2", label: "Child A" },
        { id: "n3", label: "Child B" },
      ],
      edges: [
        { fromId: "n0", toId: "n1", stepLabel: "" },
        { fromId: "n1", toId: "n2", stepLabel: "path A" },
        { fromId: "n1", toId: "n3", stepLabel: "path B" },
      ],
      branchGroups: [{ parentId: "n1", childIds: ["n2", "n3"] }],
    };
    const state = makeInitialState(graph);
    const next = apply(state, { type: "REMOVE_NODE", id: "n2" });
    // branchGroup containing n2 as childId should be removed
    expect(next.graph.branchGroups.some((bg) => bg.childIds.includes("n2"))).toBe(false);
  });

  it("sets hasUserEdited to true", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REMOVE_NODE", id: "n1" });
    expect(next.hasUserEdited).toBe(true);
  });
});

// ── ADD_EDGE action ───────────────────────────────────────────────────────────

describe("ADD_EDGE action (FLOW-05)", () => {
  it("creates an edge between two nodes", () => {
    const graph: FlowGraph = {
      title: "Test",
      nodes: [
        { id: "n0", label: "A" },
        { id: "n1", label: "B" },
        { id: "n2", label: "C" },
      ],
      edges: [{ fromId: "n0", toId: "n1", stepLabel: "" }],
      branchGroups: [],
    };
    const state = makeInitialState(graph);
    const next = apply(state, { type: "ADD_EDGE", fromId: "n0", toId: "n2", stepLabel: "activates" });
    const edge = next.graph.edges.find((e) => e.fromId === "n0" && e.toId === "n2");
    expect(edge).toBeDefined();
    expect(edge?.stepLabel).toBe("activates");
  });

  it("does not create duplicate edge", () => {
    const state = makeInitialState(makeLinearGraph());
    // n0->n1 already exists
    const next = apply(state, { type: "ADD_EDGE", fromId: "n0", toId: "n1", stepLabel: "" });
    const edgeCount = next.graph.edges.filter((e) => e.fromId === "n0" && e.toId === "n1").length;
    expect(edgeCount).toBe(1);
  });

  it("sets hasUserEdited to true", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "ADD_EDGE", fromId: "n2", toId: "n0", stepLabel: "" });
    expect(next.hasUserEdited).toBe(true);
  });
});

// ── REMOVE_EDGE action ────────────────────────────────────────────────────────

describe("REMOVE_EDGE action (FLOW-06)", () => {
  it("removes edge by fromId+toId", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REMOVE_EDGE", fromId: "n0", toId: "n1" });
    expect(next.graph.edges.some((e) => e.fromId === "n0" && e.toId === "n1")).toBe(false);
  });

  it("leaves other edges intact", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REMOVE_EDGE", fromId: "n0", toId: "n1" });
    expect(next.graph.edges.some((e) => e.fromId === "n1" && e.toId === "n2")).toBe(true);
  });

  it("sets hasUserEdited to true", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REMOVE_EDGE", fromId: "n0", toId: "n1" });
    expect(next.hasUserEdited).toBe(true);
  });
});

// ── REORDER_NODE action ───────────────────────────────────────────────────────

describe("REORDER_NODE action (FLOW-07)", () => {
  it("swaps labels between n1 and n0 when moving n1 up", () => {
    const state = makeInitialState(makeLinearGraph());
    // n0=Alpha, n1=Beta, n2=Gamma — move n1 up swaps n0 and n1 labels
    const next = apply(state, { type: "REORDER_NODE", id: "n1", direction: "up" });
    const n0 = next.graph.nodes.find((n) => n.id === "n0")!;
    const n1 = next.graph.nodes.find((n) => n.id === "n1")!;
    expect(n0.label).toBe("Beta");
    expect(n1.label).toBe("Alpha");
    // n2 unchanged
    expect(next.graph.nodes.find((n) => n.id === "n2")?.label).toBe("Gamma");
  });

  it("swaps labels between n1 and n2 when moving n1 down", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REORDER_NODE", id: "n1", direction: "down" });
    const n1 = next.graph.nodes.find((n) => n.id === "n1")!;
    const n2 = next.graph.nodes.find((n) => n.id === "n2")!;
    expect(n1.label).toBe("Gamma");
    expect(n2.label).toBe("Beta");
  });

  it("is a no-op when moving first node up (boundary)", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REORDER_NODE", id: "n0", direction: "up" });
    // Labels unchanged
    expect(next.graph.nodes.map((n) => n.label)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("is a no-op when moving last node down (boundary)", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REORDER_NODE", id: "n2", direction: "down" });
    expect(next.graph.nodes.map((n) => n.label)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("sets hasUserEdited to true on valid reorder", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REORDER_NODE", id: "n1", direction: "up" });
    expect(next.hasUserEdited).toBe(true);
  });
});

// ── SET_EDITING_NODE action ───────────────────────────────────────────────────

describe("SET_EDITING_NODE action", () => {
  it("sets editingNodeId", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "SET_EDITING_NODE", id: "n1" });
    expect(next.editingNodeId).toBe("n1");
  });

  it("clears editingNodeId when null", () => {
    let state = makeInitialState(makeLinearGraph());
    state = apply(state, { type: "SET_EDITING_NODE", id: "n1" });
    const next = apply(state, { type: "SET_EDITING_NODE", id: null });
    expect(next.editingNodeId).toBeNull();
  });
});

// ── FLOW-09: rebuildHTML integration ──────────────────────────────────────────

describe("rebuildHTML integration (FLOW-09)", () => {
  it("produces HTML containing new label after EDIT_NODE", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "EDIT_NODE", id: "n0", label: "Edited Label" });
    const html = rebuildHTML(next.graph);
    expect(html).toContain("Edited Label");
  });

  it("produces HTML containing new node label after ADD_NODE", () => {
    // selectedNodeId parent model: select leaf (n2) so new node is connected and renderable
    const state = { ...makeInitialState(makeLinearGraph()), selectedNodeId: "n2" };
    const next = apply(state, { type: "ADD_NODE", label: "Brand New Node" });
    const html = rebuildHTML(next.graph);
    expect(html).toContain("Brand New Node");
  });

  it("does not contain removed node label after REMOVE_NODE", () => {
    const state = makeInitialState(makeLinearGraph());
    const next = apply(state, { type: "REMOVE_NODE", id: "n1" });
    const html = rebuildHTML(next.graph);
    expect(html).not.toContain("Beta");
    expect(html).toContain("Alpha");
    expect(html).toContain("Gamma");
  });

  it("returns a non-empty string for a valid graph", () => {
    const state = makeInitialState(makeLinearGraph());
    const html = rebuildHTML(state.graph);
    expect(typeof html).toBe("string");
    expect(html.length).toBeGreaterThan(0);
  });
});
