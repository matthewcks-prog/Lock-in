/**
 * Express router wiring for the Lock-in API.
 *
 * This file only defines URL structure and middleware composition.
 */

const express = require('express');
const { requireSupabaseUser } = require('../middleware/authMiddleware');
const { handleLockinRequest } = require('../controllers/assistant/ai');
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
  deleteChatAsset,
} = require('../controllers/assistant/assets');
const { assetUploadMiddleware } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Main AI endpoint
router.post('/lockin', requireSupabaseUser, handleLockinRequest);

// Chat management endpoints
router.post('/chats', requireSupabaseUser, createChatSession);
router.get('/chats', requireSupabaseUser, listChats);
router.delete('/chats/:chatId', requireSupabaseUser, deleteChat);
router.get('/chats/:chatId/messages', requireSupabaseUser, listChatMessages);
router.post('/chats/:chatId/title', requireSupabaseUser, generateChatTitle);

// Chat asset endpoints
router.post('/chats/:chatId/assets', requireSupabaseUser, assetUploadMiddleware, uploadChatAsset);
router.get('/chats/:chatId/assets', requireSupabaseUser, listChatAssets);
router.delete('/chat-assets/:assetId', requireSupabaseUser, deleteChatAsset);

module.exports = router;
