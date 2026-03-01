const { fetchWithRetry } = require('../../../../utils/networkRetry');
const {
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_OUTPUT_TOKENS,
  REQUEST_TIMEOUT_MS,
  ERROR_DETAILS_MAX_LENGTH,
} = require('./constants');

function buildRequestBody(systemInstruction, contents, options) {
  const requestBody = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: options.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    },
  };

  if (systemInstruction) {
    requestBody.systemInstruction = systemInstruction;
  }

  if (options.responseFormat?.type === 'json_object') {
    requestBody.generationConfig.responseMimeType = 'application/json';
  }

  return requestBody;
}

function parseErrorDetails(errorBody) {
  if (!errorBody) {
    return '';
  }

  try {
    const parsed = JSON.parse(errorBody);
    return parsed.error?.message || errorBody.substring(0, ERROR_DETAILS_MAX_LENGTH);
  } catch {
    return errorBody.substring(0, ERROR_DETAILS_MAX_LENGTH);
  }
}

async function buildHttpError(response, wrapError) {
  const errorBody = await response.text();
  const errorDetails = parseErrorDetails(errorBody);
  const error = new Error(`Gemini API error: ${response.status} - ${errorDetails}`);
  error.status = response.status;
  return wrapError(error);
}

async function executeRequest(url, requestBody, requestOptions, apiKey) {
  return fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: requestOptions.signal,
    },
    {
      maxRetries: 0,
      timeoutMs: requestOptions.timeoutMs ?? REQUEST_TIMEOUT_MS,
      context: 'gemini chatCompletion',
    },
  );
}

function extractContent(data, wrapError) {
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts?.[0]?.text) {
    throw wrapError(new Error('No content in Gemini response'));
  }
  return candidate.content.parts[0].text;
}

function extractUsage(data) {
  if (!data.usageMetadata) {
    return null;
  }

  return {
    prompt_tokens: data.usageMetadata.promptTokenCount || 0,
    completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
    total_tokens: data.usageMetadata.totalTokenCount || 0,
  };
}

module.exports = {
  buildRequestBody,
  parseErrorDetails,
  buildHttpError,
  executeRequest,
  extractContent,
  extractUsage,
};
