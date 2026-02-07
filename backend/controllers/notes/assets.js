const { noteAssetsService } = require('../../services/notes/noteAssetsService');
const HTTP_STATUS = require('../../constants/httpStatus');

// POST /api/notes/:noteId/assets
async function uploadNoteAsset(req, res, next) {
  try {
    const userId = req.user?.id;
    const { noteId } = req.params;
    const asset = await noteAssetsService.uploadNoteAsset({
      userId,
      noteId,
      file: req.file,
    });
    res.status(HTTP_STATUS.CREATED).json(asset);
  } catch (err) {
    next(err);
  }
}

// GET /api/notes/:noteId/assets
async function listNoteAssets(req, res, next) {
  try {
    const userId = req.user?.id;
    const { noteId } = req.params;
    const assets = await noteAssetsService.listNoteAssets({ userId, noteId });
    res.json(assets);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/note-assets/:assetId
async function deleteNoteAsset(req, res, next) {
  try {
    const userId = req.user?.id;
    const { assetId } = req.params;
    await noteAssetsService.deleteNoteAsset({ userId, assetId });
    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadNoteAsset,
  listNoteAssets,
  deleteNoteAsset,
};
