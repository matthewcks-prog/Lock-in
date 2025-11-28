/**
 * OpenAI Client Module
 * Handles all interactions with the OpenAI API
 */

const OpenAI = require("openai");

// Initialize OpenAI client with API key from environment
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Call OpenAI with the given system and user prompts
 * @param {string} systemPrompt - The system message defining AI behavior
 * @param {string} userPrompt - The user's input text
 * @param {string} model - The OpenAI model to use (default: gpt-4o-mini as closest to gpt-5-nano)
 * @returns {Promise<string>} - The AI's response
 */
async function callOpenAI(systemPrompt, userPrompt, model = "gpt-4o-mini") {
  try {
    // Note: GPT-5 nano is not yet available. Using gpt-4o-mini as the most efficient alternative.
    // Update this when gpt-5-nano becomes available.
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 500, // Reasonable limit for quick responses
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenAI API Error:", error.message);
    throw new Error("Failed to generate AI response");
  }
}

/**
 * Process "explain" mode request
 * @param {string} text - The text to explain
 * @returns {Promise<Object>} - Response with answer and example
 */
async function explainText(text) {
  const systemPrompt =
    "You are a friendly study tutor. Explain the user's text clearly in plain English, with a short example. Format your response as JSON with two fields: 'answer' (the explanation) and 'example' (a short concrete example).";

  const userPrompt = `Please explain this text:\n\n${text}`;

  const response = await callOpenAI(systemPrompt, userPrompt);

  // Try to parse JSON response, fallback to structured text
  try {
    return JSON.parse(response);
  } catch {
    // If AI doesn't return JSON, structure the response ourselves
    const parts = response.split(/example:/i);
    return {
      answer: parts[0].trim(),
      example: parts[1] ? parts[1].trim() : "No specific example provided.",
    };
  }
}

/**
 * Process "simplify" mode request
 * @param {string} text - The text to simplify
 * @returns {Promise<Object>} - Response with simplified answer
 */
async function simplifyText(text) {
  const systemPrompt =
    "You simplify academic text for high school / first-year university students. Use short sentences and avoid jargon. Return only the simplified version of the text.";

  const userPrompt = `Please simplify this text:\n\n${text}`;

  const response = await callOpenAI(systemPrompt, userPrompt);

  return {
    answer: response,
  };
}

/**
 * Process "translate" mode request
 * @param {string} text - The text to translate
 * @param {string} targetLanguage - Target language code (e.g., 'es', 'zh', 'en')
 * @returns {Promise<Object>} - Response with translation and explanation
 */
async function translateText(text, targetLanguage = "en") {
  const languageNames = {
    en: "English",
    es: "Spanish",
    zh: "Chinese",
    fr: "French",
    de: "German",
    ja: "Japanese",
    ko: "Korean",
    pt: "Portuguese",
    it: "Italian",
    ru: "Russian",
  };

  const langName = languageNames[targetLanguage] || targetLanguage;

  const systemPrompt = `You are a translator and tutor. Translate the text into ${langName}, then briefly explain the meaning in that language (1-3 sentences). Format your response as JSON with two fields: 'answer' (the translation) and 'explanation' (brief explanation in the target language).`;

  const userPrompt = `Please translate this text to ${langName}:\n\n${text}`;

  const response = await callOpenAI(systemPrompt, userPrompt);

  // Try to parse JSON response, fallback to structured text
  try {
    return JSON.parse(response);
  } catch {
    // If AI doesn't return JSON, use the response as the translation
    return {
      answer: response,
      explanation: "Translation completed.",
    };
  }
}

module.exports = {
  explainText,
  simplifyText,
  translateText,
};
