"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import styles from "@/app/page.module.css";

interface MermaidStructEditorProps {
  value: string;
  onChange: (val: string) => void;
}

interface MermaidNode {
  id: string;
  label: string;
  row: number;
  col: number;
}

interface MermaidEdge {
  fromId: string;
  toId: string;
  label: string;
}

interface ParsedGraph {
  title: string;
  direction: string;
  nodes: MermaidNode[];
  edges: MermaidEdge[];
}

const DEFAULT_GRAPH: ParsedGraph = {
  title: "{{c1::Topic}}",
  direction: "TD",
  nodes: [
    { id: "A", label: "{{c2::Start}}", row: 0, col: 0 },
    { id: "B", label: "{{c3::End}}", row: 1, col: 0 },
  ],
  edges: [{ fromId: "A", toId: "B", label: "step" }],
};

function extractBracketLabel(str: string, startIdx: number): { label: string; endIdx: number } | null {
  if (str[startIdx] !== "[") return null;
  let depth = 0;
  let clozeDepth = 0;
  let i = startIdx;
  for (; i < str.length; i++) {
    const ch = str[i];
    if (ch === "{" && i + 1 < str.length && str[i + 1] === "{") { clozeDepth++; i++; }
    else if (ch === "}" && i + 1 < str.length && str[i + 1] === "}") { clozeDepth--; i++; }
    else if (ch === "[" && clozeDepth === 0) depth++;
    else if (ch === "]" && clozeDepth === 0) { depth--; if (depth === 0) return { label: str.substring(startIdx + 1, i), endIdx: i }; }
  }
  return null;
}

/** Assign grid positions to nodes via DFS from roots, centering parents above children */
function assignPositions(nodes: MermaidNode[], edges: MermaidEdge[]): void {
  if (nodes.length === 0) return;
  const children = new Map<string, string[]>();
  for (const e of edges) {
    if (!children.has(e.fromId)) children.set(e.fromId, []);
    children.get(e.fromId)!.push(e.toId);
  }
  const hasIncoming = new Set(edges.map((e) => e.toId));
  const roots = nodes.filter((n) => !hasIncoming.has(n.id));
  if (roots.length === 0) roots.push(nodes[0]);

  const visited = new Set<string>();
  const occupied = new Set<string>();

  const place = (id: string, row: number, col: number) => {
    if (visited.has(id)) return;
    visited.add(id);
    while (occupied.has(`${row},${col}`)) col++;
    const node = nodes.find((n) => n.id === id)!;
    node.row = row;
    node.col = col;
    occupied.add(`${row},${col}`);
    let childCol = col;
    const kidNodes: MermaidNode[] = [];
    for (const kid of children.get(id) || []) {
      if (!visited.has(kid)) {
        place(kid, row + 1, childCol);
        const kidNode = nodes.find((n) => n.id === kid)!;
        kidNodes.push(kidNode);
        childCol = Math.max(childCol, kidNode.col) + 1;
      }
    }
    // Center parent above its children for balanced visual layout
    if (kidNodes.length > 1) {
      const minKidCol = Math.min(...kidNodes.map((k) => k.col));
      const maxKidCol = Math.max(...kidNodes.map((k) => k.col));
      const centerCol = Math.round((minKidCol + maxKidCol) / 2);
      if (centerCol !== col && !occupied.has(`${row},${centerCol}`)) {
        occupied.delete(`${row},${col}`);
        node.col = centerCol;
        occupied.add(`${row},${centerCol}`);
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
      const maxRow = Math.max(0, ...nodes.filter((x) => visited.has(x.id)).map((x) => x.row));
      let col = 0;
      while (occupied.has(`${maxRow + 1},${col}`)) col++;
      n.row = maxRow + 1;
      n.col = col;
      occupied.add(`${n.row},${n.col}`);
      visited.add(n.id);
    }
  }
}

/** Group edges into fan-out groups (parent→2+ children on next row) and solo edges */
function groupEdges(edges: MermaidEdge[], nodeMap: Map<string, MermaidNode>) {
  const downwardByParent = new Map<string, MermaidEdge[]>();
  const soloEdges: MermaidEdge[] = [];

  for (const edge of edges) {
    const from = nodeMap.get(edge.fromId);
    const to = nodeMap.get(edge.toId);
    if (!from || !to) continue;
    if (to.row - from.row === 1) {
      if (!downwardByParent.has(edge.fromId)) downwardByParent.set(edge.fromId, []);
      downwardByParent.get(edge.fromId)!.push(edge);
    } else {
      soloEdges.push(edge);
    }
  }

  const fanOuts = new Map<string, MermaidEdge[]>();
  for (const [parentId, group] of downwardByParent) {
    if (group.length >= 2) {
      fanOuts.set(parentId, group);
    } else {
      soloEdges.push(...group);
    }
  }

  return { fanOuts, soloEdges };
}

function parseMermaid(value: string): ParsedGraph {
  if (!/```mermaid/i.test(value)) {
    const plainText = value.replace(/<[^>]*>/g, "").trim();
    return {
      ...DEFAULT_GRAPH,
      title: plainText || DEFAULT_GRAPH.title,
      nodes: DEFAULT_GRAPH.nodes.map((n) => ({ ...n })),
      edges: DEFAULT_GRAPH.edges.map((e) => ({ ...e })),
    };
  }

  const titleParts = value.split(/```mermaid/i);
  const title = (titleParts[0] || "").trim();
  const codeBlock = titleParts[1] || "";
  const code = codeBlock.replace(/```\s*$/, "").trim();

  const lines = code.split("\n");
  let direction = "TD";
  const nodes: MermaidNode[] = [];
  const edges: MermaidEdge[] = [];
  const nodeMap = new Map<string, MermaidNode>();

  const posMap = new Map<string, { row: number; col: number }>();

  const ensureNode = (id: string, label: string) => {
    const existing = nodeMap.get(id);
    if (existing) {
      if (existing.label === id && label !== id) existing.label = label;
      return existing;
    }
    const node: MermaidNode = { id, label, row: 0, col: 0 };
    nodeMap.set(id, node);
    nodes.push(node);
    return node;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const dirMatch = line.match(/^(?:flowchart|graph)\s+(TD|TB|BT|RL|LR)/i);
    if (dirMatch) { direction = dirMatch[1].toUpperCase(); continue; }
    if (!line || line.startsWith("style") || line.startsWith("classDef")) continue;
    // Parse position comments: %% pos <id> <row> <col>
    const posMatch = line.match(/^%%\s*pos\s+(\S+)\s+(\d+)\s+(\d+)/);
    if (posMatch) {
      const existing = nodeMap.get(posMatch[1]);
      if (existing) { existing.row = parseInt(posMatch[2]); existing.col = parseInt(posMatch[3]); }
      else { posMap.set(posMatch[1], { row: parseInt(posMatch[2]), col: parseInt(posMatch[3]) }); }
      continue;
    }
    if (line.startsWith("%%")) continue;

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

  if (edges.length === 0) {
    return {
      title: title || DEFAULT_GRAPH.title, direction,
      nodes: DEFAULT_GRAPH.nodes.map((n) => ({ ...n })),
      edges: DEFAULT_GRAPH.edges.map((e) => ({ ...e })),
    };
  }

  // Apply deferred positions (pos comments parsed before node was created)
  for (const n of nodes) {
    const saved = posMap.get(n.id);
    if (saved) { n.row = saved.row; n.col = saved.col; }
  }
  // Only auto-layout if no position comments were found
  const hasPositions = posMap.size > 0 || nodes.some((n) => n.row !== 0 || n.col !== 0);
  if (!hasPositions) assignPositions(nodes, edges);
  return { title, direction, nodes, edges };
}

function rebuildMermaid(graph: ParsedGraph): string {
  const nodeMap = new Map<string, MermaidNode>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);
  const lines: string[] = [`flowchart ${graph.direction}`];
  for (const edge of graph.edges) {
    const from = nodeMap.get(edge.fromId);
    const to = nodeMap.get(edge.toId);
    const fromLabel = from?.label || edge.fromId;
    const toLabel = to?.label || edge.toId;
    const edgePart = edge.label ? `-->|${edge.label}|` : `-->`;
    lines.push(`    ${edge.fromId}[${fromLabel}] ${edgePart} ${edge.toId}[${toLabel}]`);
  }
  // Encode grid positions as comments so they survive re-parsing
  for (const n of graph.nodes) {
    lines.push(`    %% pos ${n.id} ${n.row} ${n.col}`);
  }
  const mermaidBlock = "```mermaid\n" + lines.join("\n") + "\n```";
  return graph.title ? graph.title + "\n\n" + mermaidBlock : mermaidBlock;
}

function nextNodeId(existingIds: string[]): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const ch of letters) if (!existingIds.includes(ch)) return ch;
  for (const a of letters) for (const b of letters) { const id = a + b; if (!existingIds.includes(id)) return id; }
  return "X" + Date.now();
}

/** Read-only grid preview that matches the editor layout */
export function FlowchartPreview({ value }: { value: string }) {
  const graph = parseMermaid(value);
  const nodeMap = new Map<string, MermaidNode>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);
  const maxRow = graph.nodes.length > 0 ? Math.max(...graph.nodes.map((n) => n.row)) : 0;
  const maxCol = graph.nodes.length > 0 ? Math.max(...graph.nodes.map((n) => n.col)) : 0;

  // Strip cloze markers for display: {{c1::text}} → text
  const stripCloze = (s: string) => s.replace(/\{\{c\d+::/g, "").replace(/\}\}/g, "");

  const { fanOuts, soloEdges } = groupEdges(graph.edges, nodeMap);

  return (
    <div>
      {graph.title && <div className={styles.mermaidPreviewTitle}>{stripCloze(graph.title)}</div>}
      <div
        className={styles.mermaidGrid}
        style={{
          gridTemplateRows: `repeat(${maxRow * 2 + 1}, auto)`,
          gridTemplateColumns: `repeat(${maxCol * 2 + 1}, auto)`,
        }}
      >
        {graph.nodes.map((node) => (
          <div
            key={node.id}
            className={styles.mermaidGridCell}
            style={{ gridRow: node.row * 2 + 1, gridColumn: node.col * 2 + 1 }}
          >
            <div className={styles.mermaidPreviewNode}>{stripCloze(node.label)}</div>
          </div>
        ))}

        {/* Fan-out groups: horizontal bus + individual drops at each child column */}
        {Array.from(fanOuts.entries()).map(([parentId, edges]) => {
          const parent = nodeMap.get(parentId)!;
          const childCols = edges.map((e) => nodeMap.get(e.toId)!.col);
          const allCols = [parent.col, ...childCols];
          const minCol = Math.min(...allCols);
          const maxCol2 = Math.max(...allCols);
          const gapRow = parent.row * 2 + 2;
          return (
            <React.Fragment key={`fan-${parentId}`}>
              <div
                className={styles.mermaidFanBus}
                style={{ gridRow: gapRow, gridColumn: `${minCol * 2 + 1} / ${maxCol2 * 2 + 2}` }}
              />
              {edges.map((edge) => {
                const to = nodeMap.get(edge.toId)!;
                return (
                  <div
                    key={`fan-${edge.fromId}-${edge.toId}`}
                    className={styles.mermaidGridEdgeV}
                    style={{ gridRow: gapRow, gridColumn: to.col * 2 + 1, zIndex: 1 }}
                  >
                    <div className={styles.mermaidEdgeLineV} />
                    {edge.label && <span className={styles.mermaidPreviewEdgeLabel}>{stripCloze(edge.label)}</span>}
                    <div className={styles.mermaidEdgeArrowDown}>↓</div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* Solo edges */}
        {soloEdges.map((edge) => {
          const from = nodeMap.get(edge.fromId);
          const to = nodeMap.get(edge.toId);
          if (!from || !to) return null;
          const dr = to.row - from.row;
          const dc = to.col - from.col;
          if (dc === 0 && Math.abs(dr) === 1) {
            const minRow = Math.min(from.row, to.row);
            return (
              <div key={`e-${edge.fromId}-${edge.toId}`} className={styles.mermaidGridEdgeV}
                style={{ gridRow: minRow * 2 + 2, gridColumn: from.col * 2 + 1 }}>
                <div className={styles.mermaidEdgeLineV} />
                {edge.label && <span className={styles.mermaidPreviewEdgeLabel}>{stripCloze(edge.label)}</span>}
                <div className={styles.mermaidEdgeArrowDown}>{dr > 0 ? "↓" : "↑"}</div>
              </div>
            );
          }
          if (dr === 0 && Math.abs(dc) === 1) {
            const minCol = Math.min(from.col, to.col);
            return (
              <div key={`e-${edge.fromId}-${edge.toId}`} className={styles.mermaidGridEdgeH}
                style={{ gridRow: from.row * 2 + 1, gridColumn: minCol * 2 + 2 }}>
                <div className={styles.mermaidEdgeLineH} />
                {edge.label && <span className={styles.mermaidPreviewEdgeLabel}>{stripCloze(edge.label)}</span>}
                <div className={styles.mermaidEdgeArrowH}>{dc > 0 ? "→" : "←"}</div>
              </div>
            );
          }
          // Branch / diagonal edge — L-shaped connector (solo, non-fan-out)
          if (dr !== 0 && dc !== 0) {
            const gapRow2 = Math.min(from.row, to.row) * 2 + 2;
            const fromColGrid = from.col * 2 + 1;
            const toColGrid = to.col * 2 + 1;
            const targetRight = to.col > from.col;
            return (
              <div key={`e-${edge.fromId}-${edge.toId}`} className={styles.mermaidGridEdgeBranch}
                style={{
                  gridRow: gapRow2,
                  gridColumn: `${Math.min(fromColGrid, toColGrid)} / ${Math.max(fromColGrid, toColGrid) + 1}`,
                }}>
                <div className={styles.mermaidBranchLine} style={targetRight ? { borderLeft: "1px solid rgba(168,156,220,0.5)", borderBottom: "1px solid rgba(168,156,220,0.5)" } : { borderRight: "1px solid rgba(168,156,220,0.5)", borderBottom: "1px solid rgba(168,156,220,0.5)" }} />
                <div className={styles.mermaidBranchBottom} style={{ justifyContent: targetRight ? "flex-end" : "flex-start" }}>
                  {edge.label && <span className={styles.mermaidPreviewEdgeLabel}>{stripCloze(edge.label)}</span>}
                  <div className={styles.mermaidEdgeArrowDown}>{dr > 0 ? "↓" : "↑"}</div>
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

export default function FlowchartEditor({ value, onChange }: MermaidStructEditorProps) {
  const [graph, setGraph] = useState<ParsedGraph>(() => parseMermaid(value));
  const selfEmittedRef = useRef(false);

  useEffect(() => {
    if (selfEmittedRef.current) { selfEmittedRef.current = false; return; }
    setGraph(parseMermaid(value));
  }, [value]);

  const emitChange = useCallback(
    (updated: ParsedGraph) => {
      setGraph(updated);
      selfEmittedRef.current = true;
      onChange(rebuildMermaid(updated));
    },
    [onChange]
  );

  const updateTitle = (v: string) => emitChange({ ...graph, title: v });
  const updateNodeLabel = (nodeId: string, v: string) => {
    emitChange({ ...graph, nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, label: v } : n)) });
  };
  const updateEdgeLabel = (fromId: string, toId: string, v: string) => {
    emitChange({ ...graph, edges: graph.edges.map((e) => (e.fromId === fromId && e.toId === toId ? { ...e, label: v } : e)) });
  };

  const occ = (row: number, col: number, nodes: MermaidNode[]) => nodes.some((n) => n.row === row && n.col === col);

  const addBelow = (nodeId: string) => {
    const node = graph.nodes.find((n) => n.id === nodeId)!;
    let row = node.row + 1;
    while (occ(row, node.col, graph.nodes)) row++;
    const newId = nextNodeId(graph.nodes.map((n) => n.id));
    emitChange({
      ...graph,
      nodes: [...graph.nodes, { id: newId, label: "New", row, col: node.col }],
      edges: [...graph.edges, { fromId: nodeId, toId: newId, label: "" }],
    });
  };

  const addAbove = (nodeId: string) => {
    const node = graph.nodes.find((n) => n.id === nodeId)!;
    let nodes = graph.nodes.map((n) => ({ ...n }));
    if (node.row === 0 || occ(node.row - 1, node.col, nodes)) {
      for (const n of nodes) n.row += 1;
    }
    const target = nodes.find((n) => n.id === nodeId)!;
    const newId = nextNodeId(nodes.map((n) => n.id));
    const updatedEdges = graph.edges.map((e) => (e.toId === nodeId ? { ...e, toId: newId } : e));
    emitChange({
      ...graph,
      nodes: [...nodes, { id: newId, label: "New", row: target.row - 1, col: target.col }],
      edges: [...updatedEdges, { fromId: newId, toId: nodeId, label: "" }],
    });
  };

  const addRight = (nodeId: string) => {
    const node = graph.nodes.find((n) => n.id === nodeId)!;
    let col = node.col + 1;
    while (occ(node.row, col, graph.nodes)) col++;
    const newId = nextNodeId(graph.nodes.map((n) => n.id));
    emitChange({
      ...graph,
      nodes: [...graph.nodes, { id: newId, label: "New", row: node.row, col }],
      edges: [...graph.edges, { fromId: nodeId, toId: newId, label: "" }],
    });
  };

  const addLeft = (nodeId: string) => {
    const node = graph.nodes.find((n) => n.id === nodeId)!;
    let nodes = graph.nodes.map((n) => ({ ...n }));
    if (node.col === 0 || occ(node.row, node.col - 1, nodes)) {
      for (const n of nodes) n.col += 1;
    }
    const target = nodes.find((n) => n.id === nodeId)!;
    const newId = nextNodeId(nodes.map((n) => n.id));
    emitChange({
      ...graph,
      nodes: [...nodes, { id: newId, label: "New", row: target.row, col: target.col - 1 }],
      edges: [...graph.edges, { fromId: newId, toId: nodeId, label: "" }],
    });
  };

  const addStepFromEnd = () => {
    const lastEdge = graph.edges[graph.edges.length - 1];
    const lastNode = lastEdge
      ? graph.nodes.find((n) => n.id === lastEdge.toId)
      : graph.nodes[graph.nodes.length - 1];
    if (!lastNode) return;
    let row = lastNode.row + 1;
    while (occ(row, lastNode.col, graph.nodes)) row++;
    const newId = nextNodeId(graph.nodes.map((n) => n.id));
    emitChange({
      ...graph,
      nodes: [...graph.nodes, { id: newId, label: "New step", row, col: lastNode.col }],
      edges: [...graph.edges, { fromId: lastNode.id, toId: newId, label: "" }],
    });
  };

  const removeEdge = (fromId: string, toId: string) => {
    if (graph.edges.length <= 1) return;
    const updatedEdges = graph.edges.filter((e) => !(e.fromId === fromId && e.toId === toId));
    const usedIds = new Set<string>();
    for (const e of updatedEdges) { usedIds.add(e.fromId); usedIds.add(e.toId); }
    emitChange({ ...graph, nodes: graph.nodes.filter((n) => usedIds.has(n.id)), edges: updatedEdges });
  };

  const removeNode = (nodeId: string) => {
    if (graph.nodes.length <= 1) return;
    const inEdges = graph.edges.filter((e) => e.toId === nodeId);
    const outEdges = graph.edges.filter((e) => e.fromId === nodeId);
    const bridges: MermaidEdge[] = [];
    for (const inc of inEdges) {
      for (const out of outEdges) {
        if (!graph.edges.some((e) => e.fromId === inc.fromId && e.toId === out.toId)) {
          bridges.push({ fromId: inc.fromId, toId: out.toId, label: "" });
        }
      }
    }
    const remainingEdges = graph.edges.filter((e) => e.fromId !== nodeId && e.toId !== nodeId);
    const updatedEdges = [...remainingEdges, ...bridges];
    const updatedNodes = graph.nodes.filter((n) => n.id !== nodeId);
    if (updatedEdges.length > 0) {
      const usedIds = new Set<string>();
      for (const e of updatedEdges) { usedIds.add(e.fromId); usedIds.add(e.toId); }
      emitChange({ ...graph, nodes: updatedNodes.filter((n) => usedIds.has(n.id)), edges: updatedEdges });
    } else {
      emitChange({ ...graph, nodes: [updatedNodes[0]], edges: [] });
    }
  };

  // Build lookup
  const nodeMap = new Map<string, MermaidNode>();
  for (const n of graph.nodes) nodeMap.set(n.id, n);

  const maxRow = graph.nodes.length > 0 ? Math.max(...graph.nodes.map((n) => n.row)) : 0;
  const maxCol = graph.nodes.length > 0 ? Math.max(...graph.nodes.map((n) => n.col)) : 0;

  const { fanOuts: editorFanOuts, soloEdges: editorSoloEdges } = groupEdges(graph.edges, nodeMap);

  return (
    <div className={styles.mermaidStructEditor}>
      <input
        className={styles.mermaidTitleInput}
        value={graph.title}
        onChange={(e) => updateTitle(e.target.value)}
        placeholder="Card title (supports {{c1::cloze}})"
        spellCheck={false}
      />

      {/* CSS Grid — nodes at (row*2+1, col*2+1), edges in gaps between */}
      <div
        className={styles.mermaidGrid}
        style={{
          gridTemplateRows: `repeat(${maxRow * 2 + 1}, auto)`,
          gridTemplateColumns: `repeat(${maxCol * 2 + 1}, auto)`,
        }}
      >
        {/* Render nodes */}
        {graph.nodes.map((node) => (
          <div
            key={node.id}
            className={styles.mermaidGridCell}
            style={{ gridRow: node.row * 2 + 1, gridColumn: node.col * 2 + 1 }}
          >
            <div className={styles.mermaidNode}>
              <button className={`${styles.mermaidHandle} ${styles.mermaidHandleTop}`} onClick={() => addAbove(node.id)} type="button" title="Add above" />
              <button className={`${styles.mermaidHandle} ${styles.mermaidHandleRight}`} onClick={() => addRight(node.id)} type="button" title="Add right" />
              <button className={`${styles.mermaidHandle} ${styles.mermaidHandleBottom}`} onClick={() => addBelow(node.id)} type="button" title="Add below" />
              <button className={`${styles.mermaidHandle} ${styles.mermaidHandleLeft}`} onClick={() => addLeft(node.id)} type="button" title="Add left" />
              <input
                className={styles.mermaidNodeInput}
                value={node.label}
                onChange={(e) => updateNodeLabel(node.id, e.target.value)}
                spellCheck={false}
              />
              {graph.nodes.length > 1 && (
                <button className={styles.mermaidNodeDeleteBtn} onClick={() => removeNode(node.id)} type="button" title="Delete node">×</button>
              )}
            </div>
          </div>
        ))}

        {/* Fan-out groups: horizontal bus + individual drops at each child column */}
        {Array.from(editorFanOuts.entries()).map(([parentId, edges]) => {
          const parent = nodeMap.get(parentId)!;
          const childCols = edges.map((e) => nodeMap.get(e.toId)!.col);
          const allCols = [parent.col, ...childCols];
          const minCol = Math.min(...allCols);
          const maxCol2 = Math.max(...allCols);
          const gapRow = parent.row * 2 + 2;
          return (
            <React.Fragment key={`fan-${parentId}`}>
              <div
                className={styles.mermaidFanBus}
                style={{ gridRow: gapRow, gridColumn: `${minCol * 2 + 1} / ${maxCol2 * 2 + 2}` }}
              />
              {edges.map((edge) => {
                const to = nodeMap.get(edge.toId)!;
                return (
                  <div
                    key={`fan-${edge.fromId}-${edge.toId}`}
                    className={styles.mermaidGridEdgeV}
                    style={{ gridRow: gapRow, gridColumn: to.col * 2 + 1, zIndex: 1 }}
                  >
                    <div className={styles.mermaidEdgeLineV} />
                    <div className={styles.mermaidEdgeLabelRow}>
                      <input
                        className={styles.mermaidEdgeLabelInput}
                        value={edge.label}
                        onChange={(e) => updateEdgeLabel(edge.fromId, edge.toId, e.target.value)}
                        placeholder="label"
                        spellCheck={false}
                      />
                      {graph.edges.length > 1 && (
                        <button className={styles.mermaidRemoveBtn} onClick={() => removeEdge(edge.fromId, edge.toId)} type="button" title="Remove">×</button>
                      )}
                    </div>
                    <div className={styles.mermaidEdgeArrowDown}>↓</div>
                  </div>
                );
              })}
            </React.Fragment>
          );
        })}

        {/* Solo edges */}
        {editorSoloEdges.map((edge) => {
          const from = nodeMap.get(edge.fromId);
          const to = nodeMap.get(edge.toId);
          if (!from || !to) return null;
          const dr = to.row - from.row;
          const dc = to.col - from.col;

          // Vertical adjacent
          if (dc === 0 && Math.abs(dr) === 1) {
            const minRow = Math.min(from.row, to.row);
            return (
              <div
                key={`e-${edge.fromId}-${edge.toId}`}
                className={styles.mermaidGridEdgeV}
                style={{ gridRow: minRow * 2 + 2, gridColumn: from.col * 2 + 1 }}
              >
                <div className={styles.mermaidEdgeLineV} />
                <div className={styles.mermaidEdgeLabelRow}>
                  <input
                    className={styles.mermaidEdgeLabelInput}
                    value={edge.label}
                    onChange={(e) => updateEdgeLabel(edge.fromId, edge.toId, e.target.value)}
                    placeholder="label"
                    spellCheck={false}
                  />
                  {graph.edges.length > 1 && (
                    <button className={styles.mermaidRemoveBtn} onClick={() => removeEdge(edge.fromId, edge.toId)} type="button" title="Remove">×</button>
                  )}
                </div>
                <div className={styles.mermaidEdgeArrowDown}>{dr > 0 ? "↓" : "↑"}</div>
              </div>
            );
          }

          // Horizontal adjacent
          if (dr === 0 && Math.abs(dc) === 1) {
            const minCol = Math.min(from.col, to.col);
            return (
              <div
                key={`e-${edge.fromId}-${edge.toId}`}
                className={styles.mermaidGridEdgeH}
                style={{ gridRow: from.row * 2 + 1, gridColumn: minCol * 2 + 2 }}
              >
                <div className={styles.mermaidEdgeLineH} />
                <div className={styles.mermaidEdgeLabelRow}>
                  <input
                    className={styles.mermaidEdgeLabelInput}
                    value={edge.label}
                    onChange={(e) => updateEdgeLabel(edge.fromId, edge.toId, e.target.value)}
                    placeholder="label"
                    spellCheck={false}
                  />
                  {graph.edges.length > 1 && (
                    <button className={styles.mermaidRemoveBtn} onClick={() => removeEdge(edge.fromId, edge.toId)} type="button" title="Remove">×</button>
                  )}
                </div>
                <div className={styles.mermaidEdgeArrowH}>{dc > 0 ? "→" : "←"}</div>
              </div>
            );
          }

          // Branch / diagonal edge — L-shaped connector (solo, non-fan-out)
          if (dr !== 0 && dc !== 0) {
            const gapRow = Math.min(from.row, to.row) * 2 + 2;
            const fromColGrid = from.col * 2 + 1;
            const toColGrid = to.col * 2 + 1;
            const targetRight = to.col > from.col;
            return (
              <div
                key={`e-${edge.fromId}-${edge.toId}`}
                className={styles.mermaidGridEdgeBranch}
                style={{
                  gridRow: gapRow,
                  gridColumn: `${Math.min(fromColGrid, toColGrid)} / ${Math.max(fromColGrid, toColGrid) + 1}`,
                }}
              >
                <div className={styles.mermaidBranchLine} style={targetRight ? { borderLeft: "1px solid rgba(168,156,220,0.5)", borderBottom: "1px solid rgba(168,156,220,0.5)" } : { borderRight: "1px solid rgba(168,156,220,0.5)", borderBottom: "1px solid rgba(168,156,220,0.5)" }} />
                <div className={styles.mermaidBranchBottom} style={{ justifyContent: targetRight ? "flex-end" : "flex-start" }}>
                  <div className={styles.mermaidEdgeLabelRow}>
                    <input
                      className={styles.mermaidEdgeLabelInput}
                      value={edge.label}
                      onChange={(e) => updateEdgeLabel(edge.fromId, edge.toId, e.target.value)}
                      placeholder="label"
                      spellCheck={false}
                    />
                    {graph.edges.length > 1 && (
                      <button className={styles.mermaidRemoveBtn} onClick={() => removeEdge(edge.fromId, edge.toId)} type="button" title="Remove">×</button>
                    )}
                  </div>
                  <div className={styles.mermaidEdgeArrowDown}>{dr > 0 ? "↓" : "↑"}</div>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      <button className={styles.mermaidAddBtn} onClick={addStepFromEnd} type="button">
        + Add step
      </button>
    </div>
  );
}
