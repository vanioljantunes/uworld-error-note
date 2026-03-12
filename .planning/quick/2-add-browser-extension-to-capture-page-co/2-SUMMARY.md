---
phase: quick-2
plan: 01
subsystem: extension + api
tags: [chrome-extension, browser-extension, uworld, extract-api, cors, text-extraction]
dependency_graph:
  requires: []
  provides: [chrome-extension-extractor, text-only-extract-api-path]
  affects: [saas-shell/src/app/api/extract/route.ts]
tech_stack:
  added: [Chrome Extension Manifest V3]
  patterns: [content-script-messaging, text-only-llm-prompt-branch, CORS-headers]
key_files:
  created:
    - extension/manifest.json
    - extension/content.js
    - extension/popup.html
    - extension/popup.js
    - extension/popup.css
  modified:
    - saas-shell/src/app/api/extract/route.ts
decisions:
  - "Used chrome.storage.local for server URL persistence — no backend needed, survives extension restarts"
  - "Content script tries structured selectors first, falls back to document.body.innerText — works even if UWorld changes DOM"
  - "CORS headers added to ALL extract API responses (including errors) — extension needs them on every response code"
  - "OPTIONS preflight handler added separately — Next.js route handlers require explicit OPTIONS export"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-03-11"
  tasks_completed: 2
  files_modified: 6
---

# Quick Task 2: Add Browser Extension to Capture Page Content Summary

**One-liner:** Chrome Manifest V3 extension captures UWorld question text via DOM extraction and sends to extract API, which now routes through a text-only GPT prompt (no quadrant/screenshot references) with CORS headers for cross-origin extension access.

## What Was Built

### Task 1: Text-only prompt branch + CORS in extract API

Modified `saas-shell/src/app/api/extract/route.ts` to:

- Added `TEXT_ONLY_SYSTEM_PROMPT` — a complete system prompt for text-based extraction that removes all references to quadrants, screenshots, and OCR. Same JSON schema output, same extraction rules reworded for text context.
- Added `CORS_HEADERS` constant with `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`.
- Added `OPTIONS` export handler returning 200 with CORS headers (required for browser preflight).
- POST handler now branches: if `quadrants` is absent or empty, uses `TEXT_ONLY_SYSTEM_PROMPT` and sends simplified user content `"Below is the full text content from a UWorld question page. Extract all fields.\n\n{text}"`. If quadrants are provided, uses existing `SYSTEM_PROMPT` with multimodal content (unchanged behavior).
- CORS headers added to all `NextResponse.json(...)` calls.

### Task 2: Chrome extension

Created `extension/` directory at repo root with 5 files:

**manifest.json** — Manifest V3, name "GapStrike Extractor", permissions `activeTab` + `storage`, action popup points to `popup.html`, content script matches `https://*.uworld.com/*` and `https://apps.uworld.com/*`.

**content.js** — Content script that listens for `{ action: "extract" }` messages. Attempts structured extraction using known UWorld DOM selector patterns (data-testid attributes, class-based selectors for question stem, answer choices, explanation, educational objective). Falls back to `document.body.innerText` if selectors return nothing. Returns `{ success: true, text }` or `{ success: false, error }`.

**popup.html** — Simple UI: server URL text input, "Extract Question" button, status bar with colored dot indicator, result preview area showing question_id and truncated question stem.

**popup.css** — 350px width, dark background `#1a1a2e`, blue `#4361ee` button, color-coded status dot (gray=ready, yellow=working/pulsing, green=success, red=error).

**popup.js** — On load reads `serverUrl` from `chrome.storage.local`. On URL change saves it. On Extract click: queries active tab, validates it's on uworld.com, sends message to content script via `chrome.tabs.sendMessage`, POSTs received text to `{serverUrl}/api/extract` with `{ text }`, displays result or error.

## Deviations from Plan

### None significant

Icons were intentionally skipped per the plan's own instruction ("create a simple approach: skip the icons directory for now and remove the icons field from manifest.json"). The manifest was created without an `icons` field — Chrome uses a default icon. A comment is not in the JSON (JSON doesn't support comments) but the plan acknowledged this is intentional.

## How to Load the Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/` directory at the repo root
5. Navigate to a UWorld question page
6. Click the GapStrike Extractor icon in the toolbar
7. Confirm server URL (default: `http://localhost:3000`)
8. Click "Extract Question"

## Self-Check: PASSED

- FOUND: extension/manifest.json
- FOUND: extension/content.js
- FOUND: extension/popup.html
- FOUND: extension/popup.js
- FOUND: extension/popup.css
- FOUND: saas-shell/src/app/api/extract/route.ts
- FOUND: 7da10e4 (task 1 commit — text-only prompt + CORS)
- FOUND: efeeffe (task 2 commit — Chrome extension)
