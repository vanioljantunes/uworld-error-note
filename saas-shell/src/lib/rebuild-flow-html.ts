import { FlowGraph, FlowNode } from './flowchart-types';
import { FLOWCHART_STYLES } from './flowchart-styles';

/**
 * Rebuild a compact inline-style Anki HTML string from a FlowGraph.
 * CRITICAL: No newlines between tags — AnkiDroid converts \n to <br> on edit,
 * which would corrupt the diagram structure.
 */
export function rebuildHTML(graph: FlowGraph): string {
  // Build adjacency: fromId -> [{toId, stepLabel}]
  const outgoing = new Map<string, Array<{ toId: string; stepLabel: string }>>();
  for (const edge of graph.edges) {
    if (!outgoing.has(edge.fromId)) {
      outgoing.set(edge.fromId, []);
    }
    outgoing.get(edge.fromId)!.push({ toId: edge.toId, stepLabel: edge.stepLabel });
  }

  // Build branch lookup: parentId -> childIds[]
  const branchMap = new Map<string, string[]>();
  for (const group of graph.branchGroups) {
    branchMap.set(group.parentId, group.childIds);
  }

  // Find root node: the node whose id does not appear as any edge's toId
  const toIds = new Set(graph.edges.map((e) => e.toId));
  const rootNode = graph.nodes.find((n) => !toIds.has(n.id));

  if (!rootNode) {
    // Fallback: empty or single-node graph
    if (graph.nodes.length === 1) {
      return (
        `<div style="${FLOWCHART_STYLES.wrapper}">` +
        `<div style="${FLOWCHART_STYLES.title}">${graph.title}</div>` +
        emitBox(graph.nodes[0]) +
        `</div>`
      );
    }
    return `<div style="${FLOWCHART_STYLES.wrapper}"><div style="${FLOWCHART_STYLES.title}">${graph.title}</div></div>`;
  }

  // Node lookup by id
  const nodeById = new Map<string, FlowNode>(graph.nodes.map((n) => [n.id, n]));

  // Track visited nodes to avoid infinite loops
  const visited = new Set<string>();

  function emitNode(nodeId: string): string {
    if (visited.has(nodeId)) return '';
    visited.add(nodeId);

    const node = nodeById.get(nodeId);
    if (!node) return '';

    let html = emitBox(node);

    const childIds = branchMap.get(nodeId);
    if (childIds && childIds.length > 0) {
      // Branch node: emit stem then branch wrapper
      html += emitStem();
      html += `<div style="${FLOWCHART_STYLES.branchWrapper}">`;

      for (let i = 0; i < childIds.length; i++) {
        const childId = childIds[i];
        // Find the edge from parent to this child
        const edgeToChild = graph.edges.find(
          (e) => e.fromId === nodeId && e.toId === childId
        );
        const stepLabel = edgeToChild ? edgeToChild.stepLabel : '';

        // Corner style: left for first child, right for last child.
        // For middle children (3+): top border only, no left/right, no margin.
        // Note: 3-child branching is a stretch case.
        let cornerStyle: string;
        if (i === 0) {
          cornerStyle = FLOWCHART_STYLES.branchCornerLeft;
        } else if (i === childIds.length - 1) {
          cornerStyle = FLOWCHART_STYLES.branchCornerRight;
        } else {
          // Middle child: top border only
          cornerStyle = 'height:15px;border-top:2px solid #3a3a3a';
        }

        html +=
          `<div style="${FLOWCHART_STYLES.branchChildOuter}">` +
          `<div style="${cornerStyle}"></div>` +
          `<div style="${FLOWCHART_STYLES.branchChildPadding}">` +
          emitPill(stepLabel) +
          emitStem() +
          emitNode(childId) +
          `</div>` +
          `</div>`;
      }

      html += `</div>`;
    } else {
      // Linear: check for single outgoing edge
      const outs = outgoing.get(nodeId);
      if (outs && outs.length === 1) {
        const { toId, stepLabel } = outs[0];
        html += emitStem() + emitPill(stepLabel) + emitStem() + emitNode(toId);
      }
      // If no outgoing edges: leaf node, stop
    }

    return html;
  }

  const body = emitNode(rootNode.id);

  return (
    `<div style="${FLOWCHART_STYLES.wrapper}">` +
    `<div style="${FLOWCHART_STYLES.title}">${graph.title}</div>` +
    body +
    `</div>`
  );
}

function emitBox(node: FlowNode): string {
  return `<div style="${FLOWCHART_STYLES.box}">${node.label}</div>`;
}

function emitStem(): string {
  // Outer div is a plain block container (no style), inner div is the visual stem
  return `<div><div style="${FLOWCHART_STYLES.stem}"></div></div>`;
}

function emitPill(label: string): string {
  return `<div style="${FLOWCHART_STYLES.pill}">${label}</div>`;
}
