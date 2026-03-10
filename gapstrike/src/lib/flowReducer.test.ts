import { describe, it, expect } from "vitest";
import { produce } from "immer";
import { flowReducer, FLOW_INITIAL_STATE } from "@/components/FlowchartEditor";
import type { FlowGraph } from "@/lib/flowchart-types";

// Helper: runs an action and returns the next state
function runAction(
  state: typeof FLOW_INITIAL_STATE,
  action: Parameters<typeof flowReducer>[1]
) {
  return produce(state, (draft) => flowReducer(draft, action));
}

// Helper: build a minimal FlowState with a given graph
function stateWithGraph(graph: FlowGraph): typeof FLOW_INITIAL_STATE {
  return { ...FLOW_INITIAL_STATE, graph };
}

// ── BUG-01: REMOVE_NODE branch-parent reconnect ───────────────────────────────

describe("REMOVE_NODE — branch parent", () => {
  it("reconnects ALL children to grandparent when removing a branch parent with an incoming edge", () => {
    // Graph: A -> B(branch parent) -> C, D
    const graph: FlowGraph = {
      title: "",
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
      ],
      edges: [
        { fromId: "A", toId: "B", stepLabel: "" },
        { fromId: "B", toId: "C", stepLabel: "left" },
        { fromId: "B", toId: "D", stepLabel: "right" },
      ],
      branchGroups: [{ parentId: "B", childIds: ["C", "D"] }],
    };

    const next = runAction(stateWithGraph(graph), { type: "REMOVE_NODE", id: "B" });

    // B is removed
    expect(next.graph.nodes.find((n) => n.id === "B")).toBeUndefined();

    // A -> C and A -> D edges must exist
    const edgeToC = next.graph.edges.find((e) => e.fromId === "A" && e.toId === "C");
    const edgeToD = next.graph.edges.find((e) => e.fromId === "A" && e.toId === "D");
    expect(edgeToC).toBeDefined();
    expect(edgeToD).toBeDefined();

    // No edges referencing B remain
    expect(next.graph.edges.some((e) => e.fromId === "B" || e.toId === "B")).toBe(false);
  });

  it("removes branchGroup when branch parent has no incoming edge (root branch)", () => {
    // Graph: B(root, branch parent) -> C, D  (no incoming edge to B)
    const graph: FlowGraph = {
      title: "",
      nodes: [
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
      ],
      edges: [
        { fromId: "B", toId: "C", stepLabel: "left" },
        { fromId: "B", toId: "D", stepLabel: "right" },
      ],
      branchGroups: [{ parentId: "B", childIds: ["C", "D"] }],
    };

    const next = runAction(stateWithGraph(graph), { type: "REMOVE_NODE", id: "B" });

    expect(next.graph.nodes.find((n) => n.id === "B")).toBeUndefined();
    // branchGroup for B is removed (children become independent roots)
    expect(next.graph.branchGroups.find((bg) => bg.parentId === "B")).toBeUndefined();
    // No edges reference B
    expect(next.graph.edges.some((e) => e.fromId === "B" || e.toId === "B")).toBe(false);
  });
});

// ── BUG-01: REMOVE_NODE branch-child update ────────────────────────────────────

describe("REMOVE_NODE — branch child", () => {
  it("removes child from branchGroup.childIds; remaining siblings stay connected", () => {
    // Graph: A -> B(branch) -> C, D, E
    const graph: FlowGraph = {
      title: "",
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
        { id: "E", label: "E" },
      ],
      edges: [
        { fromId: "A", toId: "B", stepLabel: "" },
        { fromId: "B", toId: "C", stepLabel: "" },
        { fromId: "B", toId: "D", stepLabel: "" },
        { fromId: "B", toId: "E", stepLabel: "" },
      ],
      branchGroups: [{ parentId: "B", childIds: ["C", "D", "E"] }],
    };

    const next = runAction(stateWithGraph(graph), { type: "REMOVE_NODE", id: "D" });

    expect(next.graph.nodes.find((n) => n.id === "D")).toBeUndefined();

    const bg = next.graph.branchGroups.find((bg) => bg.parentId === "B");
    expect(bg).toBeDefined();
    // D removed, C and E remain
    expect(bg!.childIds).toEqual(["C", "E"]);
  });

  it("collapses branchGroup when only 1 child remains after removal", () => {
    // Graph: A -> B(branch) -> C, D
    const graph: FlowGraph = {
      title: "",
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
      ],
      edges: [
        { fromId: "A", toId: "B", stepLabel: "" },
        { fromId: "B", toId: "C", stepLabel: "left" },
        { fromId: "B", toId: "D", stepLabel: "right" },
      ],
      branchGroups: [{ parentId: "B", childIds: ["C", "D"] }],
    };

    const next = runAction(stateWithGraph(graph), { type: "REMOVE_NODE", id: "D" });

    // branchGroup collapses (1 child left — not a real branch)
    expect(next.graph.branchGroups.find((bg) => bg.parentId === "B")).toBeUndefined();
    // branchGroups array length should be 0
    expect(next.graph.branchGroups.length).toBe(0);
  });

  it("deletes branchGroup entirely when 0 children remain after removal", () => {
    // Graph: A -> B(branch) -> C (only 1 child — edge scenario)
    const graph: FlowGraph = {
      title: "",
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
      ],
      edges: [
        { fromId: "A", toId: "B", stepLabel: "" },
        { fromId: "B", toId: "C", stepLabel: "" },
      ],
      branchGroups: [{ parentId: "B", childIds: ["C"] }],
    };

    const next = runAction(stateWithGraph(graph), { type: "REMOVE_NODE", id: "C" });

    expect(next.graph.nodes.find((n) => n.id === "C")).toBeUndefined();
    // branchGroup with 0 children is deleted
    expect(next.graph.branchGroups.length).toBe(0);
  });
});

// ── BUG-02: ADD_NODE selectedNodeId parent model ───────────────────────────────

describe("ADD_NODE — selectedNodeId parent model", () => {
  it("creates edge from selectedNodeId to new node when selectedNodeId is set, and auto-selects new node", () => {
    const graph: FlowGraph = {
      title: "",
      nodes: [{ id: "n0", label: "Start" }],
      edges: [],
      branchGroups: [],
    };
    const state = { ...stateWithGraph(graph), selectedNodeId: "n0", nodeCounter: 1 };

    const next = runAction(state, { type: "ADD_NODE", label: "New box" });

    // New node exists
    const newNode = next.graph.nodes.find((n) => n.label === "New box");
    expect(newNode).toBeDefined();

    // Edge from selectedNodeId to new node
    const edge = next.graph.edges.find(
      (e) => e.fromId === "n0" && e.toId === newNode!.id
    );
    expect(edge).toBeDefined();

    // New node is auto-selected
    expect(next.selectedNodeId).toBe(newNode!.id);
  });

  it("creates standalone node (no edge) when selectedNodeId is null", () => {
    const graph: FlowGraph = {
      title: "",
      nodes: [{ id: "n0", label: "Start" }],
      edges: [],
      branchGroups: [],
    };
    const state = { ...stateWithGraph(graph), selectedNodeId: null, nodeCounter: 1 };

    const next = runAction(state, { type: "ADD_NODE", label: "Standalone" });

    const newNode = next.graph.nodes.find((n) => n.label === "Standalone");
    expect(newNode).toBeDefined();

    // No edges involving new node
    expect(next.graph.edges.some((e) => e.toId === newNode!.id || e.fromId === newNode!.id)).toBe(false);

    // New node is auto-selected
    expect(next.selectedNodeId).toBe(newNode!.id);
  });

  it("ADD_NODE with afterId still works (existing splice-into-chain behavior preserved)", () => {
    const graph: FlowGraph = {
      title: "",
      nodes: [
        { id: "n0", label: "A" },
        { id: "n1", label: "B" },
      ],
      edges: [{ fromId: "n0", toId: "n1", stepLabel: "step1" }],
      branchGroups: [],
    };
    const state = { ...stateWithGraph(graph), selectedNodeId: null, nodeCounter: 2 };

    const next = runAction(state, { type: "ADD_NODE", label: "Mid", afterId: "n0" });

    const mid = next.graph.nodes.find((n) => n.label === "Mid");
    expect(mid).toBeDefined();
    const midId = mid!.id;

    // n0 -> mid edge
    expect(next.graph.edges.some((e) => e.fromId === "n0" && e.toId === midId)).toBe(true);
    // mid -> n1 edge
    expect(next.graph.edges.some((e) => e.fromId === midId && e.toId === "n1")).toBe(true);
    // No direct n0 -> n1 edge (was spliced)
    expect(next.graph.edges.some((e) => e.fromId === "n0" && e.toId === "n1")).toBe(false);
  });
});
