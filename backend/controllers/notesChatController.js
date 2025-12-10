// backend/controllers/notesChatController.js

const notesRepo = require('../repositories/notesRepository');
const { embedText, chatWithModel } = require('../openaiClient');
const { extractPlainTextFromLexical } = require('../utils/lexicalUtils');

// POST /api/notes/chat
// body: { query: string, courseCode?: string, k?: number }
async function chatWithNotes(req, res, next) {
  try {
    const userId = req.user.id;
    const { query, courseCode, k } = req.body;

    // Validate query parameter
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: { message: 'query is required and cannot be empty' } 
      });
    }

    // Validate and limit k parameter
    const matchCount = k ? Math.min(Math.max(parseInt(k, 10), 1), 20) : 8; // Between 1 and 20

    // Generate embedding for search query
    let queryEmbedding;
    try {
      queryEmbedding = await embedText(query.trim());
    } catch (embedError) {
      console.error('Failed to generate query embedding:', embedError);
      return res.status(500).json({ 
        success: false,
        error: { message: 'Failed to process search query' } 
      });
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
      return res.json({
        answer: "I couldn't find any relevant notes to answer your question. Try creating some notes first!",
        usedNotes: [],
      });
    }

    // Build context from matched notes
    const contextBlocks = matches.map((n, i) => {
      const courseInfo = n.course_code ? ` (course: ${n.course_code})` : '';
      // Use content_plain if available, otherwise extract from content_json
      const noteText = n.content_plain || 
        (n.content_json ? extractPlainTextFromLexical(n.content_json) : '') ||
        '';
      return `Note ${i + 1}${courseInfo}:\n${noteText}`;
    });

    const systemPrompt = `You are a study assistant that answers questions using the student's own notes.

If information is not in the notes provided, say so honestly.

Be clear and concise, and reference which note you are using when relevant.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { 
        role: 'user', 
        content: `Here are my notes:\n\n${contextBlocks.join('\n\n')}\n\nMy question: ${query.trim()}` 
      },
    ];

    // Generate answer using OpenAI chat
    let answer;
    try {
      answer = await chatWithModel({ messages });
    } catch (chatError) {
      console.error('Failed to generate chat response:', chatError);
      return res.status(500).json({ 
        success: false,
        error: { message: 'Failed to generate answer' } 
      });
    }

    res.json({
      answer,
      usedNotes: matches.map((n) => ({ 
        id: n.id, 
        title: n.title || 'Untitled Note', 
        courseCode: n.course_code || null 
      })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  chatWithNotes,
};

