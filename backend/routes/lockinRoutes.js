/**
 * Express router wiring for the Lock-in API.
 *
 * This file only defines URL structure and middleware composition.
 */

const express = require("express");
const { requireSupabaseUser } = require("../authMiddleware");
const {
  handleLockinRequest,
  listChats,
  deleteChat,
  listChatMessages,
  generateChatTitle,
} = require("../controllers/lockinController");

const router = express.Router();

// Main AI endpoint
router.post("/lockin", requireSupabaseUser, handleLockinRequest);

// Chat management endpoints
router.get("/chats", requireSupabaseUser, listChats);
router.delete("/chats/:chatId", requireSupabaseUser, deleteChat);
router.get("/chats/:chatId/messages", requireSupabaseUser, listChatMessages);
router.post("/chats/:chatId/title", requireSupabaseUser, generateChatTitle);

module.exports = router;


