// GapStrike Extractor popup script

const DEFAULT_SERVER_URL = "http://localhost:3000";

const serverUrlInput = document.getElementById("server-url");
const extractBtn = document.getElementById("extract-btn");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const resultArea = document.getElementById("result-area");
const resultId = document.getElementById("result-id");
const resultQuestion = document.getElementById("result-question");

// Load saved server URL on startup
chrome.storage.local.get(["serverUrl"], (result) => {
  serverUrlInput.value = result.serverUrl || DEFAULT_SERVER_URL;
});

// Save server URL whenever it changes
serverUrlInput.addEventListener("input", () => {
  chrome.storage.local.set({ serverUrl: serverUrlInput.value.trim() });
});

// Extract button click handler
extractBtn.addEventListener("click", async () => {
  const serverUrl = (serverUrlInput.value.trim() || DEFAULT_SERVER_URL).replace(/\/$/, "");

  setStatus("working", "Extracting...");
  extractBtn.disabled = true;
  hideResult();

  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      setStatus("error", "No active tab found");
      extractBtn.disabled = false;
      return;
    }

    // Send message to content script to extract page content
    let contentResponse;
    try {
      contentResponse = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: "extract" }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    } catch (err) {
      setStatus("error", "Content script not loaded. Reload the page and try again.");
      extractBtn.disabled = false;
      return;
    }

    if (!contentResponse || !contentResponse.success) {
      const errMsg = contentResponse?.error || "Content script extraction failed";
      setStatus("error", errMsg);
      extractBtn.disabled = false;
      return;
    }

    let result;

    if (contentResponse.mode === "structured" && contentResponse.data) {
      // Structured extraction — data is already parsed from DOM
      result = contentResponse.data;
    } else if (contentResponse.mode === "text" && contentResponse.text) {
      // Text fallback — send to API for GPT extraction
      const text = contentResponse.text;
      if (!text || text.trim().length === 0) {
        setStatus("error", "No text found on page");
        extractBtn.disabled = false;
        return;
      }

      setStatus("working", "Sending to API...");

      try {
        const res = await fetch(`${serverUrl}/api/extract`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const apiResponse = await res.json();
        result = Array.isArray(apiResponse.result)
          ? apiResponse.result[0]
          : apiResponse.result;
      } catch (err) {
        setStatus("error", `API error: ${err.message}`);
        extractBtn.disabled = false;
        return;
      }
    } else {
      setStatus("error", "No content extracted");
      extractBtn.disabled = false;
      return;
    }

    if (!result) {
      setStatus("error", "Empty result");
      extractBtn.disabled = false;
      return;
    }

    // Show preview in popup
    const questionIdDisplay = result.question_id
      ? `Question #${result.question_id}`
      : "Question ID: not found";

    const questionPreview = result.question
      ? result.question.slice(0, 200) + (result.question.length > 200 ? "..." : "")
      : "Question text not found";

    showResult(questionIdDisplay, questionPreview);

    // Send extraction to GapStrike app tab
    setStatus("working", "Saving to GapStrike...");
    const saved = await saveToGapStrike(serverUrl, result);

    if (saved) {
      setStatus("success", "Saved to GapStrike");
    } else {
      setStatus("success", "Extracted (GapStrike tab not found — open the app to sync)");
      // Store in chrome.storage as fallback
      chrome.storage.local.set({ pendingExtraction: result });
    }

  } catch (err) {
    setStatus("error", `Unexpected error: ${err.message}`);
  } finally {
    extractBtn.disabled = false;
  }
});

// Find the GapStrike app tab and inject the extraction into its localStorage
async function saveToGapStrike(serverUrl, extraction) {
  // Build the SavedExtraction object matching the app's format
  const savedExtraction = {
    id: Date.now().toString(),
    questionId: extraction.question_id || null,
    title: extraction.educational_objective ||
           (extraction.question ? extraction.question.slice(0, 50) + "…" : "New Extraction"),
    extraction: extraction,
    savedAt: Date.now(),
  };

  // Find GapStrike tabs — check both localhost and deployed URL
  const allTabs = await chrome.tabs.query({});
  const gapStrikeTab = allTabs.find(t => {
    const url = t.url || "";
    return url.includes("gapstrike") || url.includes(serverUrl.replace(/^https?:\/\//, ""));
  });

  if (!gapStrikeTab || !gapStrikeTab.id) {
    return false;
  }

  // Send the extraction to the GapStrike tab's content script
  try {
    await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        gapStrikeTab.id,
        { action: "import-extraction", extraction: savedExtraction },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }
      );
    });
    return true;
  } catch {
    return false;
  }
}

function setStatus(state, message) {
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = message;
}

function showResult(id, question) {
  resultId.textContent = id;
  resultQuestion.textContent = question;
  resultArea.classList.add("visible");
}

function hideResult() {
  resultArea.classList.remove("visible");
  resultId.textContent = "";
  resultQuestion.textContent = "";
}
