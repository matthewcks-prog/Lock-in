// backend/routes/noteRoutes.js

const express = require('express');
const { requireSupabaseUser } = require('../authMiddleware');
const notesController = require('../controllers/notes/crud');
const notesChatController = require('../controllers/notes/chat');
const noteAssetsController = require('../controllers/notes/assets');
const { assetUploadMiddleware } = require('../middleware/uploadMiddleware');
const { validate, validateQuery, validateParams } = require('../validators/middleware');
const {
  createNoteSchema,
  updateNoteSchema,
  noteIdParamSchema,
  searchNotesSchema,
  listNotesSchema,
  chatWithNotesSchema,
  setStarredSchema,
} = require('../validators/noteValidators');

const router = express.Router();

router.use(requireSupabaseUser);

router.post('/notes', validate(createNoteSchema), notesController.createNote);
router.get('/notes', validateQuery(listNotesSchema), notesController.listNotes);
router.get('/notes/search', validateQuery(searchNotesSchema), notesController.searchNotes);
router.post('/notes/:noteId/assets', assetUploadMiddleware, noteAssetsController.uploadNoteAsset);
router.get('/notes/:noteId/assets', noteAssetsController.listNoteAssets);
router.delete('/note-assets/:assetId', noteAssetsController.deleteNoteAsset);
router.get('/notes/:noteId', validateParams(noteIdParamSchema), notesController.getNote);
router.put(
  '/notes/:noteId',
  validateParams(noteIdParamSchema),
  validate(updateNoteSchema),
  notesController.updateNote,
);
router.delete('/notes/:noteId', validateParams(noteIdParamSchema), notesController.deleteNote);
router.patch(
  '/notes/:noteId/star',
  validateParams(noteIdParamSchema),
  notesController.toggleStarred,
);
router.put(
  '/notes/:noteId/star',
  validateParams(noteIdParamSchema),
  validate(setStarredSchema),
  notesController.setStarred,
);
router.post('/notes/chat', validate(chatWithNotesSchema), notesChatController.chatWithNotes);

module.exports = router;
