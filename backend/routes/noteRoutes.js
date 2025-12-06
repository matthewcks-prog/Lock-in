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
router.post('/notes/chat', notesChatController.chatWithNotes);

module.exports = router;

