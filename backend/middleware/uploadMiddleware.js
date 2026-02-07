const multer = require('multer');
const { NOTE_ASSETS_MAX_BYTES, ALLOWED_ASSET_MIME_TYPES } = require('../config');
const HTTP_STATUS = require('../constants/httpStatus');

const storage = multer.memoryStorage();

function assetFileFilter(req, file, cb) {
  if (!ALLOWED_ASSET_MIME_TYPES.includes(file.mimetype)) {
    const error = new Error('File type not allowed');
    error.status = HTTP_STATUS.BAD_REQUEST;
    return cb(error);
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: NOTE_ASSETS_MAX_BYTES },
  fileFilter: assetFileFilter,
});

// Wrap multer to provide consistent error responses
function assetUploadMiddleware(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: `File too large. Max size is ${NOTE_ASSETS_MAX_BYTES} bytes`,
        });
      }
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: err.message });
    }

    const status = err.status || HTTP_STATUS.BAD_REQUEST;
    return res.status(status).json({ error: err.message || 'Upload failed' });
  });
}

module.exports = {
  assetUploadMiddleware,
};
