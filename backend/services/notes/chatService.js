// backend/services/notes/chatService.js

const notesRepo = require('../../repositories/notesRepository');
const { embedText } = require('../embeddings');
const { chatWithModel } = require('../llmClient');
const { extractPlainTextFromLexical } = require('../../utils/lexicalUtils');
const { CHAT_WITH_NOTES_SYSTEM_PROMPT } = require('../../config/prompts');
const DEFAULT_MATCH_COUNT = 8;
const NO_MATCHES_ANSWER =
  "I couldn't find any relevant notes to answer your question. Try creating some notes first!";

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
 * @param {number} [params.matchCount=DEFAULT_MATCH_COUNT] - Number of notes to retrieve
 * @returns {Promise<{answer: string, usedNotes: Array}>}
 */
async function generateQueryEmbedding(query) {
  let queryEmbedding;
  try {
    queryEmbedding = await embedText(query.trim());
  } catch (embedError) {
    console.error('Failed to generate query embedding:', embedError);
    throw new Error('Failed to process search query');
  }
  return queryEmbedding;
}

function filterMatchesByCourse(matches, courseCode) {
  if (courseCode) {
    return matches.filter((n) => n.course_code === courseCode);
  }
  return matches;
}

function getNoteText(note) {
  return (
    note.content_plain ||
    (note.content_json ? extractPlainTextFromLexical(note.content_json) : '') ||
    ''
  );
}

function buildContextBlocks(matches) {
  return matches.map((note, index) => {
    const courseInfo = note.course_code ? ` (course: ${note.course_code})` : '';
    return `Note ${index + 1}${courseInfo}:\n${getNoteText(note)}`;
  });
}

function buildMessages(query, contextBlocks) {
  return [
    { role: 'system', content: CHAT_WITH_NOTES_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Here are my notes:\n\n${contextBlocks.join('\n\n')}\n\nMy question: ${query.trim()}`,
    },
  ];
}

async function generateChatAnswer(messages) {
  try {
    return await chatWithModel({ messages });
  } catch (chatError) {
    console.error('Failed to generate chat response:', chatError);
    throw new Error('Failed to generate answer');
  }
}

function mapUsedNotes(matches) {
  return matches.map((note) => ({
    id: note.id,
    title: note.title || 'Untitled Note',
    courseCode: note.course_code || null,
  }));
}

function createNoMatchesResponse() {
  return { answer: NO_MATCHES_ANSWER, usedNotes: [] };
}

async function chatWithNotes({ userId, query, courseCode, matchCount = DEFAULT_MATCH_COUNT }) {
  const queryEmbedding = await generateQueryEmbedding(query);
  let matches = await notesRepo.searchNotesByEmbedding({
    userId,
    queryEmbedding,
    matchCount,
  });
  matches = filterMatchesByCourse(matches, courseCode);

  if (matches.length === 0) {
    return createNoMatchesResponse();
  }

  const messages = buildMessages(query, buildContextBlocks(matches));
  const answer = await generateChatAnswer(messages);

  return {
    answer,
    usedNotes: mapUsedNotes(matches),
  };
}

module.exports = {
  chatWithNotes,
};
