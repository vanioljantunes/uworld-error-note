---
phase: quick-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - saas-shell/src/app/api/extract/route.ts
  - extension/manifest.json
  - extension/content.js
  - extension/popup.html
  - extension/popup.js
  - extension/popup.css
  - extension/icons/icon16.png
  - extension/icons/icon48.png
  - extension/icons/icon128.png
autonomous: true
requirements: [QUICK-2]

must_haves:
  truths:
    - "User clicks extension on a UWorld question page and extraction JSON is returned"
    - "Extract API uses a text-optimized prompt when no quadrant images are provided"
    - "Extension captures question stem, answer choices, explanation, and educational objective from DOM"
  artifacts:
    - path: "extension/manifest.json"
      provides: "Chrome extension manifest v3"
    - path: "extension/content.js"
      provides: "Content script that extracts text from UWorld page DOM"
    - path: "extension/popup.html"
      provides: "Extension popup UI with status and server URL config"
    - path: "extension/popup.js"
      provides: "Popup logic — triggers content script, sends to API, shows result"
    - path: "saas-shell/src/app/api/extract/route.ts"
      provides: "Text-only system prompt branch for extension submissions"
  key_links:
    - from: "extension/popup.js"
      to: "extension/content.js"
      via: "chrome.tabs.sendMessage"
      pattern: "chrome\\.tabs\\.sendMessage"
    - from: "extension/popup.js"
      to: "/api/extract"
      via: "fetch POST with text body"
      pattern: "fetch.*api/extract"
---

<objective>
Create a Chrome browser extension that captures UWorld question page content from the DOM and sends it to the GapStrike extract API for structured question extraction. Also add a text-only system prompt to the extract API so it works well without screenshot quadrants.

Purpose: Eliminate the screenshot+OCR workflow — get clean text directly from the page for higher accuracy extraction.
Output: Working Chrome extension in `extension/` directory + updated extract API with text-only prompt path.
</objective>

<execution_context>
@C:/Users/vanio/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/vanio/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@saas-shell/src/app/api/extract/route.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add text-only system prompt branch to extract API</name>
  <files>saas-shell/src/app/api/extract/route.ts</files>
  <action>
    Modify the extract API to use a different system prompt when only text is provided (no quadrants).

    1. Create a TEXT_ONLY_SYSTEM_PROMPT constant alongside the existing SYSTEM_PROMPT. This new prompt should:
       - NOT reference quadrants, screenshots, or images at all
       - Instruct GPT-4o-mini that it receives raw text content from a UWorld question page
       - Keep the exact same JSON schema output (question_id, question, choosed_alternative, wrong_alternative, full_explanation, educational_objective)
       - Keep the same extraction rules but reword them for text context (e.g., "Find the question ID — a standalone number like 1736, 2513" without quadrant references)
       - Keep the same output rules (valid JSON only, no markdown)

    2. In the POST handler, select which prompt to use:
       - If quadrants are provided and non-empty: use existing SYSTEM_PROMPT (screenshot path)
       - If only text is provided (no quadrants or empty quadrants array): use TEXT_ONLY_SYSTEM_PROMPT

    3. When text-only, simplify the user content — just send the raw text without OCR/quadrant framing:
       ```
       "Below is the full text content from a UWorld question page. Extract all fields.\n\n{text}"
       ```

    4. Add CORS headers to the response to allow the extension to call the API:
       - Access-Control-Allow-Origin: "*"
       - Access-Control-Allow-Methods: "POST, OPTIONS"
       - Access-Control-Allow-Headers: "Content-Type"
       - Add an OPTIONS handler that returns 200 with these headers (preflight)

    Keep all existing screenshot-based functionality unchanged.
  </action>
  <verify>
    <automated>cd saas-shell && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Extract API compiles, uses text-only prompt when no quadrants provided, includes CORS headers for extension access</done>
</task>

<task type="auto">
  <name>Task 2: Create Chrome extension with content script and popup</name>
  <files>extension/manifest.json, extension/content.js, extension/popup.html, extension/popup.js, extension/popup.css</files>
  <action>
    Create a Chrome extension (Manifest V3) in a top-level `extension/` directory.

    **manifest.json:**
    - name: "GapStrike Extractor"
    - manifest_version: 3
    - permissions: ["activeTab"]
    - action: popup.html
    - content_scripts: match pattern for UWorld pages — use patterns ["https://*.uworld.com/*", "https://apps.uworld.com/*"] with content.js
    - icons: reference icon files (we will create simple placeholders)

    **content.js (content script):**
    Listens for messages from the popup. When it receives { action: "extract" }:

    1. Grab the page text content. Strategy for UWorld question pages:
       - Get the full document.body.innerText as a baseline
       - Also try to find specific sections if UWorld uses identifiable containers:
         - Look for elements with text "Educational Objective" and grab that section
         - Look for the question stem area
         - Look for answer choice elements (A through E/F)
         - Look for explanation text
       - If specific selectors are found, build a structured text: "QUESTION:\n{stem}\n\nANSWER CHOICES:\n{choices}\n\nEXPLANATION:\n{explanation}\n\nEDUCATIONAL OBJECTIVE:\n{objective}"
       - If specific selectors fail, fall back to document.body.innerText (still good enough for GPT extraction)
    2. Return { success: true, text: extractedText } via sendResponse
    3. Return true from the listener to keep the message channel open for async response

    **popup.html:**
    Simple UI with:
    - A text input for the server URL (default: "http://localhost:3000") — stored in chrome.storage.local
    - An "Extract" button
    - A status area showing: "Ready", "Extracting...", "Success", or error messages
    - A small result preview area (show the extracted question_id and question on success)
    - Minimal styling, dark theme to match medical study vibes

    **popup.css:**
    - Width: 350px, dark background (#1a1a2e), light text
    - Clean input field for URL, prominent extract button (#4361ee blue)
    - Status indicator with color coding (gray=ready, yellow=working, green=success, red=error)

    **popup.js:**
    1. On load: read server URL from chrome.storage.local, populate input
    2. On URL change: save to chrome.storage.local
    3. On "Extract" click:
       a. Update status to "Extracting..."
       b. Send message to active tab's content script: { action: "extract" }
       c. Receive the text back from content script
       d. POST to `{serverUrl}/api/extract` with body: { text: extractedText } (no quadrants)
       e. On success: show question_id and truncated question in result area, status "Success"
       f. On error: show error message, status "Error"
    4. Handle edge cases: no active tab, content script not injected (not on UWorld page), network errors

    **Icons:**
    Create simple placeholder SVG-based PNG icons at 16x16, 48x48, 128x128. Use a minimal "G" letter or lightning bolt shape. Since we cannot generate real PNGs easily, create a simple approach: skip the icons directory for now and remove the icons field from manifest.json (Chrome will use a default icon). Add a comment in manifest.json noting icons can be added later.
  </action>
  <verify>
    <automated>test -f extension/manifest.json && test -f extension/content.js && test -f extension/popup.html && test -f extension/popup.js && test -f extension/popup.css && node -e "JSON.parse(require('fs').readFileSync('extension/manifest.json','utf8')); console.log('manifest valid')" && echo "All extension files exist and manifest is valid JSON"</automated>
  </verify>
  <done>Chrome extension directory contains all files, manifest.json is valid, content script extracts page text, popup sends to configurable server URL and displays results</done>
</task>

</tasks>

<verification>
1. Extract API compiles: `cd saas-shell && npx tsc --noEmit`
2. Extension files exist and manifest is valid JSON
3. Manual test: load extension in chrome://extensions (developer mode), navigate to a UWorld page, click extension, verify text extraction and API call
</verification>

<success_criteria>
- Extract API has a text-only prompt path that does not reference quadrants/screenshots
- Extract API returns CORS headers allowing extension requests
- Chrome extension captures page text from UWorld pages
- Extension popup allows configuring the server URL
- Extension sends captured text to /api/extract and displays the result
</success_criteria>

<output>
After completion, create `.planning/quick/2-add-browser-extension-to-capture-page-co/2-SUMMARY.md`
</output>
