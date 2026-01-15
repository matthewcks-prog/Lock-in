/**
 * Express router wiring for the Lock-in API.
 *
 * This file only defines URL structure and middleware composition.
 */

const express = require('express');
const { requireSupabaseUser } = require('../authMiddleware');
const {
  handleLockinRequest,
  createChatSession,
  listChats,
  deleteChat,
  listChatMessages,
  generateChatTitle,
} = require('../controllers/lockinController');
const {
  uploadChatAsset,
  listChatAssets,
  deleteChatAsset,
} = require('../controllers/chatAssetsController');
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
