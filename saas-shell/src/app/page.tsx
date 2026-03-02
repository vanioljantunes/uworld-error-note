"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Script from "next/script";

declare global {
  interface Window {
    gsap: {
      registerPlugin: (...args: unknown[]) => void;
      to: (targets: string, vars: Record<string, unknown>) => void;
      utils: { toArray: (selector: string) => Element[] };
    };
    ScrollTrigger: {
      create: (vars: Record<string, unknown>) => void;
    };
  }
}

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsapLoaded = useRef(false);

  // Neural lattice canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const NODE_COUNT = 35;
    const CONNECTION_DIST = 180;
    let animationId: number;

    const questionLabels: string[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      questionLabels.push(
        "Q" + String(Math.floor(Math.random() * 500) + 1).padStart(3, "0")
      );
    }

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      label: string;
      pulse: number;
      showLabel: boolean;
    }

    let nodes: Node[] = [];

    function resizeCanvas() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }

    function initNodes() {
      nodes = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        nodes.push({
          x: Math.random() * canvas!.width,
          y: Math.random() * canvas!.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          radius: Math.random() * 2 + 1.5,
          label: questionLabels[i],
          pulse: 0,
          showLabel: Math.random() > 0.6,
        });
      }
    }

    function drawLattice() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.12;
            ctx!.strokeStyle = `rgba(124, 58, 237, ${alpha})`;
            ctx!.lineWidth = 0.5;
            ctx!.beginPath();
            ctx!.moveTo(nodes[i].x, nodes[i].y);
            ctx!.lineTo(nodes[j].x, nodes[j].y);
            ctx!.stroke();
          }
        }
      }

      for (const node of nodes) {
        if (node.pulse > 0) {
          const gradient = ctx!.createRadialGradient(
            node.x, node.y, 0, node.x, node.y, 20 * node.pulse
          );
          gradient.addColorStop(0, `rgba(124, 58, 237, ${0.3 * node.pulse})`);
          gradient.addColorStop(1, "rgba(124, 58, 237, 0)");
          ctx!.fillStyle = gradient;
          ctx!.beginPath();
          ctx!.arc(node.x, node.y, 20 * node.pulse, 0, Math.PI * 2);
          ctx!.fill();
          node.pulse -= 0.005;
        }

        ctx!.fillStyle = "rgba(124, 58, 237, 0.7)";
        ctx!.beginPath();
        ctx!.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx!.fill();

        if (node.showLabel) {
          ctx!.fillStyle = "rgba(152, 152, 166, 0.3)";
          ctx!.font = "9px 'JetBrains Mono', monospace";
          ctx!.fillText(node.label, node.x + 6, node.y + 3);
        }
      }

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > canvas!.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas!.height) node.vy *= -1;
      }

      if (Math.random() < 0.02) {
        const idx = Math.floor(Math.random() * nodes.length);
        nodes[idx].pulse = 1;
      }

      animationId = requestAnimationFrame(drawLattice);
    }

    resizeCanvas();
    initNodes();
    drawLattice();

    const handleResize = () => {
      resizeCanvas();
      initNodes();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Hero reveal animations (on mount)
  useEffect(() => {
    const heroReveals = document.querySelectorAll(
      ".hero-scrub-container .reveal-up"
    );
    heroReveals.forEach((el, index) => {
      setTimeout(() => el.classList.add("active"), 150 * index);
    });
  }, []);

  // GSAP ScrollTrigger setup (after scripts load)
  function initGsap() {
    if (gsapLoaded.current) return;
    if (!window.gsap || !window.ScrollTrigger) return;
    gsapLoaded.current = true;

    const gsap = window.gsap;
    const ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);

    gsap.to(".hero-scrub-container .reveal-up", {
      y: -60,
      opacity: 0,
      filter: "blur(15px)",
      stagger: 0.05,
      scrollTrigger: {
        trigger: ".hero-scrub-container",
        start: "top top",
        end: "15% top",
        scrub: true,
      },
    });

    gsap.utils
      .toArray("section .reveal-up, section .reveal-zoom")
      .forEach(function (elem: Element) {
        ScrollTrigger.create({
          trigger: elem,
          start: "top 85%",
          onEnter: function () {
            elem.classList.add("active");
          },
        });
      });
  }

  function handleFlashlight(
    e: React.MouseEvent<HTMLDivElement>,
    card: HTMLDivElement
  ) {
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    card.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  }

  return (
    <>
      {/* External Scripts */}
      <Script
        src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"
        strategy="afterInteractive"
        onLoad={() => initGsap()}
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"
        strategy="afterInteractive"
        onLoad={() => initGsap()}
      />

      <div className="noise-overlay" />

      {/* NAVBAR */}
      <header className="fixed w-full z-50 top-0 transition-all duration-300">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-md border-b border-white/5" />
        <div className="max-w-[1440px] mx-auto px-6 py-4 relative flex justify-between items-center">
          <div className="flex items-center gap-2.5 group cursor-pointer">
            <div className="w-2.5 h-2.5 bg-accent rounded-full group-hover:shadow-[0_0_12px_rgba(124,58,237,0.6)] transition-shadow duration-300" />
            <span
              className="font-semibold tracking-tight text-lg text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              GapStrike
            </span>
          </div>

          <nav
            className="hidden md:flex items-center gap-8 text-xs uppercase tracking-widest text-muted"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <a href="#method" className="hover:text-white transition-colors">
              Method
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="text-sm text-secondary hover:text-white transition-colors hidden md:block"
            >
              Login
            </Link>
            <div className="hidden md:block w-px h-4 bg-white/10" />
            <Link
              href="/auth/register"
              className="px-5 py-2 bg-accent text-white text-sm font-medium rounded-full hover:bg-accent/90 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] transition-all"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="hero-scrub-container relative bg-body">
        <div className="sticky top-0 h-screen w-full overflow-hidden">
          <div className="absolute inset-0 z-0">
            <canvas ref={canvasRef} className="w-full h-full" />
          </div>

          <div className="relative z-10 w-full h-full max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-12 pointer-events-none">
            <div className="col-span-1 md:col-span-10 lg:col-span-7 h-full flex flex-col justify-center px-6 md:pl-24 text-left pointer-events-auto">
              <div className="inline-flex items-center gap-3 mb-4 reveal-up">
                <span className="w-2 h-2 bg-accent rounded-full" />
                <span
                  className="text-xs uppercase tracking-[0.2em] text-muted"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Question-Indexed Mastery
                </span>
              </div>

              <h1
                className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tighter leading-[0.85] mb-5 -ml-1"
                style={{ fontFamily: "var(--font-display)" }}
              >
                <div className="reveal-up block text-white">Master Your</div>
                <div className="reveal-up block text-outline-purple">
                  Mistakes.
                </div>
              </h1>

              <p className="text-lg md:text-xl text-secondary max-w-lg leading-relaxed reveal-up mb-8 font-light">
                GapStrike transforms every incorrect answer into structured,
                permanent knowledge.
              </p>

              <div className="flex flex-wrap gap-4 reveal-up">
                <Link
                  href="/auth/register"
                  className="group relative px-8 py-4 bg-accent text-white rounded-full overflow-hidden shadow-lg hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] transition-all hover:-translate-y-1"
                >
                  <span className="relative z-10 text-sm font-medium tracking-wide">
                    Get Started
                  </span>
                </Link>
                <a
                  href="#method"
                  className="group px-8 py-4 bg-white/5 text-white rounded-full border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all hover:-translate-y-1 flex items-center gap-2"
                >
                  <span className="text-sm font-medium tracking-wide">
                    See How It Works
                  </span>
                  {/* @ts-expect-error iconify web component */}
                  <iconify-icon
                    icon="solar:arrow-down-linear"
                    className="group-hover:translate-y-0.5 transition-transform"
                  />
                </a>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20 opacity-60 pointer-events-none">
            <span
              className="text-[10px] uppercase tracking-widest text-muted"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Scroll
            </span>
            <div className="w-px h-8 bg-muted overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-full bg-accent animate-scroll-line" />
            </div>
          </div>

          <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-surface to-transparent pointer-events-none z-10" />
        </div>
      </main>

      {/* PROBLEM SECTION */}
      <section
        className="relative z-20 bg-surface py-24 md:py-32 overflow-hidden border-t border-white/5"
        id="problem"
      >
        <div className="max-w-[1440px] mx-auto px-6 md:px-24">
          <div className="text-center mb-24 reveal-up">
            <span
              className="text-xs uppercase tracking-[0.2em] text-muted mb-6 block"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              The Problem
            </span>
            <h2
              className="text-4xl md:text-6xl font-medium tracking-tight text-white max-w-3xl mx-auto"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Studying Isn&apos;t the Same as
              <br />
              <span className="text-muted">Structuring.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: "solar:eye-scan-linear",
                title: "Passive Review",
                desc: "Re-reading highlights doesn\u2019t build durable memory. Knowledge fades without active structuring.",
                delay: "",
              },
              {
                icon: "solar:documents-minimalistic-linear",
                title: "Fragmented Notes",
                desc: "Scattered annotations across tools create noise, not signal. No system connects them.",
                delay: "delay-100",
              },
              {
                icon: "solar:refresh-circle-linear",
                title: "Recurring Mistakes",
                desc: "The same errors repeat because the gap was never diagnosed. You review, but never resolve.",
                delay: "delay-200",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="flashlight-card h-[400px] border border-white/5 bg-card p-8 flex flex-col justify-between rounded-sm hover:shadow-2xl hover:shadow-accent/5 hover:-translate-y-1 transition-all duration-500 group reveal-up"
                onMouseMove={(e) =>
                  handleFlashlight(e, e.currentTarget)
                }
              >
                <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center text-secondary mb-6 group-hover:bg-accent group-hover:text-white transition-colors duration-500">
                  {/* @ts-expect-error iconify web component */}
                  <iconify-icon icon={card.icon} className="text-2xl" />
                </div>
                <div>
                  <h3
                    className="text-2xl font-medium mb-3 text-white"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {card.title}
                  </h3>
                  <p className="text-secondary text-sm leading-relaxed">
                    {card.desc}
                  </p>
                </div>
                <div className="h-1 w-full bg-white/5 mt-8 overflow-hidden">
                  <div
                    className={`h-full bg-accent w-0 group-hover:w-full transition-all duration-700 ease-out ${card.delay}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      </section>

      {/* METHOD SECTION */}
      <section
        className="relative z-20 bg-body py-24 md:py-32 overflow-hidden border-t border-white/5"
        id="method"
      >
        <div className="absolute top-0 right-0 -mr-24 -mt-24 pointer-events-none select-none opacity-[0.02] z-0 overflow-hidden">
          <span
            className="font-bold text-[15rem] leading-none text-white"
            style={{ fontFamily: "var(--font-display)" }}
          >
            METHOD
          </span>
        </div>

        <div className="max-w-[1440px] mx-auto px-6 md:px-24 relative z-10">
          <div className="mb-24 reveal-up">
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="w-1.5 h-1.5 bg-accent rounded-full" />
              <span
                className="text-xs uppercase tracking-[0.2em] text-muted"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                The Method
              </span>
            </div>
            <h2
              className="text-5xl md:text-7xl font-medium tracking-tight leading-none text-white max-w-4xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              From Error to Mastery.
              <br />
              <span className="text-muted">In Three Steps.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                num: "01",
                title: "Diagnose the Gap",
                desc: "Paste a wrong answer. GapStrike extracts the exact reasoning failure and maps it to your knowledge structure.",
              },
              {
                num: "02",
                title: "Generate Micro-Notes",
                desc: "AI generates a targeted micro-note addressing the specific gap \u2014 mechanism, distinction, or reasoning chain.",
              },
              {
                num: "03",
                title: "Build Macro Structure",
                desc: "Notes accumulate into an indexed knowledge architecture. Every mistake strengthens the system.",
              },
            ].map((step) => (
              <div
                key={step.num}
                className="reveal-up group cursor-default p-6 rounded-xl hover:bg-card hover:shadow-xl hover:shadow-accent/5 transition-all duration-500 border border-transparent hover:border-white/5"
              >
                <div className="flex items-baseline gap-4 mb-3">
                  <span
                    className="text-xs text-muted group-hover:text-accent group-hover:scale-110 transition-all duration-300"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    {step.num}
                  </span>
                  <h3
                    className="text-2xl font-medium text-white group-hover:translate-x-1 transition-transform duration-300"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {step.title}
                  </h3>
                </div>
                <p className="pl-4 text-secondary text-sm leading-relaxed group-hover:text-white/70 transition-colors border-l border-white/10 group-hover:border-accent">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DIFFERENTIATION SECTION */}
      <section
        className="relative z-20 bg-surface py-24 md:py-32 overflow-hidden border-t border-white/5"
        id="features"
      >
        <div className="max-w-[1440px] mx-auto px-6 md:px-24">
          <div className="text-center mb-24 reveal-up">
            <span
              className="text-xs uppercase tracking-[0.2em] text-muted mb-6 block"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Why GapStrike
            </span>
            <h2
              className="text-5xl md:text-6xl font-medium tracking-tight text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Built Different.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: "solar:bookmark-square-linear",
                title: "Question-Indexed Knowledge",
                desc: "Every note traces back to a specific question. No orphan information.",
              },
              {
                icon: "solar:target-linear",
                title: "Gap-Driven Learning",
                desc: "Learning starts from what you got wrong, not what you already know.",
              },
              {
                icon: "solar:graph-new-linear",
                title: "Micro to Macro Integration",
                desc: "Individual notes compose into a structured knowledge graph over time.",
              },
              {
                icon: "solar:shield-check-linear",
                title: "Built for Long-Term Retention",
                desc: "Spaced repetition meets error analysis. Knowledge that compounds.",
              },
            ].map((block) => (
              <div
                key={block.title}
                className="reveal-up p-8 md:p-10 rounded-xl border border-white/5 bg-card/50 backdrop-blur-sm hover:border-accent/20 hover:shadow-xl hover:shadow-accent/5 transition-all duration-500 group"
              >
                <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center text-accent mb-5 group-hover:bg-accent group-hover:text-white transition-colors duration-500">
                  {/* @ts-expect-error iconify web component */}
                  <iconify-icon icon={block.icon} className="text-xl" />
                </div>
                <h3
                  className="text-xl font-medium text-white mb-3"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {block.title}
                </h3>
                <p className="text-secondary text-sm leading-relaxed">
                  {block.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="h-screen w-full relative overflow-hidden flex items-center justify-center bg-body">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative group z-10 reveal-zoom">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-accent to-purple-400 rounded-2xl blur opacity-20 group-hover:opacity-75 transition duration-1000 group-hover:duration-200" />

          <div className="absolute -inset-[2px] rounded-2xl overflow-hidden opacity-0 group-hover:opacity-100 transition duration-500">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] bg-[conic-gradient(from_0deg,transparent_0_340deg,#7c3aed_360deg)] animate-spin-slow" />
          </div>

          <div className="relative px-12 py-16 bg-body/90 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col items-center justify-center text-center shadow-2xl">
            <div className="mb-6 w-16 h-16 bg-accent rounded-full flex items-center justify-center text-white shadow-[0_0_30px_rgba(124,58,237,0.4)]">
              {/* @ts-expect-error iconify web component */}
              <iconify-icon
                icon="solar:lightning-bold-duotone"
                className="text-3xl"
              />
            </div>

            <h2
              className="text-3xl md:text-5xl font-bold text-white mb-2 tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Start Mastering
              <br />
              <span className="text-muted">Your Mistakes</span>
            </h2>
            <div className="h-px w-12 bg-muted my-4" />
            <p
              className="text-xs uppercase tracking-[0.3em] text-muted mb-8"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Question-Indexed Mastery
            </p>

            <Link
              href="/auth/register"
              className="relative group/btn overflow-hidden rounded-full bg-white text-black px-8 py-3 font-medium text-sm hover:scale-105 transition-transform"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Early Access
                {/* @ts-expect-error iconify web component */}
                <iconify-icon icon="solar:arrow-right-linear" />
              </span>
              <div className="absolute inset-0 bg-stone-200 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#050508] text-muted py-12 border-t border-white/5 relative z-20">
        <div className="max-w-[1440px] mx-auto px-6 md:px-24 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 bg-accent/60 rounded-full" />
            <span
              className="font-medium tracking-tight text-sm text-white/60"
              style={{ fontFamily: "var(--font-display)" }}
            >
              GapStrike
            </span>
          </div>

          <div
            className="text-xs uppercase tracking-widest flex gap-6"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <a href="#" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Support
            </a>
          </div>

          <div className="text-xs text-muted">&copy; 2026 GapStrike.</div>
        </div>
      </footer>
    </>
  );
}
