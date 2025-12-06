// backend/controllers/notesChatController.js

const notesRepo = require('../repositories/notesRepository');
const { embedText, chatWithModel } = require('../openaiClient');

// POST /api/notes/chat
// body: { query: string, courseCode?: string, k?: number }
async function chatWithNotes(req, res, next) {
  try {
    const userId = req.user.id;
    const { query, courseCode, k } = req.body;

    if (!query) return res.status(400).json({ error: 'query is required' });

    const queryEmbedding = await embedText(query);

    let matches = await notesRepo.searchNotesByEmbedding({
      userId,
      queryEmbedding,
      matchCount: k || 8,
    });

    if (courseCode) {
      matches = matches.filter((n) => n.course_code === courseCode);
    }

    // build context
    const contextBlocks = matches.map((n, i) => {
      return `Note ${i + 1} (course: ${n.course_code || 'N/A'}):
${n.content}`;
    });

    const systemPrompt = `
You are a study assistant that answers questions using the student's own notes.

If information is not in the notes provided, say so honestly.

Be clear and concise, and reference which note you are using when relevant.
`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Here are my notes:\n\n${contextBlocks.join('\n\n')}\n\nMy question: ${query}` },
    ];

    const answer = await chatWithModel({ messages });

    res.json({
      answer,
      usedNotes: matches.map((n) => ({ id: n.id, title: n.title, courseCode: n.course_code })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  chatWithNotes,
};

