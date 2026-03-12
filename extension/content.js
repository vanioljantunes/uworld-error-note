// GapStrike content script — extracts text from UWorld question pages

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (message.action !== "extract") {
    return false;
  }

  try {
    const extracted = extractPageContent();
    sendResponse({ success: true, text: extracted });
  } catch (err) {
    sendResponse({ success: false, error: err.message || "Extraction failed" });
  }

  // Return true to keep message channel open for async sendResponse
  return true;
});

function extractPageContent() {
  let questionText = "";
  let choicesText = "";
  let explanationText = "";
  let objectiveText = "";

  // Try to find structured sections on the UWorld page
  const allText = document.body.innerText;

  // Strategy: try known UWorld DOM patterns first, fall back to full body text

  // 1. Look for question stem — UWorld typically wraps question in a specific container
  const questionSelectors = [
    "[data-testid='question-stem']",
    ".question-text",
    ".questionText",
    ".stem",
    "[class*='question'][class*='stem']",
    "[class*='questionStem']",
  ];

  for (const sel of questionSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 20) {
      questionText = el.innerText.trim();
      break;
    }
  }

  // 2. Look for answer choices
  const choiceSelectors = [
    "[data-testid='answer-choice']",
    ".answer-choice",
    ".answerChoice",
    "[class*='answerChoice']",
    "[class*='answer-choice']",
    "[class*='choice']",
  ];

  const choiceElements = [];
  for (const sel of choiceSelectors) {
    const els = document.querySelectorAll(sel);
    if (els.length >= 2) {
      els.forEach((el) => choiceElements.push(el.innerText.trim()));
      break;
    }
  }

  if (choiceElements.length > 0) {
    choicesText = choiceElements.join("\n");
  }

  // 3. Look for explanation
  const explanationSelectors = [
    "[data-testid='explanation']",
    ".explanation",
    "[class*='explanation']",
    "[class*='Explanation']",
  ];

  for (const sel of explanationSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 20) {
      explanationText = el.innerText.trim();
      break;
    }
  }

  // 4. Look for Educational Objective — search by text content
  const allElements = document.querySelectorAll("*");
  for (const el of allElements) {
    const text = el.innerText || "";
    if (
      text.includes("Educational Objective") &&
      el.children.length < 5 &&
      text.length < 2000
    ) {
      const idx = text.indexOf("Educational Objective");
      if (idx !== -1) {
        objectiveText = text.slice(idx).trim();
        break;
      }
    }
  }

  // If we found structured sections, build a labeled text
  const hasStructured =
    questionText || choicesText || explanationText || objectiveText;

  if (hasStructured) {
    const parts = [];
    if (questionText) parts.push(`QUESTION:\n${questionText}`);
    if (choicesText) parts.push(`ANSWER CHOICES:\n${choicesText}`);
    if (explanationText) parts.push(`EXPLANATION:\n${explanationText}`);
    if (objectiveText) parts.push(`EDUCATIONAL OBJECTIVE:\n${objectiveText}`);

    // If we got some sections but not all, append full body text as fallback
    if (parts.length < 3) {
      parts.push(`FULL PAGE TEXT (fallback):\n${allText}`);
    }

    return parts.join("\n\n");
  }

  // Fallback: return full page text
  return allText;
}
