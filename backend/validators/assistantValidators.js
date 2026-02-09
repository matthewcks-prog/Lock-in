// backend/validators/assistantValidators.js

const { z } = require('zod');

/**
 * Assistant Validation Schemas
 *
 * Declarative Zod validation for assistant-related endpoints.
 * Applied via validate() middleware in routes.
 *
 * IMPORTANT: Field names MUST match the API client contract in /api/resources/lockinClient.ts
 */

// UUID validation helper
const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });

// Constants matching service layer
const MAX_SELECTION_LENGTH = 50000;
const MAX_PAGE_CONTEXT_LENGTH = 100000;
const MAX_USER_MESSAGE_LENGTH = 10000;
const MAX_HISTORY_MESSAGES = 50;

/**
 * Chat message schema for history array
 */
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(MAX_USER_MESSAGE_LENGTH),
});

/**
 * Schema for main lockin AI request
 * POST /api/lockin
 *
 * Field names match the client contract:
 * - selection: The highlighted/selected text (optional for follow-up messages)
 * - chatHistory: Previous messages in the conversation
 * - newUserMessage: Follow-up question from user
 * - pageContext: Full page content for context
 * - pageUrl: URL of the source page
 * - courseCode: Academic course identifier
 * - language: Two-letter language code
 * - attachments: Array of asset IDs
 * - chatId: Existing chat session ID
 * - idempotencyKey: Optional key for request de-duplication
 */
const lockinRequestSchema = z
  .object({
    selection: z
      .string()
      .max(MAX_SELECTION_LENGTH, `Selection too long (max ${MAX_SELECTION_LENGTH} chars)`)
      .optional()
      .default(''),
    chatHistory: z.array(chatMessageSchema).max(MAX_HISTORY_MESSAGES).optional().default([]),
    newUserMessage: z
      .string()
      .max(MAX_USER_MESSAGE_LENGTH, `Message too long (max ${MAX_USER_MESSAGE_LENGTH} chars)`)
      .optional()
      .nullable(),
    pageContext: z
      .string()
      .max(MAX_PAGE_CONTEXT_LENGTH, `Context too long (max ${MAX_PAGE_CONTEXT_LENGTH} chars)`)
      .optional()
      .nullable(),
    pageUrl: z.string().max(2000, 'URL too long').optional().nullable(),
    courseCode: z.string().max(50, 'Course code too long').optional().nullable(),
    chatId: uuidSchema.optional().nullable(),
    language: z
      .string()
      .max(10, 'Language code too long')
      .optional()
      .nullable()
      .transform((val) => val?.toLowerCase()),
    attachments: z
      .array(uuidSchema)
      .max(10, 'Maximum 10 attachments allowed')
      .optional()
      .default([]),
    idempotencyKey: z.string().max(100, 'Idempotency key too long').optional().nullable(),
  })
  .refine(
    (data) => {
      // For initial requests (empty history), require either selection or attachments
      const isInitialRequest = data.chatHistory.length === 0;
      if (isInitialRequest) {
        const hasSelection = data.selection && data.selection.trim().length > 0;
        const hasAttachments = data.attachments && data.attachments.length > 0;
        return hasSelection || hasAttachments;
      }
      // For follow-up requests, no additional requirements
      return true;
    },
    {
      message: 'Initial requests require either selection text or attachments',
    },
  );

/**
 * Schema for chat ID parameter
 * Used in GET/DELETE /api/chats/:chatId
 */
const chatIdParamSchema = z.object({
  chatId: uuidSchema,
});

/**
 * Schema for creating a chat session
 * POST /api/chats
 */
const createChatSessionSchema = z.object({
  title: z.string().max(200, 'Title too long').optional().nullable(),
  initialMessage: z.string().max(5000, 'Initial message too long').optional().nullable(),
});

/**
 * Schema for listing chats
 * GET /api/chats
 */
const listChatsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

/**
 * Schema for generating chat title
 * POST /api/chats/:chatId/title
 */
const generateChatTitleSchema = z.object({
  // No body required - just validates params
});

/**
 * Schema for asset ID parameter
 * DELETE /api/chat-assets/:assetId
 */
const assetIdParamSchema = z.object({
  assetId: uuidSchema,
});

/**
 * Schema for message ID parameter
 * Used in PUT /api/chats/:chatId/messages/:messageId
 */
const messageIdParamSchema = z.object({
  chatId: uuidSchema,
  messageId: uuidSchema,
});

/**
 * Schema for editing a message
 * PUT /api/chats/:chatId/messages/:messageId
 */
const editMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content is required')
    .max(MAX_USER_MESSAGE_LENGTH, `Message too long (max ${MAX_USER_MESSAGE_LENGTH} chars)`),
});

module.exports = {
  lockinRequestSchema,
  chatIdParamSchema,
  createChatSessionSchema,
  listChatsQuerySchema,
  generateChatTitleSchema,
  assetIdParamSchema,
  messageIdParamSchema,
  editMessageSchema,
};
