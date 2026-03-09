import { FlowGraph, FlowNode, FlowEdge, BranchGroup } from './flowchart-types';

// Suppress unused import warning — FLOWCHART_STYLES is used for element role detection
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FLOWCHART_STYLES } from './flowchart-styles';

type ElementRole = 'title' | 'box' | 'pill' | 'stemWrap' | 'branch' | 'unknown';

/**
 * Identify an element's logical role by matching its style attribute against
 * FLOWCHART_STYLES constants. Uses substring matching on the raw style string
 * (whitespace collapsed) — do NOT normalize or lowercase, the AI template
 * always emits exact style strings.
 */
function getElementRole(el: Element): ElementRole {
  const style = (el.getAttribute('style') || '').replace(/\s+/g, ' ').trim();

  // title: font-weight:bold AND font-size:14px
  if (style.includes('font-weight:bold') && style.includes('font-size:14px')) {
    return 'title';
  }
  // branch wrapper: display:inline-flex
  // Check BEFORE box because inline-flex is unambiguous
  if (style.includes('display:inline-flex')) {
    return 'branch';
  }
  // box: display:inline-block AND border:2px solid #3a3a3a
  if (style.includes('display:inline-block') && style.includes('border:2px solid #3a3a3a')) {
    return 'box';
  }
  // pill: display:inline-block AND font-size:10px
  if (style.includes('display:inline-block') && style.includes('font-size:10px')) {
    return 'pill';
  }
  // stemWrap: single child whose style includes width:2px AND background:#3a3a3a
  if (el.children.length === 1) {
    const childStyle = (el.children[0].getAttribute('style') || '').replace(/\s+/g, ' ').trim();
    if (childStyle.includes('width:2px') && childStyle.includes('background:#3a3a3a')) {
      return 'stemWrap';
    }
  }
  return 'unknown';
}

/**
 * Walk a sequence of elements at the same level and extract nodes/edges/branchGroups.
 * Mutates the provided arrays/counters in place.
 *
 * @param children  - Elements to walk (direct children of wrapper or branch padding div)
 * @param nodes     - Accumulator for FlowNode objects
 * @param edges     - Accumulator for FlowEdge objects
 * @param branchGroups - Accumulator for BranchGroup objects
 * @param counter   - { value: number } box counter shared across recursive calls
 * @param prevNodeId - ID of the preceding node in this chain (for edge creation)
 * @param pendingPill - { value: string | null } pill label waiting for the next box
 * @returns the ID of the last node seen in this walk (used by callers to chain edges)
 */
function walkChildren(
  children: Element[],
  nodes: FlowNode[],
  edges: FlowEdge[],
  branchGroups: BranchGroup[],
  counter: { value: number },
  prevNodeId: string | null,
  pendingPill: { value: string | null },
): string | null {
  let lastNodeId = prevNodeId;

  for (const el of children) {
    const role = getElementRole(el);

    if (role === 'title') {
      // Title handled separately by the caller
      continue;
    }

    if (role === 'box') {
      const id = 'n' + counter.value++;
      // Use textContent (NOT innerHTML) to preserve cloze syntax verbatim
      const label = (el.textContent || '').trim();
      nodes.push({ id, label });

      if (lastNodeId !== null && pendingPill.value !== null) {
        edges.push({ fromId: lastNodeId, toId: id, stepLabel: pendingPill.value });
        pendingPill.value = null;
      }

      lastNodeId = id;
      continue;
    }

    if (role === 'pill') {
      pendingPill.value = (el.textContent || '').trim();
      continue;
    }

    if (role === 'stemWrap') {
      // Structural only — skip
      continue;
    }

    if (role === 'branch') {
      // The current lastNodeId is the branch parent
      const parentId = lastNodeId;
      if (parentId === null) continue;

      const childIds: string[] = [];

      // Each direct child of the inline-flex div is one branch arm
      for (let i = 0; i < el.children.length; i++) {
        const armOuter = el.children[i];
        // armOuter = <div style="text-align:center">
        //   <div style="height:15px;border-top...corner..."> (corner)
        //   <div style="padding:0 16px">                     (padding wrapper)
        //     pill → stemWrap → box (...)
        //   </div>
        // </div>

        // Find the padding wrapper
        let paddingWrapper: Element | null = null;
        for (let j = 0; j < armOuter.children.length; j++) {
          const child = armOuter.children[j];
          const s = (child.getAttribute('style') || '').replace(/\s+/g, ' ').trim();
          if (s.includes('padding:0 16px')) {
            paddingWrapper = child;
            break;
          }
        }
        if (!paddingWrapper) continue;

        // Walk the padding wrapper's children
        // The first box found becomes the immediate child of the parent
        const armPendingPill = { value: null as string | null };
        const armChildren = Array.from(paddingWrapper.children);

        // Find the first pill (the parent→child step label)
        let parentToChildPill: string | null = null;
        let firstBoxInArm: string | null = null;
        let armLastNodeId: string | null = null;

        for (const armEl of armChildren) {
          const armRole = getElementRole(armEl);

          if (armRole === 'pill') {
            if (parentToChildPill === null) {
              // First pill: edge from parent to first box
              parentToChildPill = (armEl.textContent || '').trim();
            } else {
              armPendingPill.value = (armEl.textContent || '').trim();
            }
          } else if (armRole === 'stemWrap') {
            // structural, skip
          } else if (armRole === 'box') {
            const id = 'n' + counter.value++;
            const label = (armEl.textContent || '').trim();
            nodes.push({ id, label });

            if (firstBoxInArm === null) {
              firstBoxInArm = id;
              // Connect parent → first box in arm using parent-to-child pill
              if (parentToChildPill !== null) {
                edges.push({ fromId: parentId, toId: id, stepLabel: parentToChildPill });
                parentToChildPill = null;
              }
            } else if (armLastNodeId !== null && armPendingPill.value !== null) {
              // Connect previous box in arm → this box
              edges.push({ fromId: armLastNodeId, toId: id, stepLabel: armPendingPill.value });
              armPendingPill.value = null;
            }

            armLastNodeId = id;
          }
        }

        if (firstBoxInArm !== null) {
          childIds.push(firstBoxInArm);
        }
      }

      branchGroups.push({ parentId, childIds });
      // After a branch, the main chain continues with lastNodeId staying as parentId
      // (branches are typically terminal in this template, but keep parentId so
      //  any subsequent linear boxes after the branch connect from the parent)
      // Do NOT update lastNodeId — after branch, main chain stops here for this plan.
      continue;
    }

    // unknown: skip
  }

  return lastNodeId;
}

/**
 * Parse an AI-generated flowchart HTML string into a FlowGraph.
 *
 * Uses DOMParser to traverse the DOM structure defined by the anki_flowchart template.
 * Cloze syntax ({{cN::text}} and {{cN::text::hint}}) in box labels is preserved verbatim
 * because we use textContent, not innerHTML.
 *
 * This function is safe to call client-side only (DOMParser is a browser API).
 * In Vitest tests, configure `environment: 'jsdom'` in vitest.config.ts.
 */
export function parseFlowHTML(html: string): FlowGraph {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const wrapper = doc.body.firstElementChild;

  if (!wrapper) {
    return { title: '', nodes: [], edges: [], branchGroups: [] };
  }

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const branchGroups: BranchGroup[] = [];
  const counter = { value: 0 };
  const pendingPill = { value: null as string | null };
  let title = '';

  // Extract title from the first title-role element
  for (let i = 0; i < wrapper.children.length; i++) {
    const el = wrapper.children[i];
    if (getElementRole(el) === 'title') {
      title = (el.textContent || '').trim();
      break;
    }
  }

  // Walk all children (walkChildren skips title elements)
  walkChildren(
    Array.from(wrapper.children),
    nodes,
    edges,
    branchGroups,
    counter,
    null,
    pendingPill,
  );

  return { title, nodes, edges, branchGroups };
}
