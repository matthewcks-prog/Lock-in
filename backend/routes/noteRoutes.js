// backend/routes/noteRoutes.js

const express = require('express');
const { requireSupabaseUser } = require('../authMiddleware');
const notesController = require('../controllers/notesController');
const notesChatController = require('../controllers/notesChatController');

const router = express.Router();

router.use(requireSupabaseUser);

router.post('/notes', notesController.createNote);
router.get('/notes', notesController.listNotes);
router.get('/notes/search', notesController.searchNotes);
router.put('/notes/:noteId', notesController.updateNote);
router.delete('/notes/:noteId', notesController.deleteNote);
router.post('/notes/chat', notesChatController.chatWithNotes);

module.exports = router;
