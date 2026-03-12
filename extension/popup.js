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

    // Check if we're on a UWorld page
    const url = tab.url || "";
    if (!url.includes("uworld.com")) {
      setStatus("error", "Navigate to a UWorld question page first");
      extractBtn.disabled = false;
      return;
    }

    // Send message to content script to extract page text
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
      setStatus(
        "error",
        "Could not reach content script. Try reloading the UWorld page."
      );
      extractBtn.disabled = false;
      return;
    }

    if (!contentResponse || !contentResponse.success) {
      const errMsg = contentResponse?.error || "Content script extraction failed";
      setStatus("error", errMsg);
      extractBtn.disabled = false;
      return;
    }

    const { text } = contentResponse;

    if (!text || text.trim().length === 0) {
      setStatus("error", "No text found on page");
      extractBtn.disabled = false;
      return;
    }

    setStatus("working", "Sending to API...");

    // POST text to the extract API
    let apiResponse;
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

      apiResponse = await res.json();
    } catch (err) {
      setStatus("error", `API error: ${err.message}`);
      extractBtn.disabled = false;
      return;
    }

    // Show results
    const result = Array.isArray(apiResponse.result)
      ? apiResponse.result[0]
      : apiResponse.result;

    if (!result) {
      setStatus("error", "Empty response from API");
      extractBtn.disabled = false;
      return;
    }

    const questionIdDisplay = result.question_id
      ? `Question #${result.question_id}`
      : "Question ID: not found";

    const questionPreview = result.question
      ? result.question.slice(0, 200) + (result.question.length > 200 ? "..." : "")
      : "Question text not found";

    showResult(questionIdDisplay, questionPreview);
    setStatus("success", "Success");
  } catch (err) {
    setStatus("error", `Unexpected error: ${err.message}`);
  } finally {
    extractBtn.disabled = false;
  }
});

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
