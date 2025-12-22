(function(exports) {
  "use strict";
  const HTML_ENTITIES = {
    "&#39;": "'",
    "&#x27;": "'",
    "&apos;": "'",
    "&#34;": '"',
    "&#x22;": '"',
    "&quot;": '"',
    "&amp;": "&",
    "&#38;": "&",
    "&lt;": "<",
    "&#60;": "<",
    "&gt;": ">",
    "&#62;": ">",
    "&nbsp;": " ",
    "&#160;": " ",
    "&#8217;": "\u2019",
    // Right single quote
    "&#8216;": "\u2018",
    // Left single quote
    "&#8220;": "\u201c",
    // Left double quote
    "&#8221;": "\u201d",
    // Right double quote
    "&#8211;": "\u2013",
    // En dash
    "&#8212;": "\u2014",
    // Em dash
    "&#8230;": "\u2026"
    // Ellipsis
  };
  function decodeHtmlEntities(text) {
    let result = text;
    for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
      result = result.split(entity).join(char);
    }
    result = result.replace(/&#(\d+);/g, (_, code) => {
      return String.fromCharCode(parseInt(code, 10));
    });
    result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => {
      return String.fromCharCode(parseInt(code, 16));
    });
    return result;
  }
  function parseVttTimestamp(timestamp) {
    const parts = timestamp.trim().split(":");
    if (parts.length < 2 || parts.length > 3) {
      return 0;
    }
    let hours = 0;
    let minutes;
    let seconds;
    if (parts.length === 3) {
      hours = parseInt(parts[0], 10) || 0;
      minutes = parseInt(parts[1], 10) || 0;
      seconds = parseFloat(parts[2]) || 0;
    } else {
      minutes = parseInt(parts[0], 10) || 0;
      seconds = parseFloat(parts[1]) || 0;
    }
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1e3);
  }
  function stripVttTags(text) {
    let result = text.replace(/<v[^>]*>/gi, "").replace(/<\/v>/gi, "");
    result = result.replace(/<c[^>]*>/gi, "").replace(/<\/c>/gi, "");
    result = result.replace(/<\/?(?:b|i|u|ruby|rt|lang)[^>]*>/gi, "");
    return result.trim();
  }
  function parseWebVtt(vttContent) {
    const lines = vttContent.split(/\r?\n/);
    const segments = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line === "" || line.startsWith("WEBVTT") || line.startsWith("NOTE") || line.startsWith("STYLE")) {
        i++;
        if (line.startsWith("NOTE") || line.startsWith("STYLE")) {
          while (i < lines.length && lines[i].trim() !== "") {
            i++;
          }
        }
        continue;
      }
      break;
    }
    while (i < lines.length) {
      const line = lines[i].trim();
      if (line === "") {
        i++;
        continue;
      }
      const timestampMatch = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?)\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?)/);
      if (!timestampMatch) {
        i++;
        continue;
      }
      const startMs = parseVttTimestamp(timestampMatch[1]);
      const endMs = parseVttTimestamp(timestampMatch[2]);
      i++;
      const textLines = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i]);
        i++;
      }
      if (textLines.length > 0) {
        let text = textLines.join(" ");
        text = stripVttTags(text);
        text = decodeHtmlEntities(text);
        text = text.replace(/\s+/g, " ").trim();
        if (text) {
          segments.push({ startMs, endMs, text });
        }
      }
    }
    const plainText = segments.map((s) => s.text).join(" ");
    const durationMs = segments.length > 0 ? segments[segments.length - 1].endMs : 0;
    return {
      plainText,
      segments,
      durationMs
    };
  }
  function formatAsVtt(segments) {
    const lines = ["WEBVTT", ""];
    segments.forEach((segment, index) => {
      lines.push(String(index + 1));
      lines.push(`${formatVttTimestamp(segment.startMs)} --> ${formatVttTimestamp(segment.endMs)}`);
      lines.push(segment.text);
      lines.push("");
    });
    return lines.join("\n");
  }
  function formatVttTimestamp(ms) {
    const totalSeconds = Math.floor(ms / 1e3);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds % 3600 / 60);
    const seconds = totalSeconds % 60;
    const millis = ms % 1e3;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
  }
  exports.decodeHtmlEntities = decodeHtmlEntities;
  exports.formatAsVtt = formatAsVtt;
  exports.parseVttTimestamp = parseVttTimestamp;
  exports.parseWebVtt = parseWebVtt;
})(this.LockInWebVtt = this.LockInWebVtt || {});
//# sourceMappingURL=webvttParser.js.map
