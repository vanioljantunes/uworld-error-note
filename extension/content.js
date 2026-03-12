// GapStrike content script — extracts structured question data from the page DOM

chrome.runtime.onMessage.addListener(function (message, _sender, sendResponse) {
  if (message.action === "extract") {
    try {
      const extracted = extractPageContent();
      sendResponse({ success: true, ...extracted });
    } catch (err) {
      sendResponse({ success: false, error: err.message || "Extraction failed" });
    }
    return true;
  }

  if (message.action === "import-extraction") {
    try {
      importExtraction(message.extraction);
      sendResponse({ success: true });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
    return true;
  }

  return false;
});

// Import extraction into the GapStrike app — saves to Supabase + localStorage + reloads
function importExtraction(savedExtraction) {
  // Read existing extractions from localStorage
  let existing = [];
  try {
    const raw = localStorage.getItem("savedExtractions");
    if (raw) existing = JSON.parse(raw);
  } catch { /* ignore */ }

  // Prepend the new extraction
  const updated = [savedExtraction, ...existing];
  localStorage.setItem("savedExtractions", JSON.stringify(updated));

  // Save to Supabase via the app's API (content script shares origin cookies)
  fetch("/api/user-data", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: "savedExtractions", value: updated }),
  }).finally(() => {
    // Reload so the app picks up the new extraction
    window.location.reload();
  });
}

function extractPageContent() {
  // Try structured extraction first (medicospira/uworld-style pages)
  const structured = tryStructuredExtraction();
  if (structured) {
    return { mode: "structured", data: structured };
  }

  // Fallback: send raw text for GPT extraction
  return { mode: "text", text: document.body.innerText };
}

function tryStructuredExtraction() {
  // Question ID: from #exam_qusid or nav text "Question Id: XXXX"
  let questionId = null;
  const qidEl = document.getElementById("exam_qusid");
  if (qidEl) {
    const match = qidEl.innerText.match(/(\d+)/);
    if (match) questionId = match[1];
  }
  if (!questionId) {
    const match = document.body.innerText.match(/Question Id:\s*(\d+)/);
    if (match) questionId = match[1];
  }

  // Question text: #qus_txt
  const qusEl = document.getElementById("qus_txt");
  const question = qusEl ? qusEl.innerText.trim() : null;

  // If we can't find basic elements, this page doesn't match
  if (!question) return null;

  // Answer choices: #exam_choice radio buttons
  const examChoice = document.getElementById("exam_choice");
  let chosenAlternative = null;
  let correctAlternative = null;
  const choices = [];

  if (examChoice) {
    const radioGroups = examChoice.querySelectorAll(".radio");
    radioGroups.forEach((group) => {
      const input = group.querySelector("input[type=radio]");
      if (!input) return;

      const letter = input.value; // A, B, C, D, E, F
      const labelEl = group.querySelector(".radiomargin");
      const text = labelEl ? labelEl.innerText.trim() : "";
      const fullChoice = `${letter}. ${text}`;

      choices.push(fullChoice);

      // Check if this is the correct answer (has .true_answer class)
      if (group.querySelector(".true_answer")) {
        correctAlternative = fullChoice;
      }

      // Check if this is the user's wrong selection (has .false_answer class)
      if (group.querySelector(".false_answer")) {
        chosenAlternative = fullChoice;
      }

      // If checked and no false_answer marker, user got it right
      if (input.checked && !group.querySelector(".false_answer")) {
        chosenAlternative = fullChoice;
      }
    });
  }

  // If user chose correctly, wrong_alternative should be null
  const wasCorrect = chosenAlternative === correctAlternative;

  // Explanation: #explain_correct
  const expEl = document.getElementById("explain_correct");
  let fullExplanation = null;
  let educationalObjective = null;

  if (expEl) {
    const expText = expEl.innerText.trim();

    // Split at "Educational objective:" to separate explanation from objective
    const eduMatch = expText.match(/Educational objective:\s*([\s\S]+)/i);
    if (eduMatch) {
      educationalObjective = eduMatch[1].trim();
      fullExplanation = expText.substring(0, expText.indexOf("Educational objective:")).trim();
    } else {
      fullExplanation = expText;
    }
  }

  return {
    question_id: questionId,
    question: question,
    choosed_alternative: chosenAlternative,
    wrong_alternative: wasCorrect ? null : correctAlternative,
    full_explanation: fullExplanation,
    educational_objective: educationalObjective,
  };
}
