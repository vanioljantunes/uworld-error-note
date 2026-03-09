"use client";
import React, { useEffect } from "react";
import { useImmerReducer } from "use-immer";
import { parseFlowHTML } from "@/lib/parse-flow-html";
import { rebuildHTML } from "@/lib/rebuild-flow-html";
import type { FlowGraph, FlowNode, FlowEdge } from "@/lib/flowchart-types";
import styles from "./FlowchartEditor.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type FlowState = { graph: FlowGraph; viewMode: "editor" | "preview" };

type FlowAction = { type: "LOAD"; graph: FlowGraph } | { type: "TOGGLE_VIEW" };

const EMPTY_GRAPH: FlowGraph = {
  title: "",
  nodes: [],
  edges: [],
  branchGroups: [],
};

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(draft: FlowState, action: FlowAction): void {
  switch (action.type) {
    case "LOAD":
      draft.graph = action.graph;
      break;
    case "TOGGLE_VIEW":
      draft.viewMode = draft.viewMode === "editor" ? "preview" : "editor";
      break;
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
  const initialState: FlowState = { graph: EMPTY_GRAPH, viewMode: "editor" };
  const [state, dispatch] = useImmerReducer<FlowState, FlowAction>(reducer, initialState);

  useEffect(() => {
    const graph = parseFlowHTML(value);
    dispatch({ type: "LOAD", graph });
  }, [value]);

  // Suppress unused warning — onChange is part of the contract, used when
  // interactive editing is added in future plans.
  void onChange;
  void rebuildHTML;

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
