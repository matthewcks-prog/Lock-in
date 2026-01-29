const chatRepository = require('../../repositories/chatRepository');
const { buildInitialChatTitle } = require('../../utils/chatTitle');
const { chatAssetsService: defaultChatAssetsService } = require('./chatAssetsService');

function createChatService(deps = {}) {
  const services = {
    chatRepository: deps.chatRepository ?? chatRepository,
    chatAssetsService: deps.chatAssetsService ?? defaultChatAssetsService,
  };

  async function listChats({ userId, limit, cursor } = {}) {
    if (!userId) {
      throw new Error('User context missing.');
    }

    return services.chatRepository.getRecentChats(userId, { limit, cursor });
  }

  async function getChatById({ userId, chatId } = {}) {
    if (!userId || !chatId) {
      throw new Error('getChatById requires userId and chatId');
    }
    return services.chatRepository.getChatById(userId, chatId);
  }

  async function createChatSession({ userId, titleSeed } = {}) {
    if (!userId) {
      throw new Error('User context missing.');
    }

    const chatTitle = buildInitialChatTitle(titleSeed || '');
    return services.chatRepository.createChat(userId, chatTitle);
  }

  async function deleteChat({ userId, chatId } = {}) {
    if (!userId || !chatId) {
      throw new Error('deleteChat requires userId and chatId');
    }

    const chat = await services.chatRepository.getChatById(userId, chatId);
    if (!chat) {
      return { notFound: true };
    }

    await services.chatRepository.deleteChatMessages({ userId, chatId });
    await services.chatRepository.deleteChat({ userId, chatId });

    return { deleted: true };
  }

  async function listChatMessages({ userId, chatId } = {}) {
    if (!userId || !chatId) {
      throw new Error('listChatMessages requires userId and chatId');
    }

    const chat = await services.chatRepository.getChatById(userId, chatId);
    if (!chat) {
      return { notFound: true };
    }

    const messages = await services.chatRepository.getChatMessages(userId, chatId);
    const assets = await services.chatAssetsService.listChatAssets({ userId, chatId });
    const assetsByMessage = new Map();

    for (const asset of assets) {
      if (!asset.messageId) continue;
      if (!assetsByMessage.has(asset.messageId)) {
        assetsByMessage.set(asset.messageId, []);
      }
      assetsByMessage.get(asset.messageId).push(asset);
    }

    const response = messages.map((message) => {
      const attachments = assetsByMessage.get(message.id);
      if (!attachments || attachments.length === 0) {
        return message;
      }
      return { ...message, attachments };
    });

    return { messages: response };
  }

  return {
    listChats,
    getChatById,
    createChatSession,
    deleteChat,
    listChatMessages,
  };
}

const chatService = createChatService();

module.exports = {
  createChatService,
  chatService,
};
