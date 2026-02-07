// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const ensureEnv = (key: string, fallback: string): void => {
  const current = process.env[key];
  process.env[key] = typeof current === 'string' && current.length > 0 ? current : fallback;
};

ensureEnv('OPENAI_API_KEY', 'test-openai-key');
ensureEnv('SUPABASE_URL', 'http://localhost');
ensureEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

const STATUS_BAD_REQUEST = 400;
const STATUS_OK = 200;
const ATTACHMENT_ID = '11111111-1111-4111-8111-111111111111';

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

type AssistantHandler = (req: TestRequest, res: TestResponse) => Promise<void> | void;

let handleLockinRequest: AssistantHandler;

function resetModule(modulePath: string): void {
  delete require.cache[require.resolve(modulePath)];
}

function resetAssistantModules(): void {
  resetModule('../../backend/controllers/assistant/ai.js');
  resetModule('../../backend/controllers/assistant/ai');
  resetModule('../../backend/services/llmClient.js');
  resetModule('../../backend/services/llmClient');
  resetModule('../../backend/repositories/chatRepository.js');
  resetModule('../../backend/repositories/chatRepository');
  resetModule('../../backend/services/rateLimitService.js');
  resetModule('../../backend/services/rateLimitService');
  resetModule('../../backend/controllers/assistant/assets.js');
  resetModule('../../backend/controllers/assistant/assets');
  resetModule('../../backend/repositories/chatAssetsRepository.js');
  resetModule('../../backend/repositories/chatAssetsRepository');
}

function stubLlmClient(): void {
  const llmClient = require('../../backend/services/llmClient.js') as {
    generateStructuredStudyResponse?: typeof generateStructuredStudyResponse;
    generateChatTitleFromHistory?: ReturnType<typeof vi.fn>;
    generateLockInResponse?: ReturnType<typeof vi.fn>;
  };
  llmClient.generateStructuredStudyResponse = generateStructuredStudyResponse;
  llmClient.generateChatTitleFromHistory = vi.fn();
  llmClient.generateLockInResponse = vi.fn();
}

function stubChatRepository(): void {
  const chatRepository = require('../../backend/repositories/chatRepository.js') as {
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
}

function stubRateLimiter(): void {
  const rateLimiter = require('../../backend/services/rateLimitService.js') as {
    checkDailyLimit?: typeof checkDailyLimit;
  };
  rateLimiter.checkDailyLimit = checkDailyLimit;
}

function stubAssistantAssets(): void {
  const assistantAssets = require('../../backend/controllers/assistant/assets.js') as {
    getAssetForVision?: typeof getAssetForVision;
    getAssetTextContent?: typeof getAssetTextContent;
    createSignedAssetUrl?: typeof createSignedAssetUrl;
  };
  assistantAssets.getAssetForVision = getAssetForVision;
  assistantAssets.getAssetTextContent = getAssetTextContent;
  assistantAssets.createSignedAssetUrl = createSignedAssetUrl;
}

function stubChatAssetsRepository(): void {
  const chatAssetsRepoModule =
    require('../../backend/repositories/chatAssetsRepository.js') as Record<string, unknown>;
  Object.assign(chatAssetsRepoModule, chatAssetsRepository);
}

function loadHandler(): void {
  ({ handleLockinRequest } = require('../../backend/controllers/assistant/ai.js') as {
    handleLockinRequest: AssistantHandler;
  });
}

function loadAssistantController(): void {
  resetAssistantModules();
  stubLlmClient();
  stubChatRepository();
  stubRateLimiter();
  stubAssistantAssets();
  stubChatAssetsRepository();
  loadHandler();
}

type TestResponse = {
  statusCode: number;
  body: Record<string, unknown> | null;
  status: (code: number) => TestResponse;
  json: (payload: Record<string, unknown>) => TestResponse;
};

function createRes(): TestResponse {
  return {
    statusCode: STATUS_OK,
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

function setupAttachmentMocks(): void {
  createChat.mockResolvedValue({ id: 'chat-1', title: 'Title' });
  insertChatMessage.mockResolvedValueOnce({ id: 'msg-1' }).mockResolvedValueOnce({ id: 'msg-2' });
  generateStructuredStudyResponse.mockResolvedValue({
    content: 'Response',
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
}

function buildAttachmentRequest(): TestRequest {
  return {
    body: {
      selection: '',
      mode: 'explain',
      chatHistory: [],
      attachments: [ATTACHMENT_ID],
    },
    user: { id: 'user-1' },
    headers: {},
  };
}

function expectSuccessResponse(res: TestResponse): void {
  expect(res.statusCode).toBe(STATUS_OK);
  expect(res.body?.['success']).toBe(true);
}

function expectAttachmentCall(): void {
  const attachmentsExpectation: unknown = expect.arrayContaining([
    expect.objectContaining({
      type: 'document',
      textContent: 'Attachment text',
    }),
  ]);

  expect(generateStructuredStudyResponse).toHaveBeenCalledWith(
    expect.objectContaining({
      selection: '',
      attachments: attachmentsExpectation,
    }),
  );
}

describe('assistant AI attachments validation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    checkDailyLimit.mockResolvedValue({ allowed: true });
    loadAssistantController();
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

    expect(res.statusCode).toBe(STATUS_BAD_REQUEST);
    expect(res.body?.['success']).toBe(false);
  });

  it('allows attachment-only requests without selection', async () => {
    setupAttachmentMocks();
    const req = buildAttachmentRequest();
    const res = createRes();

    await handleLockinRequest(req, res);

    expectSuccessResponse(res);
    expectAttachmentCall();
  });
});
