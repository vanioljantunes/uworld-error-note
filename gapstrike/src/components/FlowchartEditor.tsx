"use client";
import React, { useEffect } from "react";
import { useImmerReducer } from "use-immer";
import { parseFlowHTML } from "@/lib/parse-flow-html";
import { rebuildHTML } from "@/lib/rebuild-flow-html";
import type { FlowGraph, FlowNode, FlowEdge } from "@/lib/flowchart-types";
import styles from "./FlowchartEditor.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

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

const EMPTY_GRAPH: FlowGraph = {
  title: "",
  nodes: [],
  edges: [],
  branchGroups: [],
};

// ── Reducer ───────────────────────────────────────────────────────────────────

export function flowReducer(draft: FlowState, action: FlowAction): void {
  switch (action.type) {
    case "LOAD":
      draft.graph = action.graph;
      draft.hasUserEdited = false;
      draft.nodeCounter = action.graph.nodes.length;
      draft.editingNodeId = null;
      draft.selectedNodeId = null;
      draft.connectMode = false;
      draft.connectingFromId = null;
      break;

    case "TOGGLE_VIEW":
      draft.viewMode = draft.viewMode === "editor" ? "preview" : "editor";
      break;

    case "SET_EDITING_NODE":
      draft.editingNodeId = action.id;
      break;

    case "EDIT_NODE": {
      const node = draft.graph.nodes.find((n) => n.id === action.id);
      if (node) node.label = action.label;
      draft.editingNodeId = null;
      draft.hasUserEdited = true;
      break;
    }

    case "ADD_NODE": {
      const newId = "n" + draft.nodeCounter;
      draft.nodeCounter++;
      draft.graph.nodes.push({ id: newId, label: action.label });

      if (action.afterId) {
        // Splice new node into the chain after afterId:
        // Find the outgoing edge from afterId and redirect it through newId
        const existingEdgeIdx = draft.graph.edges.findIndex(
          (e) => e.fromId === action.afterId
        );
        if (existingEdgeIdx >= 0) {
          const oldToId = draft.graph.edges[existingEdgeIdx].toId;
          draft.graph.edges[existingEdgeIdx].toId = newId;
          draft.graph.edges.push({ fromId: newId, toId: oldToId, stepLabel: "" });
        } else {
          // afterId is a leaf — just add edge from afterId to newId
          draft.graph.edges.push({ fromId: action.afterId, toId: newId, stepLabel: "" });
        }
      } else {
        // Append at end: add edge from current last node (before push) to newId
        // Find nodes with no outgoing edges (leaf nodes)
        const fromIds = new Set(draft.graph.edges.map((e) => e.fromId));
        const nodeIds = draft.graph.nodes
          .filter((n) => n.id !== newId)
          .map((n) => n.id);
        const leafIds = nodeIds.filter((id) => !fromIds.has(id));
        if (leafIds.length > 0) {
          draft.graph.edges.push({ fromId: leafIds[leafIds.length - 1], toId: newId, stepLabel: "" });
        }
      }

      draft.hasUserEdited = true;
      break;
    }

    case "REMOVE_NODE": {
      const inEdge = draft.graph.edges.find((e) => e.toId === action.id);
      const outEdge = draft.graph.edges.find((e) => e.fromId === action.id);

      draft.graph.nodes = draft.graph.nodes.filter((n) => n.id !== action.id);
      draft.graph.edges = draft.graph.edges.filter(
        (e) => e.fromId !== action.id && e.toId !== action.id
      );

      // Reconnect linear chain if both in and out edges existed
      if (inEdge && outEdge) {
        draft.graph.edges.push({
          fromId: inEdge.fromId,
          toId: outEdge.toId,
          stepLabel: "",
        });
      }

      // Clean up branchGroups referencing the removed node
      draft.graph.branchGroups = draft.graph.branchGroups.filter(
        (bg) => bg.parentId !== action.id && !bg.childIds.includes(action.id)
      );

      // Clear selection/editing state if referencing removed node
      if (draft.editingNodeId === action.id) draft.editingNodeId = null;
      if (draft.selectedNodeId === action.id) draft.selectedNodeId = null;
      if (draft.connectingFromId === action.id) draft.connectingFromId = null;

      draft.hasUserEdited = true;
      break;
    }

    case "ADD_EDGE": {
      const exists = draft.graph.edges.some(
        (e) => e.fromId === action.fromId && e.toId === action.toId
      );
      if (!exists) {
        draft.graph.edges.push({
          fromId: action.fromId,
          toId: action.toId,
          stepLabel: action.stepLabel,
        });
      }
      draft.hasUserEdited = true;
      break;
    }

    case "REMOVE_EDGE": {
      draft.graph.edges = draft.graph.edges.filter(
        (e) => !(e.fromId === action.fromId && e.toId === action.toId)
      );
      draft.hasUserEdited = true;
      break;
    }

    case "REORDER_NODE": {
      const idx = draft.graph.nodes.findIndex((n) => n.id === action.id);
      if (idx < 0) break;
      const swapIdx = action.direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= draft.graph.nodes.length) break;
      // Swap labels only — IDs and edges stay intact
      const tempLabel = draft.graph.nodes[idx].label;
      draft.graph.nodes[idx].label = draft.graph.nodes[swapIdx].label;
      draft.graph.nodes[swapIdx].label = tempLabel;
      draft.hasUserEdited = true;
      break;
    }
  }
}

// ── Props interface (must match existing contract) ────────────────────────────

interface FlowchartEditorProps {
  value: string;
  onChange: (val: string) => void;
}

// ── highlightCloze (named export for testing) ─────────────────────────────────

export function highlightCloze(label: string): React.ReactNode {
  const parts = label.split(/({{c\d+::[^}]*}})/g);
  return parts.map((part, i) => {
    if (/^{{c\d+::/.test(part)) {
      return (
        <span key={i} className={styles.clozeHighlight}>
          {part}
        </span>
      );
    }
    return part;
  });
}

// ── NodeCard ──────────────────────────────────────────────────────────────────

function NodeCard({ node }: { node: FlowNode }) {
  return (
    <div className={styles.nodeCard}>{highlightCloze(node.label)}</div>
  );
}

// ── EdgePill ──────────────────────────────────────────────────────────────────

function EdgePill({ label }: { label: string }) {
  if (!label) return null;
  return <div className={styles.pill}>{label}</div>;
}

// ── FlowRenderer ──────────────────────────────────────────────────────────────

function FlowRenderer({ graph }: { graph: FlowGraph }) {
  const toIds = new Set(graph.edges.map((e) => e.toId));
  const rootNode = graph.nodes.find((n) => !toIds.has(n.id));
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const branchMap = new Map(graph.branchGroups.map((g) => [g.parentId, g.childIds]));

  // Build outgoing edge map grouped by fromId
  const outgoing = new Map<string, FlowEdge[]>();
  for (const edge of graph.edges) {
    if (!outgoing.has(edge.fromId)) outgoing.set(edge.fromId, []);
    outgoing.get(edge.fromId)!.push(edge);
  }

  if (!rootNode) {
    return <div className={styles.errorState}>Empty flowchart</div>;
  }

  const visited = new Set<string>();

  function renderNode(nodeId: string): React.ReactNode {
    if (visited.has(nodeId)) return null;
    visited.add(nodeId);

    const node = nodeById.get(nodeId);
    if (!node) return null;

    const childIds = branchMap.get(nodeId);

    if (childIds && childIds.length > 0) {
      // Branch node
      return (
        <React.Fragment key={nodeId}>
          <NodeCard node={node} />
          <div className={styles.stem} />
          <div className={styles.branchWrapper}>
            {childIds.map((childId, i) => {
              const edge = graph.edges.find(
                (e) => e.fromId === nodeId && e.toId === childId
              );
              const stepLabel = edge ? edge.stepLabel : "";

              let cornerClass: string;
              if (i === 0) {
                cornerClass = styles.branchCornerLeft;
              } else if (i === childIds.length - 1) {
                cornerClass = styles.branchCornerRight;
              } else {
                cornerClass = styles.branchCornerMiddle;
              }

              return (
                <div key={childId} className={styles.branchArm}>
                  <div className={cornerClass} />
                  <div className={styles.branchPadding}>
                    <EdgePill label={stepLabel} />
                    <div className={styles.stem} />
                    {renderNode(childId)}
                  </div>
                </div>
              );
            })}
          </div>
        </React.Fragment>
      );
    }

    const outs = outgoing.get(nodeId);
    if (outs && outs.length > 0) {
      // Linear: follow first outgoing edge
      const { toId, stepLabel } = outs[0];
      return (
        <React.Fragment key={nodeId}>
          <NodeCard node={node} />
          <div className={styles.stem} />
          <EdgePill label={stepLabel} />
          <div className={styles.stem} />
          {renderNode(toId)}
        </React.Fragment>
      );
    }

    // Leaf node
    return <NodeCard key={nodeId} node={node} />;
  }

  return (
    <div className={styles.canvas}>{renderNode(rootNode.id)}</div>
  );
}

// ── FlowchartPreview (named export — FlowView.tsx depends on this) ─────────────

export function FlowchartPreview({ value }: { value: string }) {
  return (
    <div
      className={styles.previewContainer}
      dangerouslySetInnerHTML={{ __html: value }}
    />
  );
}

// ── FlowchartEditor (default export) ─────────────────────────────────────────

export default function FlowchartEditor({ value, onChange }: FlowchartEditorProps) {
  const initialState: FlowState = {
    graph: EMPTY_GRAPH,
    viewMode: "editor",
    editingNodeId: null,
    selectedNodeId: null,
    connectMode: false,
    connectingFromId: null,
    hasUserEdited: false,
    nodeCounter: 0,
  };
  const [state, dispatch] = useImmerReducer<FlowState, FlowAction>(flowReducer, initialState);

  useEffect(() => {
    const graph = parseFlowHTML(value);
    dispatch({ type: "LOAD", graph });
  }, [value]);

  // Wire onChange: only call after user mutations (hasUserEdited guard prevents
  // infinite loop on LOAD — LOAD resets hasUserEdited to false)
  useEffect(() => {
    if (state.hasUserEdited) {
      onChange(rebuildHTML(state.graph));
    }
  }, [state.graph, state.hasUserEdited]);

  return (
    <div className={styles.editorRoot}>
      <div className={styles.editorHeader}>
        <span className={styles.editorTitle}>
          {state.graph.title || "Flowchart"}
        </span>
        <button
          className={styles.toggleBtn}
          onClick={() => dispatch({ type: "TOGGLE_VIEW" })}
          type="button"
        >
          {state.viewMode === "editor" ? "Preview in Anki" : "Back to Editor"}
        </button>
      </div>
      {state.viewMode === "preview" ? (
        <FlowchartPreview value={value} />
      ) : (
        <FlowRenderer graph={state.graph} />
      )}
    </div>
  );
}
