const chatRepository = require('../../repositories/chatRepository');
const { buildInitialChatTitle } = require('../../utils/chatTitle');
const { chatAssetsService: defaultChatAssetsService } = require('./chatAssetsService');

function createServices(deps = {}) {
  return {
    chatRepository: deps.chatRepository ?? chatRepository,
    chatAssetsService: deps.chatAssetsService ?? defaultChatAssetsService,
  };
}

function requireUserContext(userId) {
  if (!userId) {
    throw new Error('User context missing.');
  }
}

function requireUserAndChat(userId, chatId, operation) {
  if (!userId || !chatId) {
    throw new Error(`${operation} requires userId and chatId`);
  }
}

function mapAssetsToMessages(messages, assets) {
  const assetsByMessage = new Map();

  for (const asset of assets) {
    if (!asset.messageId) {
      continue;
    }
    if (!assetsByMessage.has(asset.messageId)) {
      assetsByMessage.set(asset.messageId, []);
    }
    assetsByMessage.get(asset.messageId).push(asset);
  }

  return messages.map((message) => {
    const attachments = assetsByMessage.get(message.id);
    if (!attachments || attachments.length === 0) {
      return message;
    }
    return { ...message, attachments };
  });
}

async function listChats(services, { userId, limit, cursor } = {}) {
  requireUserContext(userId);
  return services.chatRepository.getRecentChats(userId, { limit, cursor });
}

async function getChatById(services, { userId, chatId } = {}) {
  requireUserAndChat(userId, chatId, 'getChatById');
  return services.chatRepository.getChatById(userId, chatId);
}

async function createChatSession(services, { userId, titleSeed } = {}) {
  requireUserContext(userId);
  const chatTitle = buildInitialChatTitle(titleSeed || '');
  return services.chatRepository.createChat(userId, chatTitle);
}

async function deleteChat(services, { userId, chatId } = {}) {
  requireUserAndChat(userId, chatId, 'deleteChat');

  const chat = await services.chatRepository.getChatById(userId, chatId);
  if (!chat) {
    return { notFound: true };
  }

  await services.chatRepository.deleteChatMessages({ userId, chatId });
  await services.chatRepository.deleteChat({ userId, chatId });

  return { deleted: true };
}

async function listChatMessages(services, { userId, chatId } = {}) {
  requireUserAndChat(userId, chatId, 'listChatMessages');

  const chat = await services.chatRepository.getChatById(userId, chatId);
  if (!chat) {
    return { notFound: true };
  }

  const messages = await services.chatRepository.getChatMessages(userId, chatId);
  const assets = await services.chatAssetsService.listChatAssets({ userId, chatId });
  return { messages: mapAssetsToMessages(messages, assets) };
}

function createChatService(deps = {}) {
  const services = createServices(deps);

  return {
    listChats: (params) => listChats(services, params),
    getChatById: (params) => getChatById(services, params),
    createChatSession: (params) => createChatSession(services, params),
    deleteChat: (params) => deleteChat(services, params),
    listChatMessages: (params) => listChatMessages(services, params),
  };
}

const chatService = createChatService();

module.exports = {
  createChatService,
  chatService,
};
