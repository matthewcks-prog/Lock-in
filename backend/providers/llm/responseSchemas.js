const { z } = require('zod');
const { AppError } = require('../../errors');

const UsageSchema = z
  .object({
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
  })
  .partial();

const OpenAiLikeResponseSchema = z
  .object({
    choices: z
      .array(
        z
          .object({
            message: z.object({ content: z.string().min(1) }).passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    model: z.string().optional(),
    usage: UsageSchema.optional(),
  })
  .passthrough();

const GeminiResponseSchema = z
  .object({
    candidates: z
      .array(
        z
          .object({
            content: z
              .object({
                parts: z.array(z.object({ text: z.string().min(1) }).passthrough()).min(1),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1),
    usageMetadata: z
      .object({
        promptTokenCount: z.number().int().nonnegative().optional(),
        candidatesTokenCount: z.number().int().nonnegative().optional(),
        totalTokenCount: z.number().int().nonnegative().optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

function parseWithSchema(schema, value, label) {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  const error = new AppError(`Invalid ${label} response`, 'PARSE_ERROR', 502, {
    provider: label,
    issues: result.error.issues,
  });
  error.name = 'ParseError';
  throw error;
}

function parseOpenAiResponse(value) {
  return parseWithSchema(OpenAiLikeResponseSchema, value, 'OpenAI');
}

function parseGroqResponse(value) {
  return parseWithSchema(OpenAiLikeResponseSchema, value, 'Groq');
}

function parseGeminiResponse(value) {
  return parseWithSchema(GeminiResponseSchema, value, 'Gemini');
}

module.exports = {
  parseOpenAiResponse,
  parseGroqResponse,
  parseGeminiResponse,
};
