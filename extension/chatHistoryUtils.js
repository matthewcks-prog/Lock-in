(function () {
  /**
   * Utility helpers for building and rendering chat history.
   * Exposed on window.LockInChatHistoryUtils so they can be reused and unit tested.
   */

  function buildFallbackHistoryTitle(chat) {
    if (!chat) {
      return "Untitled chat";
    }
    const timestamp = chat.created_at || chat.updated_at;
    if (!timestamp) {
      return "Untitled chat";
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return "Untitled chat";
    }
    return `Chat from ${date.toISOString().split("T")[0]}`;
  }

  function formatHistoryTimestamp(timestamp) {
    if (!timestamp) {
      return "Just now";
    }
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) {
      return minutes <= 1 ? "Just now" : `${minutes} min ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hr${hours > 1 ? "s" : ""} ago`;
    }
    return date.toLocaleDateString();
  }

  function convertRowsToChatHistory(rows) {
    const safeRows = Array.isArray(rows) ? rows : [];
    return safeRows
      .map((row) => {
        const role = row.role || "assistant";
        const text =
          role === "assistant"
            ? row.output_text || ""
            : row.input_text || row.output_text || "";
        if (!text) {
          return null;
        }
        return { role, content: text };
      })
      .filter(Boolean);
  }

  /**
   * Escape HTML to prevent XSS when rendering untrusted content.
   */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = typeof text === "string" ? text : "";
    return div.innerHTML;
  }

  window.LockInChatHistoryUtils = {
    buildFallbackHistoryTitle,
    formatHistoryTimestamp,
    convertRowsToChatHistory,
    escapeHtml,
  };
})();


