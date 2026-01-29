// backend/services/notes/chatService.js

const notesRepo = require('../../repositories/notesRepository');
const { embedText } = require('../embeddings');
const { chatWithModel } = require('../llmClient');
const { extractPlainTextFromLexical } = require('../../utils/lexicalUtils');
const { CHAT_WITH_NOTES_SYSTEM_PROMPT } = require('../../config/prompts');

/**
 * Chat with Notes Service
 *
 * Business logic for AI-powered chat using user's notes as context.
 * Separated from controller for testability and reusability.
 */

/**
 * Chat with user's notes using AI
 *
 * @param {Object} params
 * @param {string} params.userId - User ID
 * @param {string} params.query - User's question
 * @param {string} [params.courseCode] - Optional course code filter
 * @param {number} [params.matchCount=8] - Number of notes to retrieve
 * @returns {Promise<{answer: string, usedNotes: Array}>}
 */
async function chatWithNotes({ userId, query, courseCode, matchCount = 8 }) {
  // Generate embedding for search query
  let queryEmbedding;
  try {
    queryEmbedding = await embedText(query.trim());
  } catch (embedError) {
    console.error('Failed to generate query embedding:', embedError);
    throw new Error('Failed to process search query');
  }

  // Search notes by embedding similarity
  let matches = await notesRepo.searchNotesByEmbedding({
    userId,
    queryEmbedding,
    matchCount,
  });

  // Optional filter by course code
  if (courseCode) {
    matches = matches.filter((n) => n.course_code === courseCode);
  }

  // If no notes found, return early
  if (matches.length === 0) {
    return {
      answer:
        "I couldn't find any relevant notes to answer your question. Try creating some notes first!",
      usedNotes: [],
    };
  }

  // Build context from matched notes
  const contextBlocks = matches.map((n, i) => {
    const courseInfo = n.course_code ? ` (course: ${n.course_code})` : '';
    // Use content_plain if available, otherwise extract from content_json
    const noteText =
      n.content_plain || (n.content_json ? extractPlainTextFromLexical(n.content_json) : '') || '';
    return `Note ${i + 1}${courseInfo}:\n${noteText}`;
  });

  const messages = [
    { role: 'system', content: CHAT_WITH_NOTES_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Here are my notes:\n\n${contextBlocks.join('\n\n')}\n\nMy question: ${query.trim()}`,
    },
  ];

  // Generate answer using OpenAI chat
  let answer;
  try {
    answer = await chatWithModel({ messages });
  } catch (chatError) {
    console.error('Failed to generate chat response:', chatError);
    throw new Error('Failed to generate answer');
  }

  return {
    answer,
    usedNotes: matches.map((n) => ({
      id: n.id,
      title: n.title || 'Untitled Note',
      courseCode: n.course_code || null,
    })),
  };
}

module.exports = {
  chatWithNotes,
};
