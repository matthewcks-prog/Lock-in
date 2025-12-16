import type { ChatMessage, StudyResponse, ApiResponse } from "../../core/domain/types";
import type { ApiRequest } from "../fetcher";

export interface ProcessTextParams {
  selection: string;
  mode: "explain" | "simplify" | "translate" | "general";
  targetLanguage?: string;
  difficultyLevel?: "highschool" | "university";
  chatHistory?: ChatMessage[];
  newUserMessage?: string;
  chatId?: string;
  pageContext?: string;
  pageUrl?: string;
  courseCode?: string;
  language?: string;
}

export function createLockinClient(apiRequest: ApiRequest) {
  async function processText(params: ProcessTextParams): Promise<ApiResponse<StudyResponse>> {
    const {
      selection,
      mode,
      targetLanguage = "en",
      difficultyLevel = "highschool",
      chatHistory = [],
      newUserMessage,
      chatId,
      pageContext,
      pageUrl,
      courseCode,
      language = "en",
    } = params;

    const normalizedHistory = (Array.isArray(chatHistory) ? chatHistory : [])
      .filter(
        (message) =>
          message &&
          typeof message.role === "string" &&
          typeof message.content === "string",
      )
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const body: any = {
      selection: selection || "",
      mode,
      targetLanguage,
      difficultyLevel,
      chatHistory: normalizedHistory,
    };

    if (newUserMessage) body.newUserMessage = newUserMessage;
    if (chatId) body.chatId = chatId;
    if (pageContext) body.pageContext = pageContext;
    if (pageUrl) body.pageUrl = pageUrl;
    if (courseCode) body.courseCode = courseCode;
    if (language) body.language = language;

    return apiRequest<ApiResponse<StudyResponse>>("/api/lockin", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  return {
    processText,
  };
}
