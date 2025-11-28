/**
 * Lock-in Popup Script
 * Handles settings management including mode preferences, difficulty, and language
 */

// DOM elements
const highlightingToggle = document.getElementById("highlighting-toggle");
const languageSelect = document.getElementById("language-select");
const difficultyRadios = document.getElementsByName("difficulty");
const modePrefRadios = document.getElementsByName("modePreference");
const defaultModeControl = document.getElementById("default-mode-control");
const statusMessage = document.getElementById("status-message");

/**
 * Load saved settings from chrome.storage.sync when popup opens
 */
function loadSettings() {
  chrome.storage.sync.get(
    [
      "highlightingEnabled",
      "preferredLanguage",
      "difficultyLevel",
      "defaultMode",
      "modePreference",
      "lastUsedMode",
    ],
    (data) => {
      // Set highlighting toggle (default to true)
      highlightingToggle.checked = data.highlightingEnabled !== false;

      // Set translation language
      if (data.preferredLanguage) {
        languageSelect.value = data.preferredLanguage;
      }

      // Set difficulty level
      const difficulty = data.difficultyLevel || "highschool";
      difficultyRadios.forEach((radio) => {
        if (radio.value === difficulty) {
          radio.checked = true;
        }
      });

      // Set mode preference (fixed or lastUsed)
      const modePref = data.modePreference || "fixed";
      modePrefRadios.forEach((radio) => {
        if (radio.value === modePref) {
          radio.checked = true;
        }
      });

      // Set default mode (explain, simplify, or translate)
      const defaultMode = data.defaultMode || "explain";
      setActiveMode(defaultMode);

      // Toggle segmented control enabled state based on mode preference
      toggleModeControlState(modePref === "fixed");
    }
  );
}

/**
 * Set the active mode button in the segmented control
 */
function setActiveMode(mode) {
  const buttons = defaultModeControl.querySelectorAll(".segment-btn");
  buttons.forEach((btn) => {
    if (btn.dataset.mode === mode) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

/**
 * Toggle whether the mode control is enabled/disabled
 */
function toggleModeControlState(enabled) {
  const buttons = defaultModeControl.querySelectorAll(".segment-btn");
  buttons.forEach((btn) => {
    btn.style.opacity = enabled ? "1" : "0.5";
    btn.style.pointerEvents = enabled ? "auto" : "none";
  });
}

/**
 * Save settings to chrome.storage.sync
 * Automatically saves whenever any setting changes
 */
function saveSettings() {
  const highlightingEnabled = highlightingToggle.checked;
  const preferredLanguage = languageSelect.value;

  let difficultyLevel = "highschool";
  difficultyRadios.forEach((radio) => {
    if (radio.checked) {
      difficultyLevel = radio.value;
    }
  });

  let modePreference = "fixed";
  modePrefRadios.forEach((radio) => {
    if (radio.checked) {
      modePreference = radio.value;
    }
  });

  // Get active default mode
  const activeBtn = defaultModeControl.querySelector(".segment-btn.active");
  const defaultMode = activeBtn ? activeBtn.dataset.mode : "explain";

  chrome.storage.sync.set(
    {
      highlightingEnabled,
      preferredLanguage,
      difficultyLevel,
      modePreference,
      defaultMode,
    },
    () => {
      showStatus("Saved &check;", "success");
    }
  );
}

/**
 * Show status message
 */
function showStatus(message, type = "success") {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;

  // Auto-hide after 2 seconds
  setTimeout(() => {
    statusMessage.className = "status-message";
  }, 2000);
}

// Event listeners

// Highlighting toggle
highlightingToggle.addEventListener("change", saveSettings);

// Mode preference radio change
modePrefRadios.forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const isFixed = e.target.value === "fixed";
    toggleModeControlState(isFixed);
    saveSettings();
  });
});

// Default mode segmented control clicks
defaultModeControl.addEventListener("click", (e) => {
  const btn = e.target.closest(".segment-btn");
  if (!btn) return;

  setActiveMode(btn.dataset.mode);
  saveSettings();
});

// Language and difficulty changes
languageSelect.addEventListener("change", saveSettings);
difficultyRadios.forEach((radio) => {
  radio.addEventListener("change", saveSettings);
});

// Load settings when popup opens
document.addEventListener("DOMContentLoaded", loadSettings);
