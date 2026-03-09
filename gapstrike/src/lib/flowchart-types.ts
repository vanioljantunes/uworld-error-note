export interface FlowNode {
  id: string;     // synthetic: "n0", "n1", ...
  label: string;  // raw text content, cloze preserved verbatim
}

export interface FlowEdge {
  fromId: string;
  toId: string;
  stepLabel: string; // text of the step pill between connected nodes
}

export interface BranchGroup {
  parentId: string;   // node that fans out
  childIds: string[]; // ordered left-to-right
}

export interface FlowGraph {
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  branchGroups: BranchGroup[];
}
