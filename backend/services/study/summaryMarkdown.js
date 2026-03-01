function trimIncompleteMarkdownTail(text) {
  if (!text || text.length === 0) return text;

  const lines = text.split('\n');
  const endsComplete = /[.!?)\]|"'>][\s*_`]*$/;

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const trimmed = lines[index].trimEnd();
    if (trimmed.length === 0) continue;

    if (trimmed.startsWith('#')) {
      const hasBodyBelow = lines.slice(index + 1).some((line) => line.trim().length > 0);
      if (hasBodyBelow) {
        return lines
          .slice(0, index + 1)
          .join('\n')
          .trim();
      }

      const hasContentAbove = lines.slice(0, index).some((line) => line.trim().length > 0);
      if (hasContentAbove) {
        return lines.slice(0, index).join('\n').trim();
      }

      return trimmed;
    }

    if (endsComplete.test(trimmed)) {
      return lines
        .slice(0, index + 1)
        .join('\n')
        .trim();
    }
  }

  return text.trim();
}

module.exports = {
  trimIncompleteMarkdownTail,
};
