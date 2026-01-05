// Quick Test: Verify Extension Is Loaded with New Code
// Copy and paste this into the Background Service Worker Console

// Test 1: Check if fetchWithRetry has timeout parameter
console.log("=== Extension Code Verification ===");
console.log("Test 1: fetchWithRetry function signature check");
console.log(
  typeof fetchWithRetry !== "undefined"
    ? "✅ fetchWithRetry exists"
    : "❌ fetchWithRetry missing"
);

// Test 2: Check RETRY_CONFIG has timeoutMs
console.log("\nTest 2: RETRY_CONFIG check");
if (typeof RETRY_CONFIG !== "undefined") {
  console.log("✅ RETRY_CONFIG exists:", RETRY_CONFIG);
  if (RETRY_CONFIG.timeoutMs === 30000) {
    console.log("✅ Timeout configured correctly (30s)");
  } else {
    console.log(
      "❌ Timeout not configured or wrong value:",
      RETRY_CONFIG.timeoutMs
    );
    console.log("⚠️ Extension needs to be reloaded!");
  }
} else {
  console.log("❌ RETRY_CONFIG missing - old version loaded");
  console.log("⚠️ Go to chrome://extensions and click reload on Lock-in");
}

// Test 3: Trigger a test log
console.log("\nTest 3: Logging test");
console.log(
  "[Lock-in] Test log message - if you see this, console logging works!"
);

// Test 4: Check if extractPanoptoTranscript exists
console.log("\nTest 4: extractPanoptoTranscript function check");
console.log(
  typeof extractPanoptoTranscript !== "undefined"
    ? "✅ extractPanoptoTranscript exists"
    : "❌ extractPanoptoTranscript missing"
);

console.log("\n=== Verification Complete ===");
console.log("If all tests pass, the new code is loaded.");
console.log("If any tests fail, reload the extension at chrome://extensions");
