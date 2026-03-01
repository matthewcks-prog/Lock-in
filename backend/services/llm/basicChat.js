const { createChatCompletion } = require('./providerChain');

/**
 * Generic chat function for use with any messages array
 * @param {Array<{role: string, content: string}>} messages - Chat messages
 * @returns {Promise<string>} Assistant's response text
 */
async function chatWithModel({ messages }) {
  const completion = await createChatCompletion({
    messages,
    temperature: 0.4,
    maxTokens: 700,
    operation: 'chat.completions.create',
  });

  const choice = completion.choices[0]?.message;
  return (choice?.content || '').trim();
}

module.exports = {
  chatWithModel,
};
