/**
 * Express router wiring for the Lock-in API.
 *
 * This file only defines URL structure and middleware composition.
 * All validation is handled by Zod middleware - NO imperative validation in controllers.
 */

const express = require('express');
const { requireSupabaseUser } = require('../middleware/authMiddleware');
const { handleLockinRequest } = require('../controllers/assistant/ai');
const { handleLockinStreamRequest } = require('../controllers/assistant/stream');
const {
  createChatSession,
  listChats,
  deleteChat,
  listChatMessages,
} = require('../controllers/assistant/chat');
const { generateChatTitle } = require('../controllers/assistant/title');
const {
  uploadChatAsset,
  listChatAssets,
  getChatAssetStatus,
  deleteChatAsset,
} = require('../controllers/assistant/assets');
const { assetUploadMiddleware } = require('../middleware/uploadMiddleware');
const { validate, validateQuery, validateParams } = require('../validators/middleware');
const {
  lockinRequestSchema,
  chatIdParamSchema,
  createChatSessionSchema,
  listChatsQuerySchema,
  assetIdParamSchema,
} = require('../validators/assistantValidators');

const router = express.Router();

// Main AI endpoint (blocking request/response)
router.post('/lockin', requireSupabaseUser, validate(lockinRequestSchema), handleLockinRequest);

// Streaming AI endpoint (SSE)
router.post(
  '/lockin/stream',
  requireSupabaseUser,
  validate(lockinRequestSchema),
  handleLockinStreamRequest,
);

// Chat management endpoints
router.post('/chats', requireSupabaseUser, validate(createChatSessionSchema), createChatSession);
router.get('/chats', requireSupabaseUser, validateQuery(listChatsQuerySchema), listChats);
router.delete('/chats/:chatId', requireSupabaseUser, validateParams(chatIdParamSchema), deleteChat);
router.get(
  '/chats/:chatId/messages',
  requireSupabaseUser,
  validateParams(chatIdParamSchema),
  listChatMessages,
);
router.post(
  '/chats/:chatId/title',
  requireSupabaseUser,
  validateParams(chatIdParamSchema),
  generateChatTitle,
);

// Chat asset endpoints
router.post(
  '/chats/:chatId/assets',
  requireSupabaseUser,
  validateParams(chatIdParamSchema),
  assetUploadMiddleware,
  uploadChatAsset,
);
router.get(
  '/chats/:chatId/assets',
  requireSupabaseUser,
  validateParams(chatIdParamSchema),
  listChatAssets,
);
router.delete(
  '/chat-assets/:assetId',
  requireSupabaseUser,
  validateParams(assetIdParamSchema),
  deleteChatAsset,
);
router.get(
  '/chat-assets/:assetId/status',
  requireSupabaseUser,
  validateParams(assetIdParamSchema),
  getChatAssetStatus,
);

module.exports = router;
