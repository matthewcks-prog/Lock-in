/**
 * Utility functions for working with Lexical editor JSON
 */

/**
 * Extract plain text from Lexical editor state JSON
 * @param {any} editorState - Lexical editor state (object or JSON string)
 * @returns {string} Plain text extracted from the editor state
 */
function extractPlainTextFromLexical(editorState) {
  if (!editorState) return '';

  // Parse if it's a string
  let state;
  try {
    state = typeof editorState === 'string' ? JSON.parse(editorState) : editorState;
  } catch {
    return '';
  }

  if (!state || typeof state !== 'object') return '';

  /**
   * Recursively collect text from a Lexical node
   * @param {any} node - Lexical node
   * @returns {string} Collected text
   */
  function collectText(node) {
    if (!node || typeof node !== 'object') return '';

    // If node has text property, return it
    if (typeof node.text === 'string') {
      return node.text;
    }

    // If node has children, recursively collect text from them
    if (Array.isArray(node.children)) {
      return node.children.map(collectText).filter(Boolean).join(' ');
    }

    return '';
  }

  // Extract text from root node
  const root = state.root;
  if (!root || typeof root !== 'object') return '';

  const segments = Array.isArray(root.children)
    ? root.children.map(collectText).filter(Boolean)
    : [];

  return segments.join(' ').trim();
}

module.exports = {
  extractPlainTextFromLexical,
};








