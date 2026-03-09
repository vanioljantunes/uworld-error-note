# Stack Research

**Domain:** Visual HTML flowchart editor in React/Next.js — parse AI-generated HTML, edit nodes/edges, serialize back to inline-styled HTML for Anki
**Researched:** 2026-03-09
**Confidence:** HIGH (core decisions are zero-dependency patterns; library versions verified via npm registry)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React 19 + Next.js 15 | (already installed) | Component framework | Already in the project. FlowchartEditor is a `"use client"` component using `useState`/`useReducer`. No framework change needed. |
| TypeScript 5 | (already installed) | Type safety | Typed node/edge interfaces prevent bugs in the parse → state → serialize pipeline. Critical given the HTML string output must be exact. |
| immer 11.x | 11.1.4 | Immutable state updates for nested graph state | Graph state is a tree of nodes with nested children. Immer's `produce()` lets you write `draft.nodes[i].label = newLabel` instead of spread-cloning every level. `useImmerReducer` is the pattern for `ADD_NODE / REMOVE_NODE / EDIT_LABEL` actions. 5,879 packages depend on it — well-proven. |
| use-immer 0.11.0 | 0.11.0 | React hooks wrappers: `useImmer` + `useImmerReducer` | Ships `useImmerReducer` which combines Immer's `produce` with `useReducer`. This is exactly the state machine pattern needed for the flowchart editor (add box, remove box, edit label, add connection, remove connection). Maintained by the Immer team. |
| html-react-parser 5.x | 5.2.17 | Parse AI-generated HTML string → React element tree | Only library that both (a) parses HTML strings and (b) lets you swap matching DOM nodes for interactive React components via the `replace()` callback. The replace function receives each `domhandler` node and can return a React component instead. This is precisely the pattern needed: detect box `<div>` nodes by data attributes or inline style signatures and replace them with `<EditableBox>` components. Works on client and server. React 19 compatible (verified via GitHub issue #1501). Latest: 5.2.17, published Feb 2026. |
| Browser native `DOMParser` | Web API (no install) | Parse HTML to DOM tree for style attribute extraction during import | `new DOMParser().parseFromString(html, 'text/html')` is available in all modern browsers without any npm dependency. Used in `parseFlowchartHTML()` to walk the AI-generated HTML and extract node labels, connector types, and step-pill texts into the editor's internal `GraphState` structure. No Node.js/jsdom needed because FlowchartEditor is a client component. |
| `useRef` + `element.outerHTML` | Web API (no install) | Serialize React-rendered editor back to HTML string | The cleanest client-side serialization: attach a `ref` to the preview `<div>` that renders the flowchart from state, then call `ref.current.outerHTML` (or `innerHTML`) to get the exact HTML string to save to Anki. No `renderToStaticMarkup`, no custom serializer. Works because the preview div renders inline-styled divs — no React-specific attributes survive in the DOM (React strips `key`, event handlers don't appear in innerHTML). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| html-dom-parser | 5.1.8 | Parse HTML string to a `domhandler` DOM tree on both client and server | Use this as the underlying parser if you need to walk the AI HTML in a Next.js API route (server-side, no browser `DOMParser`). The `html-react-parser` package already bundles this internally — you only need it directly if writing a standalone server-side validation utility. |
| `uuid` or `crypto.randomUUID()` | Web API (no install) | Generate stable node IDs in `GraphState` | Each node needs a stable ID for the reducer to target (`{ type: 'EDIT_LABEL', id: 'node-uuid', label: '...' }`). Browser `crypto.randomUUID()` is available without any npm package in modern browsers and Next.js client components. No external dependency needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| TypeScript strict mode | Catch incorrect shape mutations in reducer | Already enabled via `tsconfig.json`. `GraphState`, `FlowNode`, `FlowEdge` interfaces should be defined in `flowchart-types.ts` and imported into both the parser and serializer. |
| React DevTools | Inspect `GraphState` at runtime | Useful for verifying that `parseFlowchartHTML()` produces the correct node tree from AI output. The state shape is the ground truth. |
| Anki desktop (local) | Verify serialized HTML renders correctly in Anki card reviewer | After serialization, paste the HTML string into an Anki field and review. This is the only ground-truth test — browser rendering differs from Anki's WebView in edge cases (e.g., `display:inline-flex` support). |

---

## Installation

```bash
# Inside gapstrike/
npm install immer use-immer

# html-react-parser is the only NEW external package needed
npm install html-react-parser

# Everything else (DOMParser, crypto.randomUUID, useRef) is browser built-in
# No additional installs required
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `html-react-parser` replace callback | `html-dom-parser` + manual React.createElement walk | If you never need React components in the parse output (pure DOM walk). Here we do need to inject `<EditableBox onClick={...} />` components, so `html-react-parser`'s replace callback is the right level of abstraction. |
| `useImmerReducer` | Plain `useReducer` with spread cloning | If the state is shallow (1-2 levels deep). The flowchart state (`nodes[].children[].stepPills`) is 3+ levels deep — spread cloning at each level produces verbose, error-prone reducer code. Immer pays for itself here. |
| `useImmerReducer` | Zustand / Redux Toolkit | If the editor state needs to be shared across multiple pages or persisted to a global store. The flowchart state is local to the `FlowchartEditor` component — there is no cross-component sharing need. A local hook is correct here; adding a global store is over-engineering. |
| `ref.current.outerHTML` for serialization | Custom recursive HTML builder from state | Custom builders must replicate the exact inline style tokens from the template (background colors, border radiuses, font sizes). `outerHTML` captures what the browser already rendered from those exact styles — zero divergence risk. The custom builder approach has historically produced subtle style mismatches that break Anki rendering. |
| Browser `DOMParser` | `html-dom-parser` npm package (client) | `html-dom-parser` returns a domhandler AST (same as `htmlparser2`). The browser `DOMParser` returns a live `Document` object. For client-side use the native `DOMParser` is simpler, has zero bundle cost, and returns a walkable DOM tree. Use `html-dom-parser` only for SSR paths. |
| `crypto.randomUUID()` | `uuid` npm package | `uuid` is still the right choice if Node 14 compatibility is required. For Next.js 15 with React 19 targeting modern browsers and Node 18+, `crypto.randomUUID()` is built-in and produces RFC-compliant UUIDs. Saves ~2.5KB. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@xyflow/react` (React Flow) | Designed for canvas-based node editors with drag-and-drop positioning. Its output is SVG/canvas — you cannot serialize it to inline-styled HTML divs for Anki. The library is also 200-300KB and forces a visual paradigm (x/y coordinates, pan/zoom) that is wrong for this use case where layout is determined by the AI-generated HTML structure, not by free-form drag. | Custom `useImmerReducer` + inline-styled div rendering, which produces exactly the same HTML format as the AI template. |
| Mermaid.js | Replaced in previous session. Anki does not render Mermaid syntax. The output is SVG that Anki strips or doesn't display on all platforms. The entire project is premised on pure HTML/CSS output. | AI-generated div-based HTML with inline styles (already implemented in template). |
| `renderToStaticMarkup` / `renderToString` | These are server-side React APIs. In Next.js 15 App Router, using them in client components is either broken (import fails in client bundle) or produces unexpected results. Known issue: Next.js issue #57669. The pattern "render to DOM ref, read innerHTML" avoids all of this. | `ref.current.outerHTML` after rendering the preview into a hidden/visible DOM node. |
| `react-html-parser` (the OLD package, no `@`) | This package (`react-html-parser` on npm, by peternewnham) is **unmaintained** — last commit 2017, no React 18/19 support. It is a different package from `html-react-parser` (by remarkablemark, the one to use). The naming is confusingly similar. | `html-react-parser` (by remarkablemark, 5.2.17, actively maintained). Always verify the author. |
| `dangerouslySetInnerHTML` for the editable editor pane | Inserting raw AI HTML via `dangerouslySetInnerHTML` into the editor renders it statically — React doesn't attach event handlers to nodes created this way. You can't make boxes clickable after the fact. | Parse the AI HTML through `html-react-parser` with a `replace` callback so React components (with `onClick` etc.) are placed at construction time. |
| `contentEditable` on the entire flowchart div | Gives the browser free-form text editing control over the entire HTML structure. Users can accidentally delete connectors, step pills, or structural divs. Cloze syntax like `{{c1::text}}` gets mangled by browser text editing. | `contentEditable` scoped only to the label text inside each `<EditableBox>` component (fine-grained, not structural). The box's structural wrapper div is not editable. |
| `jsdom` | jsdom is a ~5MB server-side DOM emulator. Using it client-side (in a Next.js `"use client"` component) either fails to bundle or adds massive bundle weight. The browser already has a DOM — use `DOMParser`. | Native browser `DOMParser` for client-side HTML parsing. |

---

## Stack Patterns by Variant

**If the AI-generated HTML structure changes between template versions:**
- Store a `templateVersion` field in the parsed `GraphState`
- Write a migration function `migrateV1toV2(state)` rather than changing the parser
- The parser reads the AI HTML once on load; subsequent migrations are state-level operations

**If the serialization must produce byte-identical output to the AI template:**
- Add a snapshot test: generate a card with the AI, parse it into state, re-serialize to HTML, and diff the two strings
- Use `ref.current.outerHTML` (captures real browser rendering) not a custom builder (which may diverge)
- Lock the template hash in `TEMPLATE_PREV_HASHES` after each verified template change

**If inline editing of cloze syntax `{{c1::text}}` causes problems:**
- Render cloze syntax as raw text in the `contentEditable` box (already a FLOW-08 requirement)
- Use `onInput` (not `onChange`) to capture edits — `onChange` fires unreliably on `contentEditable` in React
- On blur, read `e.currentTarget.textContent` (not `innerHTML`) to avoid HTML injection from paste

**If the table editor needs the same parse/serialize approach:**
- `html-react-parser` works identically for `<table>` structures — same `replace` callback pattern
- Each `<td>` becomes an `<EditableCell contentEditable>` component
- Serialization is again `ref.current.outerHTML`
- Immer state shape: `{ rows: Row[], cols: Column[] }` where each `Row` has `cells: Cell[]`

---

## Internal State Shape (TypeScript)

The recommended internal state type for the FlowchartEditor. This is NOT a library recommendation — it is the data model that `parseFlowchartHTML()` must produce and `renderFlowchart()` must consume:

```typescript
// flowchart-types.ts

export interface FlowNode {
  id: string;                // crypto.randomUUID() on parse
  label: string;             // Text content including {{cN::...}} syntax
  children: FlowNode[];      // Recursive: branching nodes have 2+ children
  stepPill?: string;         // Label on the connector above this node (e.g. "inhibits")
}

export interface FlowchartState {
  title: string;             // Plain text — never contains cloze syntax
  root: FlowNode;            // Single root, tree structure
  direction: 'vertical' | 'horizontal';  // TD = vertical, LR = horizontal
}

// Reducer actions
export type FlowchartAction =
  | { type: 'EDIT_LABEL'; id: string; label: string }
  | { type: 'EDIT_STEP_PILL'; id: string; stepPill: string }
  | { type: 'ADD_CHILD'; parentId: string }
  | { type: 'REMOVE_NODE'; id: string }
  | { type: 'EDIT_TITLE'; title: string };
```

The tree structure (children array, not flat nodes + edges map) directly mirrors the div nesting in the AI template output. A flat edges map (as used in React Flow) would require a separate layout algorithm to re-produce the nested div HTML — unnecessary complexity.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| html-react-parser 5.2.17 | React 19.0.0 | Verified — GitHub issue #1501 confirms React 19 support; last publish Feb 2026. |
| immer 11.1.4 | TypeScript 5.x, Node 18+ | No breaking changes from 10.x to 11.x for the `produce()` API used here. |
| use-immer 0.11.0 | immer 10.x / 11.x | Peer dependency is `immer >= 10.0`. Compatible with immer 11.1.4. Published ~1 year ago, stable. |
| Next.js 15.1.3 | React 19.0.0 | Already in the project, confirmed working. |

---

## Sources

- https://www.npmjs.com/package/html-react-parser — Version 5.2.17 confirmed, last published Feb 2026 (HIGH confidence)
- https://github.com/remarkablemark/html-react-parser/issues/1501 — React 19 compatibility confirmed (HIGH confidence)
- https://www.npmjs.com/package/immer — Version 11.1.4 confirmed, last published ~1 month ago (HIGH confidence)
- https://www.npmjs.com/package/use-immer — Version 0.11.0 confirmed; maintained by Immer team (HIGH confidence)
- https://www.npmjs.com/package/html-dom-parser — Version 5.1.8; used internally by html-react-parser (HIGH confidence)
- https://developer.mozilla.org/en-US/docs/Web/API/DOMParser — Browser-native HTML parsing, no install required (HIGH confidence)
- https://immerjs.github.io/immer/example-setstate/ — useImmerReducer pattern with React (HIGH confidence)
- https://github.com/immerjs/use-immer — useImmerReducer API (HIGH confidence)
- https://github.com/vercel/next.js/issues/57669 — renderToStaticMarkup broken in Next.js 14+ client context (HIGH confidence, confirmed issue)
- https://react.dev/learn/manipulating-the-dom-with-refs — ref.current.outerHTML serialization pattern (HIGH confidence, official React docs)
- https://xyflow.com/ — @xyflow/react scope and canvas-based output confirmed as incompatible with inline HTML output requirement (HIGH confidence)
- WebSearch: immer 11.1.4 version — MEDIUM confidence (npm page returned 403, version reported from search snippet)
- WebSearch: html-react-parser React 19 issue #1501 — MEDIUM confidence (confirmed via search snippet, page not fetched directly)

---

*Stack research for: GapStrike FlowchartEditor — visual HTML editor with parse/edit/serialize pipeline*
*Researched: 2026-03-09*
