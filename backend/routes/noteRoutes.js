// backend/routes/noteRoutes.js

const express = require("express");
const { requireSupabaseUser } = require("../authMiddleware");
const notesController = require("../controllers/notesController");
const notesChatController = require("../controllers/notesChatController");
const noteAssetsController = require("../controllers/noteAssetsController");
const { assetUploadMiddleware } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(requireSupabaseUser);

router.post("/notes", notesController.createNote);
router.get("/notes", notesController.listNotes);
router.get("/notes/search", notesController.searchNotes);
router.post(
  "/notes/:noteId/assets",
  assetUploadMiddleware,
  noteAssetsController.uploadNoteAsset
);
router.get("/notes/:noteId/assets", noteAssetsController.listNoteAssets);
router.delete("/note-assets/:assetId", noteAssetsController.deleteNoteAsset);
router.get("/notes/:noteId", notesController.getNote);
router.put("/notes/:noteId", notesController.updateNote);
router.delete("/notes/:noteId", notesController.deleteNote);
router.post("/notes/chat", notesChatController.chatWithNotes);

module.exports = router;
