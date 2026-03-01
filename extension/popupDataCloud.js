const MAX_CHAT_PAGES = 30;

async function isSignedIn(authClient) {
  if (!authClient || typeof authClient.getSession !== 'function') {
    return false;
  }
  try {
    const session = await authClient.getSession();
    return Boolean(session?.accessToken || session?.user?.id);
  } catch {
    return false;
  }
}

async function readRecentChatsPage(apiClient, cursor) {
  return apiClient.getRecentChats({ limit: 100, ...(cursor ? { cursor } : {}) });
}

function resolveNextCursor(response) {
  const hasMore = response?.pagination?.hasMore === true;
  if (!hasMore) return null;
  const nextCursor = response?.pagination?.nextCursor;
  if (typeof nextCursor !== 'string' || nextCursor.length === 0) return null;
  return nextCursor;
}

async function readChats(apiClient, errors) {
  if (typeof apiClient?.getRecentChats !== 'function') return [];

  const chats = [];
  let cursor = null;
  for (let page = 0; page < MAX_CHAT_PAGES; page += 1) {
    let response;
    try {
      response = await readRecentChatsPage(apiClient, cursor);
    } catch (error) {
      errors.push({ slice: 'chats', message: error?.message || 'Failed to fetch chats' });
      break;
    }

    const batch = Array.isArray(response?.chats) ? response.chats : [];
    chats.push(...batch);

    const nextCursor = resolveNextCursor(response);
    if (nextCursor === null) break;
    cursor = nextCursor;
  }
  return chats;
}

async function readChatMessages(apiClient, chats, errors) {
  const chatMessagesByChatId = {};
  if (typeof apiClient?.getChatMessages !== 'function') return chatMessagesByChatId;

  for (const chat of chats) {
    const chatId = typeof chat?.id === 'string' ? chat.id : null;
    if (!chatId) continue;
    try {
      chatMessagesByChatId[chatId] = await apiClient.getChatMessages(chatId);
    } catch (error) {
      errors.push({
        slice: 'chatMessages',
        chatId,
        message: error?.message || 'Failed to fetch chat messages',
      });
      chatMessagesByChatId[chatId] = [];
    }
  }
  return chatMessagesByChatId;
}

async function readNotes(apiClient, errors) {
  if (typeof apiClient?.listNotes !== 'function') return [];
  try {
    return await apiClient.listNotes({ limit: 500 });
  } catch (error) {
    errors.push({ slice: 'notes', message: error?.message || 'Failed to fetch notes' });
    return [];
  }
}

async function readTasks(apiClient, errors) {
  if (typeof apiClient?.listTasks !== 'function') return [];
  try {
    return await apiClient.listTasks({ includeCompleted: true, limit: 500 });
  } catch (error) {
    errors.push({ slice: 'tasks', message: error?.message || 'Failed to fetch tasks' });
    return [];
  }
}

async function buildCloudSlice(apiClient, authClient) {
  if (!(await isSignedIn(authClient))) {
    return { available: false, reason: 'not_signed_in' };
  }

  const errors = [];
  const notes = await readNotes(apiClient, errors);
  const tasks = await readTasks(apiClient, errors);
  const chats = await readChats(apiClient, errors);
  const chatMessagesByChatId = await readChatMessages(apiClient, chats, errors);

  return {
    available: true,
    notes,
    tasks,
    chats,
    chatMessagesByChatId,
    errors,
  };
}

window.LockInPopupDataCloud = {
  buildCloudSlice,
};
