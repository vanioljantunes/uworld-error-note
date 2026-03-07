export function renderMarkdown(md: string): string {
  // Strip YAML frontmatter
  let body = md.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");

  // ── Fenced code blocks (```lang ... ```) — FIRST to protect inner content ──
  body = body.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return `<pre data-lang="${lang}"><code>${escaped}</code></pre>`;
  });

  // ── Inline code — before other inline rules ──
  body = body.replace(/`([^`\n]+?)`/g, "<code>$1</code>");

  // ── Blockquotes (lines starting with >) ──
  body = body.replace(/(?:^>[ ]?(.*)$\n?)+/gm, (match) => {
    const inner = match
      .split("\n")
      .filter((l) => l.trim())
      .map((line) => line.replace(/^>\s?/, ""))
      .join("<br/>");
    return `<blockquote>${inner}</blockquote>`;
  });

  // ── Horizontal rules (---, ***, ___) ──
  body = body.replace(/^(?:---|\*\*\*|___)\s*$/gm, "<hr/>");

  // ── Headers ──
  body = body.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  body = body.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  body = body.replace(/^# (.+)$/gm, "<h1>$1</h1>");

  // ── Unordered lists (-, *, +) ──
  body = body.replace(/(?:^[ \t]*[-*+] .+$\n?)+/gm, (match) => {
    const items = match
      .trim()
      .split("\n")
      .map((line) => `<li>${line.replace(/^[ \t]*[-*+] /, "")}</li>`);
    return `<ul>${items.join("")}</ul>`;
  });

  // ── Ordered lists (1. 2. 3.) ──
  body = body.replace(/(?:^[ \t]*\d+\. .+$\n?)+/gm, (match) => {
    const items = match
      .trim()
      .split("\n")
      .map((line) => `<li>${line.replace(/^[ \t]*\d+\. /, "")}</li>`);
    return `<ol>${items.join("")}</ol>`;
  });

  // ── Bold & italic ──
  body = body.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  body = body.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // ── Wiki links [[...]] ──
  body = body.replace(
    /\[\[(.+?)\]\]/g,
    '<span class="wikilink">[[&nbsp;$1&nbsp;]]</span>'
  );

  // ── Markdown tables ──
  body = body.replace(/(?:^[ \t]*\|.*\|[ \t]*(?:\r?\n|$))+/gm, (match) => {
    const rows = match.trim().split(/\r?\n/);
    if (rows.length < 2) return match;
    let html = "<table>";
    rows.forEach((row, i) => {
      if (row.match(/^\|?\s*:?-+:?\s*\|/)) return; // skip separator
      const cells = row.replace(/^\||\|$/g, "").split("|");
      html += "<tr>";
      cells.forEach((cell) => {
        const tag = i === 0 ? "th" : "td";
        html += `<${tag}>${cell.trim()}</${tag}>`;
      });
      html += "</tr>";
    });
    html += "</table>";
    return html;
  });

  // ── Line breaks (remaining newlines) ──
  body = body.replace(/\n/g, "<br/>");

  return body;
}
