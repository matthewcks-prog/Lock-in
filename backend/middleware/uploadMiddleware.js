const multer = require('multer');
const {
  NOTE_ASSETS_MAX_BYTES,
  ALLOWED_ASSET_MIME_TYPES,
  CHAT_ASSETS_MAX_BYTES,
  ALLOWED_CHAT_ASSET_MIME_TYPES,
} = require('../config');
const HTTP_STATUS = require('../constants/httpStatus');

const storage = multer.memoryStorage();

function createMimeFilter(allowedMimeTypes) {
  return function mimeFilter(_req, file, cb) {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      const error = new Error('File type not allowed');
      error.status = HTTP_STATUS.BAD_REQUEST;
      return cb(error);
    }
    cb(null, true);
  };
}

const noteUpload = multer({
  storage,
  limits: { fileSize: NOTE_ASSETS_MAX_BYTES },
  fileFilter: createMimeFilter(ALLOWED_ASSET_MIME_TYPES),
});

const chatUpload = multer({
  storage,
  limits: { fileSize: CHAT_ASSETS_MAX_BYTES },
  fileFilter: createMimeFilter(ALLOWED_CHAT_ASSET_MIME_TYPES),
});

function createUploadMiddleware(multerInstance, maxBytes) {
  return function uploadMiddleware(req, res, next) {
    multerInstance.single('file')(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            error: `File too large. Max size is ${maxBytes} bytes`,
          });
        }
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: err.message });
      }

      const status = err.status || HTTP_STATUS.BAD_REQUEST;
      return res.status(status).json({ error: err.message || 'Upload failed' });
    });
  };
}

const assetUploadMiddleware = createUploadMiddleware(noteUpload, NOTE_ASSETS_MAX_BYTES);
const chatAssetUploadMiddleware = createUploadMiddleware(chatUpload, CHAT_ASSETS_MAX_BYTES);

module.exports = {
  assetUploadMiddleware,
  chatAssetUploadMiddleware,
};
