// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

const generateStructuredStudyResponse = vi.fn();

const createChat = vi.fn();
const getChatById = vi.fn();
const insertChatMessage = vi.fn();
const touchChat = vi.fn();
const getRecentChats = vi.fn();
const getChatMessages = vi.fn();
const updateChatTitle = vi.fn();

const checkDailyLimit = vi.fn();

const getAssetForVision = vi.fn();
const getAssetTextContent = vi.fn();
const createSignedAssetUrl = vi.fn();

const chatAssetsRepository = {
  getAssetById: vi.fn(),
  linkAssetsToMessage: vi.fn(),
  listAssetsForChat: vi.fn(),
};

const require = createRequire(import.meta.url);

type TestRequest = {
  body: Record<string, unknown>;
  user: { id: string };
  headers: Record<string, string>;
  get?: (key: string) => string | undefined;
};

type LockinHandler = (req: TestRequest, res: TestResponse) => Promise<void> | void;

let handleLockinRequest: LockinHandler;

function resetModule(modulePath: string) {
  delete require.cache[require.resolve(modulePath)];
}

function loadLockinController() {
  resetModule('../../backend/controllers/lockinController.js');
  resetModule('../../backend/controllers/lockinController');
  resetModule('../../backend/openaiClient.js');
  resetModule('../../backend/openaiClient');
  resetModule('../../backend/chatRepository.js');
  resetModule('../../backend/chatRepository');
  resetModule('../../backend/rateLimiter.js');
  resetModule('../../backend/rateLimiter');
  resetModule('../../backend/controllers/chatAssetsController.js');
  resetModule('../../backend/controllers/chatAssetsController');
  resetModule('../../backend/repositories/chatAssetsRepository.js');
  resetModule('../../backend/repositories/chatAssetsRepository');

  const openaiClient = require('../../backend/openaiClient.js') as {
    generateStructuredStudyResponse?: typeof generateStructuredStudyResponse;
    generateChatTitleFromHistory?: ReturnType<typeof vi.fn>;
    generateLockInResponse?: ReturnType<typeof vi.fn>;
  };
  openaiClient.generateStructuredStudyResponse = generateStructuredStudyResponse;
  openaiClient.generateChatTitleFromHistory = vi.fn();
  openaiClient.generateLockInResponse = vi.fn();

  const chatRepository = require('../../backend/chatRepository.js') as {
    createChat?: typeof createChat;
    getChatById?: typeof getChatById;
    insertChatMessage?: typeof insertChatMessage;
    touchChat?: typeof touchChat;
    getRecentChats?: typeof getRecentChats;
    getChatMessages?: typeof getChatMessages;
    updateChatTitle?: typeof updateChatTitle;
  };
  chatRepository.createChat = createChat;
  chatRepository.getChatById = getChatById;
  chatRepository.insertChatMessage = insertChatMessage;
  chatRepository.touchChat = touchChat;
  chatRepository.getRecentChats = getRecentChats;
  chatRepository.getChatMessages = getChatMessages;
  chatRepository.updateChatTitle = updateChatTitle;

  const rateLimiter = require('../../backend/rateLimiter.js') as {
    checkDailyLimit?: typeof checkDailyLimit;
  };
  rateLimiter.checkDailyLimit = checkDailyLimit;

  const chatAssetsController = require('../../backend/controllers/chatAssetsController.js') as {
    getAssetForVision?: typeof getAssetForVision;
    getAssetTextContent?: typeof getAssetTextContent;
    createSignedAssetUrl?: typeof createSignedAssetUrl;
  };
  chatAssetsController.getAssetForVision = getAssetForVision;
  chatAssetsController.getAssetTextContent = getAssetTextContent;
  chatAssetsController.createSignedAssetUrl = createSignedAssetUrl;

  const chatAssetsRepoModule =
    require('../../backend/repositories/chatAssetsRepository.js') as Record<string, unknown>;
  Object.assign(chatAssetsRepoModule, chatAssetsRepository);

  ({ handleLockinRequest } = require('../../backend/controllers/lockinController.js') as {
    handleLockinRequest: LockinHandler;
  });
}

type TestResponse = {
  statusCode: number;
  body: Record<string, unknown> | null;
  status: (code: number) => TestResponse;
  json: (payload: Record<string, unknown>) => TestResponse;
};

function createRes(): TestResponse {
  return {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: Record<string, unknown>) {
      this.body = payload;
      return this;
    },
  };
}

describe('lockinController attachments validation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    checkDailyLimit.mockResolvedValue({ allowed: true });
    loadLockinController();
  });

  it('returns 400 when selection and attachments are missing', async () => {
    const req: TestRequest = {
      body: {
        selection: '',
        mode: 'explain',
        chatHistory: [],
      },
      user: { id: 'user-1' },
      headers: {},
    };
    const res = createRes();

    await handleLockinRequest(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body?.success).toBe(false);
  });

  it('allows attachment-only requests without selection', async () => {
    createChat.mockResolvedValue({ id: 'chat-1', title: 'Title' });
    insertChatMessage.mockResolvedValueOnce({ id: 'msg-1' }).mockResolvedValueOnce({ id: 'msg-2' });
    generateStructuredStudyResponse.mockResolvedValue({
      mode: 'explain',
      explanation: 'Response',
      notes: [],
      todos: [],
      tags: [],
      difficulty: 'easy',
    });
    chatAssetsRepository.getAssetById.mockResolvedValue({
      id: 'asset-1',
      type: 'document',
      mime_type: 'text/plain',
    });
    getAssetTextContent.mockResolvedValue({
      textContent: 'Attachment text',
      mimeType: 'text/plain',
      fileName: 'doc.txt',
    });

    const req: TestRequest = {
      body: {
        selection: '',
        mode: 'explain',
        chatHistory: [],
        attachments: ['11111111-1111-4111-8111-111111111111'],
      },
      user: { id: 'user-1' },
      headers: {},
    };
    const res = createRes();

    await handleLockinRequest(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(generateStructuredStudyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        selection: '',
        attachments: expect.arrayContaining([
          expect.objectContaining({
            type: 'document',
            textContent: 'Attachment text',
          }),
        ]),
      }),
    );
  });
});
