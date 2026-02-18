const { createFinalChunk } = require('../../contracts');

function createGeminiStreamState() {
  let accumulatedContent = '';
  let usage = null;

  return {
    onChunk(chunk) {
      if (chunk.content) {
        accumulatedContent += chunk.content;
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
    },
    getFinalChunk() {
      return createFinalChunk(accumulatedContent, usage);
    },
  };
}

module.exports = {
  createGeminiStreamState,
};
