"use client";

import { useRef, useEffect, useCallback } from "react";

interface Note {
  title: string;
  path: string;
  tags?: string[];
}

interface NoteGraphProps {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  showLabels?: boolean;
}

interface GNode {
  note: Note;
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number;
}

export default function NoteGraph({ notes, onSelectNote, showLabels = false }: NoteGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    nodes: [] as GNode[],
    edges: [] as { s: number; t: number }[],
    hovered: -1,
    alpha: 1,
    w: 800,
    h: 600,
    showLabels: false,
  });
  const animRef = useRef<number>(0);

  // Sync showLabels prop into ref for animation loop
  useEffect(() => {
    stateRef.current.showLabels = showLabels;
  }, [showLabels]);

  // Resize handler
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const resize = () => {
      const { width, height } = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      stateRef.current.w = width;
      stateRef.current.h = height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  // Build graph data when notes change
  useEffect(() => {
    const st = stateRef.current;
    if (notes.length === 0) {
      st.nodes = [];
      st.edges = [];
      return;
    }

    // Tag → note index mapping
    const tagMap: Record<string, number[]> = {};
    notes.forEach((n, i) => {
      (n.tags || []).forEach((t) => {
        if (!tagMap[t]) tagMap[t] = [];
        tagMap[t].push(i);
      });
    });

    // Build edges from shared tags
    const edgeSet = new Set<string>();
    const edges: { s: number; t: number }[] = [];
    Object.values(tagMap).forEach((ids) => {
      for (let a = 0; a < ids.length; a++) {
        for (let b = a + 1; b < ids.length; b++) {
          const lo = Math.min(ids[a], ids[b]);
          const hi = Math.max(ids[a], ids[b]);
          const key = `${lo}-${hi}`;
          if (!edgeSet.has(key)) {
            edgeSet.add(key);
            edges.push({ s: lo, t: hi });
          }
        }
      }
    });

    // Connection counts
    const conn = new Array(notes.length).fill(0);
    edges.forEach((e) => {
      conn[e.s]++;
      conn[e.t]++;
    });

    const cx = st.w / 2;
    const cy = st.h / 2;
    const spread = Math.min(st.w, st.h) * 0.35;

    const nodes: GNode[] = notes.map((n, i) => ({
      note: n,
      x: cx + (Math.random() - 0.5) * spread * 2,
      y: cy + (Math.random() - 0.5) * spread * 2,
      vx: 0,
      vy: 0,
      connections: conn[i],
    }));

    st.nodes = nodes;
    st.edges = edges;
    st.alpha = 1; // restart simulation
  }, [notes]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const tick = () => {
      const st = stateRef.current;
      const { nodes, edges, w, h } = st;
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      if (nodes.length === 0) {
        animRef.current = requestAnimationFrame(tick);
        return;
      }

      const cx = w / 2;
      const cy = h / 2;
      const REP = 2500;
      const ATT = 0.003;
      const GRAV = 0.006;
      const DAMP = 0.82;
      const alpha = st.alpha;

      // Reset velocities
      for (const n of nodes) {
        n.vx = 0;
        n.vy = 0;
      }

      // Repulsion (all pairs)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const d2 = dx * dx + dy * dy || 1;
          const d = Math.sqrt(d2);
          const f = (REP / d2) * alpha;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          nodes[i].vx += fx;
          nodes[i].vy += fy;
          nodes[j].vx -= fx;
          nodes[j].vy -= fy;
        }
      }

      // Attraction (edges)
      for (const e of edges) {
        const dx = nodes[e.t].x - nodes[e.s].x;
        const dy = nodes[e.t].y - nodes[e.s].y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = d * ATT * alpha;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        nodes[e.s].vx += fx;
        nodes[e.s].vy += fy;
        nodes[e.t].vx -= fx;
        nodes[e.t].vy -= fy;
      }

      // Center gravity
      for (const n of nodes) {
        n.vx += (cx - n.x) * GRAV * alpha;
        n.vy += (cy - n.y) * GRAV * alpha;
      }

      // Integrate positions
      for (const n of nodes) {
        n.vx *= DAMP;
        n.vy *= DAMP;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(40, Math.min(w - 40, n.x));
        n.y = Math.max(40, Math.min(h - 40, n.y));
      }

      // Cool down
      st.alpha = Math.max(0.001, st.alpha * 0.997);

      // --- Render ---
      const hov = st.hovered;

      // Edges
      for (const e of edges) {
        const isHighlight = hov >= 0 && (e.s === hov || e.t === hov);
        ctx.strokeStyle = isHighlight
          ? "rgba(168, 85, 247, 0.35)"
          : "rgba(255, 255, 255, 0.06)";
        ctx.lineWidth = isHighlight ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(nodes[e.s].x, nodes[e.s].y);
        ctx.lineTo(nodes[e.t].x, nodes[e.t].y);
        ctx.stroke();
      }

      // Nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const r = Math.max(3, Math.min(10, 3 + n.connections * 0.8));
        const isHov = i === hov;
        const isNeighbor =
          hov >= 0 &&
          edges.some(
            (e) => (e.s === hov && e.t === i) || (e.t === hov && e.s === i)
          );

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        if (isHov) {
          ctx.fillStyle = "#a855f7";
          ctx.shadowColor = "#a855f7";
          ctx.shadowBlur = 16;
        } else if (isNeighbor) {
          ctx.fillStyle = "rgba(168, 85, 247, 0.6)";
          ctx.shadowBlur = 0;
        } else {
          const a = 0.25 + Math.min(n.connections * 0.08, 0.55);
          ctx.fillStyle = `rgba(168, 162, 158, ${a})`;
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;

        // Labels
        const shouldLabel = st.showLabels || isHov || isNeighbor || n.connections >= 3;
        if (shouldLabel) {
          ctx.font = isHov
            ? "600 13px Inter, system-ui, sans-serif"
            : "400 11px Inter, system-ui, sans-serif";
          ctx.fillStyle = isHov
            ? "#ffffff"
            : isNeighbor
              ? "rgba(168, 85, 247, 0.8)"
              : st.showLabels
                ? "rgba(255, 255, 255, 0.5)"
                : "rgba(255, 255, 255, 0.4)";
          ctx.textAlign = "center";
          ctx.fillText(n.note.title, n.x, n.y - r - 5);
        }
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Mouse events
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const nodes = stateRef.current.nodes;
      let closest = -1;
      let minDist = 25;
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.sqrt(
          (nodes[i].x - mx) ** 2 + (nodes[i].y - my) ** 2
        );
        if (d < minDist) {
          closest = i;
          minDist = d;
        }
      }
      stateRef.current.hovered = closest;
      canvas.style.cursor = closest >= 0 ? "pointer" : "default";
    },
    []
  );

  const handleClick = useCallback(() => {
    const hov = stateRef.current.hovered;
    if (hov >= 0 && stateRef.current.nodes[hov]) {
      onSelectNote(stateRef.current.nodes[hov].note);
    }
  }, [onSelectNote]);

  return (
    <div
      ref={wrapRef}
      style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden" }}
    >
      {notes.length === 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "12px",
            color: "#666",
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ fontSize: "14px" }}>No notes to display</span>
          <a
            href="/integrations"
            style={{ color: "#a855f7", fontSize: "13px", textDecoration: "none" }}
          >
            Connect a repository to get started
          </a>
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          style={{ display: "block" }}
        />
      )}
    </div>
  );
}
